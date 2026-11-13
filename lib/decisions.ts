import { randomUUID } from "node:crypto";
import businessFacts from "@/data/fixtures/businessFacts.json";
import {
  contextVersion,
  fingerprint,
  type ReplyContext,
  type SendConfirmation,
} from "@/lib/approval/context";
import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { acquireStoreLock } from "@/lib/store/jsonStore";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import { VALIDATION_VERSION, validateReply } from "@/lib/validation/reply";
import {
  type Approval,
  type ApprovalStatus,
  type AuditAction,
  type ApprovedBusinessFacts,
  type ProviderPublishResult,
  type RemedyNote,
  STUB_OWNER_ACTOR,
} from "@/lib/types";

// Deliberately fixture-only: authenticated identity and a live provider are separate release gates.
const provider = new FixtureReviewProvider();
const facts = businessFacts as ApprovedBusinessFacts;

function requireContext(reviewId: string): ReplyContext {
  const review = reviewRepo.getById(reviewId);
  const triage = triageRepo.getByReviewId(reviewId);
  const draft = draftRepo.getByReviewId(reviewId);
  if (!review || !triage || !draft)
    throw new Error(
      `Review ${reviewId} has not been triaged/drafted yet — run a scan first.`,
    );
  return { review, triage, draft };
}

function appendAudit(
  context: ReplyContext,
  action: AuditAction,
  approval: Approval,
  outcome: ProviderPublishResult | null,
) {
  const { review, triage, draft } = context;
  auditRepo.append({
    id: randomUUID(),
    reviewId: review.id,
    locationId: review.locationId,
    policyVersion: triage.policyVersion,
    sourceCreateTime: review.createTime,
    sourceUpdateTime: review.updateTime,
    evidence: {
      stars: review.stars,
      text: review.text,
      matchedKeywords: triage.matchedKeywords,
    },
    triage,
    draft,
    approval,
    action,
    actor: STUB_OWNER_ACTOR,
    outcome,
    recordedAt: new Date().toISOString(),
  });
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; reason: "already_decided"; status: ApprovalStatus }
  | {
      ok: false;
      reason:
        | "in_progress"
        | "confirmation_required"
        | "stale_context"
        | "publish_failed"
        | "publish_unknown";
    }
  | { ok: false; reason: "validation_failed"; issues: string[] };

function refusal(reviewId: string): DecisionResult | null {
  const status = approvalRepo.getByReviewId(reviewId)?.status;
  if (status === "publishing" || status === "publish_unknown")
    return { ok: false, reason: "publish_unknown" };
  if (status && status !== "pending" && status !== "publish_failed")
    return { ok: false, reason: "already_decided", status };
  return null;
}

/** The same entry point is used by BOTH UI surfaces. No empty-text fallback or implicit approval. */
export async function sendReply(
  reviewId: string,
  finalText: string,
  confirmation?: SendConfirmation,
): Promise<DecisionResult> {
  const release = acquireStoreLock();
  if (!release) return { ok: false, reason: "in_progress" };
  try {
    const context = requireContext(reviewId);
    const blocked = refusal(reviewId);
    if (blocked) return blocked;
    if (!confirmation || confirmation.reviewed !== true)
      return { ok: false, reason: "confirmation_required" };
    if (
      confirmation.contextVersion !== contextVersion(context, facts) ||
      context.draft.sourceVersion !== fingerprint(context.review) ||
      context.draft.factsVersion !== fingerprint(facts)
    )
      return { ok: false, reason: "stale_context" };
    if (typeof finalText !== "string")
      return {
        ok: false,
        reason: "validation_failed",
        issues: ["Write a text reply."],
      };
    const issues = validateReply(finalText);
    if (issues.length)
      return { ok: false, reason: "validation_failed", issues };
    // Preserve exactly what was confirmed, including whitespace. No silent rewrite.
    const approval: Approval = {
      reviewId,
      status: "publishing",
      actor: STUB_OWNER_ACTOR,
      finalText,
      attemptId: randomUUID(),
      contextVersion: confirmation.contextVersion,
      validationVersion: VALIDATION_VERSION,
      confirmedAt: new Date().toISOString(),
      remedy: approvalRepo.getByReviewId(reviewId)?.remedy,
    };
    // Persist intent before the side effect. Any later crash leaves a non-retryable state.
    appendAudit(context, "publish_requested", approval, null);
    approvalRepo.upsert(approval);
    let outcome: ProviderPublishResult | null = null;
    try {
      outcome = await provider.publishReply(reviewId, finalText);
    } catch {
      /* No exception message is copied into public UI/audit. Delivery may have happened. */
    }
    if (
      outcome?.success === true &&
      outcome.providerReplyId &&
      outcome.publishedAt
    ) {
      const sent: Approval = {
        ...approval,
        status:
          finalText === context.draft.text ? "approved" : "edited_approved",
        decidedAt: new Date().toISOString(),
      };
      appendAudit(context, "approved_published", sent, outcome);
      approvalRepo.upsert(sent);
      return { ok: true };
    }
    const definiteFailure = outcome?.success === false;
    const status = definiteFailure ? "publish_failed" : "publish_unknown";
    const stopped: Approval = { ...approval, status };
    appendAudit(
      context,
      status,
      stopped,
      outcome
        ? {
            success: false,
            error: definiteFailure
              ? "Provider confirmed no publication"
              : "Unconfirmed provider outcome",
          }
        : null,
    );
    approvalRepo.upsert(stopped);
    return { ok: false, reason: status };
  } finally {
    release();
  }
}

/** Read-only provider reconciliation. Never republishes. Only authoritative non-publication permits retry. */
export async function reconcileReply(
  reviewId: string,
): Promise<DecisionResult> {
  const release = acquireStoreLock();
  if (!release) return { ok: false, reason: "in_progress" };
  try {
    const approval = approvalRepo.getByReviewId(reviewId);
    if (
      !approval ||
      !["publishing", "publish_unknown"].includes(approval.status) ||
      !approval.attemptId
    ) {
      return { ok: false, reason: "publish_unknown" };
    }
    const request = auditRepo
      .listByReviewId(reviewId)
      .find(
        (r) =>
          r.action === "publish_requested" &&
          r.approval.attemptId === approval.attemptId,
      );
    if (!request) return { ok: false, reason: "publish_unknown" };
    let result;
    try {
      result = await provider.reconcileReply(reviewId, approval.attemptId);
    } catch {
      return { ok: false, reason: "publish_unknown" };
    }
    // Use the original request snapshot even if current data was changed outside this workflow.
    const record = (
      action: AuditAction,
      next: Approval,
      outcome: ProviderPublishResult | null,
    ) =>
      auditRepo.append({
        ...request,
        id: randomUUID(),
        action,
        approval: next,
        outcome,
        recordedAt: new Date().toISOString(),
      });
    if (
      result.status === "published" &&
      result.text === approval.finalText &&
      result.providerReplyId &&
      result.publishedAt
    ) {
      const sent: Approval = {
        ...approval,
        status:
          approval.finalText === request.draft.text
            ? "approved"
            : "edited_approved",
        decidedAt: new Date().toISOString(),
      };
      record("publish_reconciled", sent, {
        success: true,
        providerReplyId: result.providerReplyId,
        publishedAt: result.publishedAt,
      });
      approvalRepo.upsert(sent);
      return { ok: true };
    }
    if (result.status === "not_published") {
      const failed: Approval = { ...approval, status: "publish_failed" };
      record("publish_not_published", failed, { success: false });
      approvalRepo.upsert(failed);
      return { ok: false, reason: "publish_failed" };
    }
    return { ok: false, reason: "publish_unknown" };
  } finally {
    release();
  }
}

export function rejectReply(reviewId: string, reason?: string): DecisionResult {
  const release = acquireStoreLock();
  if (!release) return { ok: false, reason: "in_progress" };
  try {
    const context = requireContext(reviewId);
    const blocked = refusal(reviewId);
    if (blocked) return blocked;
    const approval: Approval = {
      reviewId,
      status: "rejected",
      actor: STUB_OWNER_ACTOR,
      decidedAt: new Date().toISOString(),
      reason: reason?.trim() || undefined,
      remedy: approvalRepo.getByReviewId(reviewId)?.remedy,
    };
    appendAudit(context, "rejected", approval, null);
    approvalRepo.upsert(approval);
    return { ok: true };
  } finally {
    release();
  }
}

/** Internal note only. The prototype has no manager authentication and must use synthetic data. */
export function recordRemedy(
  reviewId: string,
  remedy: Omit<RemedyNote, "recordedBy" | "recordedAt">,
): DecisionResult {
  const release = acquireStoreLock();
  if (!release) return { ok: false, reason: "in_progress" };
  try {
    const context = requireContext(reviewId);
    const existing = approvalRepo.getByReviewId(reviewId);
    const approval: Approval = {
      ...(existing ?? { reviewId, status: "pending", actor: STUB_OWNER_ACTOR }),
      remedy: {
        ...remedy,
        recordedBy: STUB_OWNER_ACTOR,
        recordedAt: new Date().toISOString(),
      },
    };
    appendAudit(context, "remedy_recorded", approval, null);
    approvalRepo.upsert(approval);
    return { ok: true };
  } finally {
    release();
  }
}
