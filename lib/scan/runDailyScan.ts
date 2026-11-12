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
  type AuditRecord,
  DEFAULT_LOCATION_ID,
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
  /** Reviews re-seen but left alone because a human had already decided them. */
  skipped: number;
  since: string;
  scanStartedAt: string;
}

/**
 * Shared orchestration for the "daily worker" step of the workflow: fetch
 * new/updated reviews since the last successful scan, triage, draft, and
 * queue each one for the owner — recording one AuditRecord per review.
 *
 * The scan NEVER publishes. Every reply is sent by the owner, one at a time,
 * from the queue (see lib/decisions.ts). `provider.publishReply` is
 * deliberately unreachable from here; a test asserts it. Auto-send for
 * deterministic 5-star positives is a backlog item (docs/DECISIONS.md) and
 * would be a new, narrower rule, not a revival of the old consent toggle.
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
  let skipped = 0;

  for (const review of reviews) {
    reviewRepo.upsert(review);

    const triage = deps.policy.classify(review);
    triageRepo.upsert(triage);

    const draft = deps.drafter.draft(review, triage, deps.facts);
    draftRepo.upsert(draft);

    const existing = approvalRepo.getByReviewId(review.id);

    // A decision the owner already made survives a rescan. An edited review
    // coming back round must not reopen what they have settled, nor write an
    // audit entry claiming a decision this pass did not make.
    if (existing !== null && existing.status !== "pending") {
      skipped += 1;
      continue;
    }

    const approval: Approval = existing ?? {
      reviewId: review.id,
      status: "pending",
      actor: STUB_OWNER_ACTOR,
    };
    approvalRepo.upsert(approval);
    await deps.approvalChannel.notify(review, triage, draft);

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
      action: "pending_approval",
      actor: "system",
      outcome: null,
      recordedAt: new Date().toISOString(),
    };
    auditRepo.append(record);
  }

  locationRepo.update(locationId, { lastSuccessfulScanAt: scanStartedAt });

  return { scanned: reviews.length, skipped, since, scanStartedAt };
}
