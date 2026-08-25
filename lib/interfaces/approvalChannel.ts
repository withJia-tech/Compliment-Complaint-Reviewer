import type { Draft, Review, TriageResult } from "@/lib/types";

/**
 * Notifies a human that a review needs approval. Email first in production;
 * MCP-compatible actions later. This prototype stub only logs.
 */
export interface ApprovalChannel {
  notify(review: Review, triage: TriageResult, draft: Draft): Promise<void>;
}
