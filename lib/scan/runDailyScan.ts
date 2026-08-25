import type { ApprovalChannel } from "@/lib/interfaces/approvalChannel";
import type { ReplyDrafter } from "@/lib/interfaces/replyDrafter";
import type { ReviewProvider } from "@/lib/interfaces/reviewProvider";
import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { locationRepo } from "@/lib/store/locationRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import {
  type ApprovedBusinessFacts,
  type Approval,
  type AuditAction,
  type AuditRecord,
  DEFAULT_LOCATION_ID,
  type ProviderPublishResult,
  STUB_OWNER_ACTOR,
} from "@/lib/types";

const EPOCH = new Date(0).toISOString();

export interface DailyScanDeps {
  provider: ReviewProvider;
  policy: TriagePolicy;
  drafter: ReplyDrafter;
  approvalChannel: ApprovalChannel;
  facts: ApprovedBusinessFacts;
  locationId?: string;
}

export interface DailyScanResult {
  scanned: number;
  since: string;
  scanStartedAt: string;
}

/**
 * Shared orchestration for the "daily worker" step of the workflow: fetch
 * new/updated reviews since the last successful scan, triage, draft, and
 * either auto-publish (only if eligible AND consent is on) or route to
 * human approval — recording one AuditRecord per review either way.
 *
 * Used by both the CLI script (`scripts/dailyScan.ts`) and the optional
 * "run scan now" API route, so there is exactly one implementation of this
 * business logic.
 */
export async function runDailyScan(deps: DailyScanDeps): Promise<DailyScanResult> {
  const locationId = deps.locationId ?? DEFAULT_LOCATION_ID;
  const location = locationRepo.get(locationId);
  const since = location.lastSuccessfulScanAt ?? EPOCH;
  const scanStartedAt = new Date().toISOString();

  const reviews = await deps.provider.listSince(since);

  for (const review of reviews) {
    reviewRepo.upsert(review);

    const triage = deps.policy.classify(review);
    triageRepo.upsert(triage);

    const draft = deps.drafter.draft(review, triage, deps.facts);
    draftRepo.upsert(draft);

    let approval: Approval;
    let outcome: ProviderPublishResult | null = null;
    let action: AuditAction;

    if (triage.recommendedAction === "auto_publish_eligible" && location.autoPublishConsent) {
      outcome = await deps.provider.publishReply(review.id, draft.text);
      approval = {
        reviewId: review.id,
        status: "auto_published",
        actor: "system",
        decidedAt: new Date().toISOString(),
      };
      approvalRepo.upsert(approval);
      action = "auto_published";
    } else {
      // Never clobber a decision a human already made on a previous scan.
      approval = approvalRepo.getByReviewId(review.id) ?? {
        reviewId: review.id,
        status: "pending",
        actor: STUB_OWNER_ACTOR,
      };
      approvalRepo.upsert(approval);
      await deps.approvalChannel.notify(review, triage, draft);
      action = "pending_approval";
    }

    const record: AuditRecord = {
      id: `audit_${review.id}_${Date.now()}`,
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
      actor: "system",
      outcome,
      recordedAt: new Date().toISOString(),
    };
    auditRepo.append(record);
  }

  locationRepo.update(locationId, { lastSuccessfulScanAt: scanStartedAt });

  return { scanned: reviews.length, since, scanStartedAt };
}
