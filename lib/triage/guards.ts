import type { ReasonCode, Review, TriageResult } from "@/lib/types";

/**
 * Deterministic guards that need no keyword list and no model. Each one can
 * only raise a review from quick approve to needs review; none lowers anything.
 */

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
// 8+ digits, optionally broken by spaces, dots, dashes or brackets: "9123 4567", "555-010-1234".
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const CARD_OR_ORDER = /\b(?:card|account)\s+(?:ending|ends)(?:\s+in)?\s+\d{4}\b|\border\s+(?:number|no\.?|#)\s*:?\s*\d{4,}/i;
const STREET_ADDRESS = /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Crescent|Close)\b/;
const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|sg|my|xyz|link|ly|info|biz|app)\b/i;

function digitCount(match: string): number {
  return (match.match(/\d/g) ?? []).length;
}

export function hasPersonalInfo(text: string): boolean {
  const phone = text.match(PHONE);
  return (
    EMAIL.test(text) ||
    (phone !== null && digitCount(phone[0]) >= 8) ||
    CARD_OR_ORDER.test(text) ||
    STREET_ADDRESS.test(text)
  );
}

export function hasLink(text: string): boolean {
  return LINK.test(text.replace(EMAIL, " "));
}

/** Long text built from very few distinct letters, e.g. "aaaa…". */
export function isGibberish(text: string): boolean {
  if (text.length < 200) return false;
  const letters = text.toLowerCase().match(/\p{L}/gu) ?? [];
  return letters.length > 0 && new Set(letters).size <= 3;
}

/** Mostly written in a non-Latin script, which the English keyword lists cannot read. */
export function isNonLatinScript(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return false;
  const nonLatin = letters.filter((ch) => !/\p{Script=Latin}/u.test(ch)).length;
  return nonLatin / letters.length > 0.3;
}

function raise(result: TriageResult, code: ReasonCode): TriageResult {
  const raised = result.recommendedAction === "quick_approve";
  return {
    ...result,
    riskLevel: result.riskLevel === "low" ? "medium" : result.riskLevel,
    recommendedAction: "needs_review",
    reasonCodes: raised ? [code, ...result.reasonCodes] : [...result.reasonCodes, code],
  };
}

/** Guards that always apply, with or without a second reader. */
export function applyGuards(result: TriageResult, review: Pick<Review, "text">): TriageResult {
  let out = result;
  if (hasPersonalInfo(review.text)) out = raise(out, "personal_info");
  if (hasLink(review.text)) out = raise(out, "contains_link");
  if (isGibberish(review.text)) out = raise(out, "unreadable");
  return out;
}

/**
 * Applies only when no second reader is available: a review nobody could read
 * is never marked safe to clear in one click.
 */
export function applyNoReaderGuard(result: TriageResult, review: Pick<Review, "text">): TriageResult {
  return isNonLatinScript(review.text) ? raise(result, "unreadable") : result;
}
