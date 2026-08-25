import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import {
  type Approval,
  type AuditAction,
  type AuditRecord,
  type ProviderPublishResult,
  type RemedyNote,
  STUB_OWNER_ACTOR,
} from "@/lib/types";

const provider = new FixtureReviewProvider();

function requireContext(reviewId: string) {
  const review = reviewRepo.getById(reviewId);
  const triage = triageRepo.getByReviewId(reviewId);
  const draft = draftRepo.getByReviewId(reviewId);
  if (!review || !triage || !draft) {
    throw new Error(`Review ${reviewId} has not been triaged/drafted yet — run a scan first.`);
  }
  return { review, triage, draft };
}

function appendAudit(params: {
  reviewId: string;
  action: AuditAction;
  approval: Approval;
  outcome: ProviderPublishResult | null;
}) {
  const { review, triage, draft } = requireContext(params.reviewId);
  const record: AuditRecord = {
    id: `audit_${params.reviewId}_${Date.now()}`,
    reviewId: params.reviewId,
    locationId: review.locationId,
    policyVersion: triage.policyVersion,
    sourceCreateTime: review.createTime,
    sourceUpdateTime: review.updateTime,
    evidence: { stars: review.stars, text: review.text, matchedKeywords: triage.matchedKeywords },
    triage,
    draft,
    approval: params.approval,
    action: params.action,
    actor: STUB_OWNER_ACTOR,
    outcome: params.outcome,
    recordedAt: new Date().toISOString(),
  };
  auditRepo.append(record);
}

/**
 * Publishes a reply the reviewer approved, with the text they actually saw —
 * edited inline or not. Shared by the queue's inline send and the detail page.
 */
export async function sendReply(reviewId: string, finalText: string): Promise<void> {
  const { draft } = requireContext(reviewId);
  const trimmed = finalText.trim();
  const text = trimmed.length > 0 ? trimmed : draft.text;
  const wasEdited = text !== draft.text;

  const outcome = await provider.publishReply(reviewId, text);
  const existing = approvalRepo.getByReviewId(reviewId);
  const approval: Approval = {
    reviewId,
    status: wasEdited ? "edited_approved" : "approved",
    actor: STUB_OWNER_ACTOR,
    finalText: wasEdited ? text : undefined,
    decidedAt: new Date().toISOString(),
    remedy: existing?.remedy,
  };
  approvalRepo.upsert(approval);
  appendAudit({ reviewId, action: "approved_published", approval, outcome });
}

export function rejectReply(reviewId: string, reason?: string): void {
  requireContext(reviewId);
  const existing = approvalRepo.getByReviewId(reviewId);
  const trimmed = reason?.trim();
  const approval: Approval = {
    reviewId,
    status: "rejected",
    actor: STUB_OWNER_ACTOR,
    decidedAt: new Date().toISOString(),
    reason: trimmed && trimmed.length > 0 ? trimmed : undefined,
    remedy: existing?.remedy,
  };
  approvalRepo.upsert(approval);
  appendAudit({ reviewId, action: "rejected", approval, outcome: null });
}

/**
 * Records that a goodwill remedy (a voucher, say) was offered to this
 * customer. The remedy is settled entirely outside this application — over
 * email, WhatsApp, phone, or in person — so this only writes an internal note
 * to the audit trail. Nothing is sent, and the note never reaches the public
 * reply text.
 */
export function recordRemedy(reviewId: string, remedy: Omit<RemedyNote, "recordedBy" | "recordedAt">): void {
  requireContext(reviewId);
  const existing = approvalRepo.getByReviewId(reviewId);
  const approval: Approval = {
    ...(existing ?? { reviewId, status: "pending", actor: STUB_OWNER_ACTOR }),
    remedy: {
      ...remedy,
      recordedBy: STUB_OWNER_ACTOR,
      recordedAt: new Date().toISOString(),
    },
  };
  approvalRepo.upsert(approval);
  appendAudit({
    reviewId,
    action: approval.status === "pending" ? "pending_approval" : "approved_published",
    approval,
    outcome: null,
  });
}
