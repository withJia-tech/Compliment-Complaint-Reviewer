import type { Review, TriageResult } from "@/lib/types";

/** Deterministic classification and routing for a single review. */
export interface TriagePolicy {
  classify(review: Review): TriageResult;
}
