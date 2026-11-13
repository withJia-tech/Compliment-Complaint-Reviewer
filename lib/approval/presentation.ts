import type { DecisionResult } from "@/lib/decisions";
import type { Approval } from "@/lib/types";

export function statusLabel(approval: Approval | null): string {
  switch (approval?.status) {
    case "approved":
    case "edited_approved":
      return "Sent (simulated)";
    case "no_response_required":
      return "No response required";
    case "rejected":
      return "Skipped";
    case "publish_failed":
      return "Not sent — review and retry";
    case "publishing":
    case "publish_unknown":
      return "Delivery unconfirmed — do not retry";
    default:
      return "Pending";
  }
}

export function refusalMessage(
  result: Extract<DecisionResult, { ok: false }>,
): string {
  switch (result.reason) {
    case "in_progress":
      return "The review store is busy or awaiting crash recovery. No action was taken.";
    case "already_decided":
      return "This review was already decided. Refresh to see the saved decision.";
    case "confirmation_required":
      return "Check the review and reply, then confirm the factual review.";
    case "stale_context":
      return "The review, draft or approved facts changed. Refresh and review the current version before sending.";
    case "validation_failed":
      return result.issues.join(" ");
    case "publish_failed":
      return "The provider confirmed no publication. Review the reply and confirm again to retry.";
    case "publish_unknown":
      return "Delivery is unconfirmed. Sending is blocked until the provider can establish the outcome. The fixture provider cannot resolve an interrupted send.";
  }
}
