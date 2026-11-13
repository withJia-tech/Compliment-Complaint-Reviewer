import type { ClassificationInput, TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { Review, ReviewTheme, RiskLevel, ShadowAutoSend, TriageResult } from "@/lib/types";
import { findComplaintHits, findHits } from "@/lib/triage/match";
import {
  COMPLAINT_KEYWORDS,
  CONTRAST_MARKERS,
  IDIOM_EXEMPTIONS,
  NON_ENGLISH_MARKERS,
  POSITIVE_HINTS,
  SENSITIVE_KEYWORDS,
  SENSITIVE_SEVERITY_ORDER,
  THEME_KEYWORDS,
  type SensitiveReasonCode,
} from "@/lib/triage/rules";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";

interface SensitiveMatch {
  code: SensitiveReasonCode;
  strength: "strong" | "weak";
  hits: string[];
}

/** Blank out exact praise idioms so their words can't trigger a sensitive match. */
function withoutIdioms(text: string): string {
  let result = text;
  for (const idiom of IDIOM_EXEMPTIONS) {
    result = result.replace(new RegExp(`\\b${idiom.replace(/\s+/g, "\\s+")}\\b`, "gi"), " ");
  }
  return result;
}

/**
 * The most severe sensitive category the review matches, by the deliberate
 * order in SENSITIVE_SEVERITY_ORDER. A strong hit in a lower-severity
 * category still loses to a strong hit in a higher one — physical harm
 * outranks money — but a strong hit anywhere beats a weak hit everywhere.
 */
function findSensitive(rawText: string): SensitiveMatch | null {
  const text = withoutIdioms(rawText);
  const found: SensitiveMatch[] = [];

  for (const code of SENSITIVE_SEVERITY_ORDER) {
    const rule = SENSITIVE_KEYWORDS[code];
    const strongHits = findHits(text, rule.strong);
    if (strongHits.length > 0) {
      found.push({ code, strength: "strong", hits: strongHits });
      continue;
    }
    const weakHits = findHits(text, rule.weak);
    if (weakHits.length > 0) {
      found.push({ code, strength: "weak", hits: weakHits });
    }
  }

  if (found.length === 0) return null;
  return found.find((match) => match.strength === "strong") ?? found[0];
}

function detectThemes(text: string): ReviewTheme[] {
  return (Object.keys(THEME_KEYWORDS) as ReviewTheme[]).filter(
    (theme) => findHits(text, THEME_KEYWORDS[theme]).length > 0,
  );
}

/** Letters outside the Latin script: Chinese, Tamil, Japanese, Arabic, … */
const NON_LATIN_LETTER = /[^\P{L}\p{Script=Latin}]/u;
const ANY_LETTER = /\p{L}/u;

/** Can the English keyword lists be trusted to have read this text? */
function isReadableEnglish(text: string): boolean {
  if (NON_LATIN_LETTER.test(text)) return false;
  return findHits(text, NON_ENGLISH_MARKERS).length === 0;
}

/** No words at all: a bare rating, or emoji only. Nothing for the rules to misread. */
function hasNoWords(text: string): boolean {
  return !ANY_LETTER.test(text) && !/\d/.test(text);
}

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function higherRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

/** Risk from the star rating alone, before any sensitive or complaint signal. */
function starBandRisk(stars: Review["stars"]): RiskLevel {
  if (stars <= 2) return "high";
  if (stars === 3) return "medium";
  return "low";
}

/** Identifier of the shadow rule. Change it whenever shadowAutoSend's conditions change. */
export const SHADOW_AUTO_SEND_RULE = "b1-shadow-v1";

/**
 * Deterministic default triage policy over three risk levels.
 *
 * Fail-closed: the quick-approve lane is the only place a mistake is cheap to
 * make and expensive to discover, so a review only reaches it when every
 * signal positively says it is safe. Anything the rules can't read, or that
 * reads as praise with a reservation, goes to a person.
 *
 * `confidence` is one of a small set of fixed values attached to each rule
 * branch — a rule-strength label, not a calibrated probability.
 *
 * The clock is injected so `classify` is a pure function of its inputs in
 * tests and evals; production uses the real clock.
 */
export class DefaultTriagePolicy implements TriagePolicy {
  constructor(private readonly now: () => Date = () => new Date()) {}

  classify(review: ClassificationInput): TriageResult {
    const text = review.text;
    const themes = detectThemes(text);
    const base = {
      reviewId: review.id,
      policyVersion: POLICY_VERSION,
      themes,
      computedAt: this.now().toISOString(),
      shadow: { rule: SHADOW_AUTO_SEND_RULE, wouldAutoSend: false } as ShadowAutoSend,
    };

    // 1. Sensitive claims, at any star rating. Strong -> high; weak floors at medium.
    const sensitive = findSensitive(text);
    if (sensitive) {
      const floor: RiskLevel = sensitive.strength === "strong" ? "high" : "medium";
      return {
        ...base,
        riskLevel: higherRisk(floor, starBandRisk(review.stars)),
        reasonCodes: [sensitive.code],
        recommendedAction: "needs_review",
        sensitive: true,
        confidence: sensitive.strength === "strong" ? 0.9 : 0.6,
        matchedKeywords: sensitive.hits,
      };
    }

    const complaintHits = findComplaintHits(text, COMPLAINT_KEYWORDS);
    const positiveHits = findHits(text, POSITIVE_HINTS);

    // 2. 1-2 stars: approval required, issue classification shown.
    if (review.stars <= 2) {
      return {
        ...base,
        riskLevel: "high",
        reasonCodes: ["negative_issue"],
        recommendedAction: "needs_review",
        sensitive: false,
        confidence: complaintHits.length > 0 ? 0.85 : 0.6,
        matchedKeywords: complaintHits,
      };
    }

    // 3. Text the English rules can't read. Checked before the complaint
    // lists, because an empty hit list on unreadable text means nothing.
    if (!hasNoWords(text) && !isReadableEnglish(text)) {
      return {
        ...base,
        riskLevel: "medium",
        reasonCodes: ["unreadable_language"],
        recommendedAction: "needs_review",
        sensitive: false,
        confidence: 0.5,
        matchedKeywords: findHits(text, NON_ENGLISH_MARKERS),
      };
    }

    // 4. 3 stars, or a 4-5 star review with a complaint or a reservation.
    const contrastHits = findHits(text, CONTRAST_MARKERS);
    if (review.stars === 3 || complaintHits.length > 0 || contrastHits.length > 0) {
      return {
        ...base,
        riskLevel: "medium",
        reasonCodes: ["neutral_mixed_sentiment"],
        recommendedAction: "needs_review",
        sensitive: false,
        confidence: 0.7,
        matchedKeywords: [...complaintHits, ...contrastHits],
      };
    }

    // 5. 4-5 stars with words but no praise: absence of complaint is not
    // evidence of praise ("Wow. Just wow. You'll see when you get the bill.").
    if (!hasNoWords(text) && positiveHits.length === 0) {
      return {
        ...base,
        riskLevel: "medium",
        reasonCodes: ["unconfirmed_praise"],
        recommendedAction: "needs_review",
        sensitive: false,
        confidence: 0.5,
        matchedKeywords: [],
      };
    }

    // 6. Low risk: praise present (or a bare rating), nothing else detected.
    // Still sent by the owner — a one-click approve of the draft as-is.
    return {
      ...base,
      // B1 shadow rule: exactly 5 stars with praise affirmatively present.
      // Bare ratings are excluded: no praise to point to.
      shadow: {
        rule: SHADOW_AUTO_SEND_RULE,
        wouldAutoSend: review.stars === 5 && positiveHits.length > 0,
      },
      riskLevel: "low",
      reasonCodes: ["positive_no_complaint"],
      recommendedAction: "quick_approve",
      sensitive: false,
      confidence: positiveHits.length > 0 ? 0.9 : 0.75,
      matchedKeywords: positiveHits,
    };
  }
}
