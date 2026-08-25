import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { ReasonCode, Review, TriageResult } from "@/lib/types";
import { COMPLAINT_KEYWORDS, ESCALATION_KEYWORDS, POSITIVE_HINTS } from "@/lib/triage/rules";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";

function findHits(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(keyword));
}

/**
 * Deterministic default triage policy.
 *
 * Confidence is a simple keyword-hit heuristic, not a calibrated
 * probability — it's a placeholder for a future LLM-based classifier that
 * would implement this same `TriagePolicy` interface.
 */
export class DefaultTriagePolicy implements TriagePolicy {
  classify(review: Review): TriageResult {
    const textLower = review.text.toLowerCase();
    const computedAt = new Date().toISOString();
    const base = {
      reviewId: review.id,
      policyVersion: POLICY_VERSION,
      computedAt,
    };

    // 1. Escalation categories take absolute precedence over star rating —
    // these must never auto-publish regardless of how many stars a review has.
    for (const [code, keywords] of Object.entries(ESCALATION_KEYWORDS) as [ReasonCode, string[]][]) {
      const hits = findHits(textLower, keywords);
      if (hits.length > 0) {
        return {
          ...base,
          riskLevel: "escalate",
          reasonCodes: [code],
          recommendedAction: "escalate_never_auto",
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
        confidence: complaintHits.length > 0 ? 0.85 : 0.6,
        matchedKeywords: complaintHits,
      };
    }

    // 3. 3 stars, or a 4-5 star review that still contains a real complaint:
    // approval required (mixed sentiment).
    if (review.stars === 3 || complaintHits.length > 0) {
      return {
        ...base,
        riskLevel: "medium",
        reasonCodes: ["neutral_mixed_sentiment"],
        recommendedAction: "approval_required",
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
      confidence: positiveHits.length > 0 ? 0.9 : 0.75,
      matchedKeywords: positiveHits,
    };
  }
}
