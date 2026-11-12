import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { Review, ReviewTheme, RiskLevel, TriageResult } from "@/lib/types";
import { findComplaintHits, findHits } from "@/lib/triage/match";
import {
  COMPLAINT_KEYWORDS,
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

/**
 * The most severe sensitive category the review matches, by the deliberate
 * order in SENSITIVE_SEVERITY_ORDER. A strong hit in a lower-severity
 * category still loses to a strong hit in a higher one — physical harm
 * outranks money — but a strong hit anywhere beats a weak hit everywhere.
 */
function findSensitive(text: string): SensitiveMatch | null {
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

/**
 * Deterministic default triage policy over three risk levels.
 *
 * `confidence` is one of a small set of fixed values attached to each rule
 * branch — a rule-strength label, not a calibrated probability. The UI shows
 * it as a coarse band (see confidenceBand) rather than a percentage, so it
 * doesn't imply precision the keyword rules don't have. A future
 * model-based classifier implementing this same interface could replace it
 * with a real score without changing any caller.
 */
export class DefaultTriagePolicy implements TriagePolicy {
  classify(review: Review): TriageResult {
    const text = review.text;
    const themes = detectThemes(text);
    const base = {
      reviewId: review.id,
      policyVersion: POLICY_VERSION,
      themes,
      computedAt: new Date().toISOString(),
    };

    // 1. Sensitive claims mark the review sensitive and block auto-publish at
    // any star rating. A strong match goes straight to high; a weak, ambiguous
    // match only floors at medium, though a bad rating can still lift it.
    const sensitive = findSensitive(text);
    if (sensitive) {
      const floor: RiskLevel = sensitive.strength === "strong" ? "high" : "medium";
      return {
        ...base,
        riskLevel: higherRisk(floor, starBandRisk(review.stars)),
        reasonCodes: [sensitive.code],
        recommendedAction: "approval_required",
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
        recommendedAction: "approval_required",
        sensitive: false,
        confidence: complaintHits.length > 0 ? 0.85 : 0.6,
        matchedKeywords: complaintHits,
      };
    }

    // 3. 3 stars, or a 4-5 star review that still contains a real complaint.
    if (review.stars === 3 || complaintHits.length > 0) {
      return {
        ...base,
        riskLevel: "medium",
        reasonCodes: ["neutral_mixed_sentiment"],
        recommendedAction: "approval_required",
        sensitive: false,
        confidence: 0.7,
        matchedKeywords: complaintHits,
      };
    }

    // 4. 4-5 stars, no complaint: eligible for automatic publishing after consent.
    return {
      ...base,
      riskLevel: "low",
      reasonCodes: ["positive_no_complaint"],
      recommendedAction: "auto_publish_eligible",
      sensitive: false,
      confidence: positiveHits.length > 0 ? 0.9 : 0.75,
      matchedKeywords: positiveHits,
    };
  }
}
