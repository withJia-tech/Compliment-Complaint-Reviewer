import type { Review, TriageResult } from "@/lib/types";

export type ClassificationInput = Pick<Review, "id" | "stars" | "text">;

/** Deterministic classification and routing for a single review. */
export interface TriagePolicy {
  classify(review: ClassificationInput): TriageResult;
}
