import type { ApprovalChannel } from "@/lib/interfaces/approvalChannel";
import type { Draft, Review, TriageResult } from "@/lib/types";

/**
 * Prototype stub for the email-first ApprovalChannel. Logs instead of
 * sending real email — the production implementation swaps this class for
 * one that calls an email provider, without changing any caller.
 */
export class EmailApprovalChannel implements ApprovalChannel {
  async notify(review: Review, triage: TriageResult, draft: Draft): Promise<void> {
    console.log(
      `[email-approval-stub] Review ${review.id} (${triage.riskLevel}/${triage.recommendedAction}) needs approval. Draft: "${draft.text}"`,
    );
  }
}
