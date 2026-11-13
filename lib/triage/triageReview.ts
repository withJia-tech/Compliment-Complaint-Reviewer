import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import { applyNoReaderGuard } from "@/lib/triage/guards";
import { SENSITIVE_SEVERITY_ORDER, type SensitiveReasonCode } from "@/lib/triage/rules";
import type { ReviewReader, ReviewReading } from "@/lib/triage/reader/types";
import type { ReasonCode, Review, RiskLevel, TriageResult } from "@/lib/types";

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function atLeast(level: RiskLevel, floor: RiskLevel): RiskLevel {
  return RISK_RANK[level] >= RISK_RANK[floor] ? level : floor;
}

function isSensitiveCode(code: ReasonCode): code is SensitiveReasonCode {
  return (SENSITIVE_SEVERITY_ORDER as ReasonCode[]).includes(code);
}

/** Puts the most severe sensitive code first, keeping the rest in order. */
function orderReasons(codes: ReasonCode[]): ReasonCode[] {
  const unique = [...new Set(codes)];
  const sensitive = unique
    .filter(isSensitiveCode)
    .sort((a, b) => SENSITIVE_SEVERITY_ORDER.indexOf(a) - SENSITIVE_SEVERITY_ORDER.indexOf(b));
  return [...sensitive, ...unique.filter((code) => !isSensitiveCode(code))];
}

/**
 * Combines the keyword result with a reading. The reading can only raise
 * attention: it never lowers a risk level, clears a sensitive flag, or turns
 * needs review into quick approve.
 */
export function applyReading(rules: TriageResult, reading: ReviewReading, readerId: string): TriageResult {
  let riskLevel = rules.riskLevel;
  let sensitive = rules.sensitive;
  const added: ReasonCode[] = [];

  if (reading.concern === "sensitive" && reading.category !== "none") {
    sensitive = true;
    riskLevel = "high";
    added.push(`sensitive_${reading.category}` as SensitiveReasonCode);
  } else if (reading.concern !== "none") {
    riskLevel = atLeast(riskLevel, "medium");
    if (rules.recommendedAction === "quick_approve") added.push("reader_concern");
  }

  if (reading.contains_personal_info) {
    riskLevel = atLeast(riskLevel, "medium");
    added.push("personal_info");
  }

  const raisedFromQuick = rules.recommendedAction === "quick_approve" && added.length > 0;
  const reasonCodes = orderReasons(
    raisedFromQuick
      ? [...added, ...rules.reasonCodes.filter((code) => code !== "positive_no_complaint")]
      : [...rules.reasonCodes, ...added],
  );
  const needsReview = sensitive || riskLevel !== "low" || rules.recommendedAction === "needs_review";

  return {
    ...rules,
    policyVersion: `${rules.policyVersion}+${readerId}`,
    riskLevel,
    sensitive,
    reasonCodes,
    recommendedAction: needsReview ? "needs_review" : "quick_approve",
    reading: {
      readerId,
      language: reading.language,
      concern: reading.concern,
      category: reading.category,
      containsPersonalInfo: reading.contains_personal_info,
      rationale: reading.rationale,
    },
  };
}

/** A reader was configured but could not read the review: hold it for the owner. */
export function failClosed(rules: TriageResult, readerId: string): TriageResult {
  return {
    ...rules,
    policyVersion: `${rules.policyVersion}+${readerId}`,
    riskLevel: atLeast(rules.riskLevel, "medium"),
    recommendedAction: "needs_review",
    reasonCodes:
      rules.recommendedAction === "quick_approve"
        ? ["reader_failed", ...rules.reasonCodes.filter((code) => code !== "positive_no_complaint")]
        : [...rules.reasonCodes, "reader_failed"],
  };
}

/**
 * The full triage step: keyword rules and deterministic guards, then the
 * optional second reader.
 *
 * - No reader configured: rules only, and a review in a script the rules
 *   can't read is never quick approve.
 * - Reader configured: it reads every review with text; any failure
 *   (refusal, API error, cache miss) fails closed to needs review.
 */
export async function triageReview(
  review: Review,
  policy: TriagePolicy,
  reader: ReviewReader | null,
): Promise<TriageResult> {
  const rules = policy.classify(review);
  if (!reader) return applyNoReaderGuard(rules, review);
  if (review.text.trim() === "") return rules;

  try {
    return applyReading(rules, await reader.read(review, { rules }), reader.id);
  } catch {
    // Any failure, expected (ReaderError) or not, holds the review for the
    // owner rather than letting the keyword result stand unread.
    return failClosed(rules, reader.id);
  }
}
