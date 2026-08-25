import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { ReasonCode, Review, ReviewTheme, TriageResult } from "@/lib/types";
import {
  COMPLAINT_KEYWORDS,
  POSITIVE_HINTS,
  SENSITIVE_KEYWORDS,
  THEME_KEYWORDS,
} from "@/lib/triage/rules";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";

function findHits(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(keyword));
}

function detectThemes(text: string): ReviewTheme[] {
  return (Object.keys(THEME_KEYWORDS) as ReviewTheme[]).filter(
    (theme) => findHits(text, THEME_KEYWORDS[theme]).length > 0,
  );
}

/**
 * Deterministic default triage policy over three risk levels.
 *
 * Confidence is a simple keyword-hit heuristic, not a calibrated
 * probability — it's a placeholder for a future LLM-based classifier that
 * would implement this same `TriagePolicy` interface. The determinism is the
 * point: the agent checks and routes, a human still approves.
 */
export class DefaultTriagePolicy implements TriagePolicy {
  classify(review: Review): TriageResult {
    const textLower = review.text.toLowerCase();
    const themes = detectThemes(textLower);
    const base = {
      reviewId: review.id,
      policyVersion: POLICY_VERSION,
      themes,
      computedAt: new Date().toISOString(),
    };

    // 1. Sensitive claims force high risk and block auto-publish, whatever the
    // star rating says. A human answers these personally.
    for (const [code, keywords] of Object.entries(SENSITIVE_KEYWORDS) as [ReasonCode, string[]][]) {
      const hits = findHits(textLower, keywords);
      if (hits.length > 0) {
        return {
          ...base,
          riskLevel: "high",
          reasonCodes: [code],
          recommendedAction: "approval_required",
          sensitive: true,
          confidence: 0.9,
          matchedKeywords: hits,
        };
      }
    }

    const complaintHits = findHits(textLower, COMPLAINT_KEYWORDS);
    const positiveHits = findHits(textLower, POSITIVE_HINTS);

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
