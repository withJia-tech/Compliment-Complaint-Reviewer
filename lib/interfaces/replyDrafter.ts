import type { ApprovedBusinessFacts, Draft, Review, TriageResult } from "@/lib/types";

/**
 * Evidence-bound draft generation. Implementations must only cite facts
 * present in `facts` and must record every fact key they actually used in
 * `Draft.factsUsed`, so a draft can never claim an invented refund, cause,
 * timeline, or promise.
 */
export interface ReplyDrafter {
  draft(review: Review, triage: TriageResult, facts: ApprovedBusinessFacts): Draft;
}
