"use server";

import { revalidatePath } from "next/cache";
import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import type { Approval, AuditRecord, ProviderPublishResult } from "@/lib/types";
import { STUB_OWNER_ACTOR } from "@/lib/types";

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
  action: AuditRecord["action"];
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

function revalidate(reviewId: string) {
  revalidatePath(`/review/${reviewId}`);
  revalidatePath("/queue");
}

export async function approveAction(reviewId: string) {
  const { draft } = requireContext(reviewId);
  const outcome = await provider.publishReply(reviewId, draft.text);
  const approval: Approval = {
    reviewId,
    status: "approved",
    actor: STUB_OWNER_ACTOR,
    decidedAt: new Date().toISOString(),
  };
  approvalRepo.upsert(approval);
  appendAudit({ reviewId, action: "approved_published", approval, outcome });
  revalidate(reviewId);
}

export async function editAndApproveAction(reviewId: string, formData: FormData) {
  const { draft } = requireContext(reviewId);
  const editedText = String(formData.get("editedText") ?? "").trim();
  const finalText = editedText.length > 0 ? editedText : draft.text;
  const outcome = await provider.publishReply(reviewId, finalText);
  const approval: Approval = {
    reviewId,
    status: "edited_approved",
    actor: STUB_OWNER_ACTOR,
    finalText,
    decidedAt: new Date().toISOString(),
  };
  approvalRepo.upsert(approval);
  appendAudit({ reviewId, action: "approved_published", approval, outcome });
  revalidate(reviewId);
}

export async function rejectAction(reviewId: string, formData: FormData) {
  requireContext(reviewId);
  const reason = String(formData.get("reason") ?? "").trim();
  const approval: Approval = {
    reviewId,
    status: "rejected",
    actor: STUB_OWNER_ACTOR,
    decidedAt: new Date().toISOString(),
    reason: reason.length > 0 ? reason : undefined,
  };
  approvalRepo.upsert(approval);
  appendAudit({ reviewId, action: "rejected", approval, outcome: null });
  revalidate(reviewId);
}
