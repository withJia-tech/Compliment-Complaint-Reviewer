import type { Review, TriageResult } from "@/lib/types";

type AttentionRow = {
  review: Pick<Review, "stars">;
  triage: Pick<TriageResult, "riskLevel" | "sensitive" | "recommendedAction">;
};

/** Current attention requirement, including the floor for older stored results.
 * This projection never rewrites a recorded classification or its policy version.
 */
export function needsOwnerReview({ review, triage }: AttentionRow): boolean {
  return review.stars !== 5 || triage.recommendedAction !== "quick_approve" ||
    triage.sensitive || triage.riskLevel !== "low";
}

/** Urgency first; within low risk, required review comes before the quick lane. */
export function ownerAttentionRank(row: AttentionRow): number {
  if (row.triage.sensitive) return 0;
  if (row.triage.riskLevel === "high") return 1;
  if (row.triage.riskLevel === "medium") return 2;
  return needsOwnerReview(row) ? 3 : 4;
}
