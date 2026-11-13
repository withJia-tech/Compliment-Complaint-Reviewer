import { reviewWindowStart, withinReviewWindow } from "@/lib/triage/reviewWindow";
import { randomUUID } from "node:crypto";
import { acquireStoreLock } from "@/lib/store/jsonStore";
import type { ApprovalChannel } from "@/lib/interfaces/approvalChannel";
import type { ReplyDrafter } from "@/lib/interfaces/replyDrafter";
import type { ReviewProvider } from "@/lib/interfaces/reviewProvider";
import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { ReviewReader } from "@/lib/triage/reader/types";
import { triageReview } from "@/lib/triage/triageReview";
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

export interface DailyScanDeps {
  provider: ReviewProvider;
  policy: TriagePolicy;
  /** Optional second reader. Can only raise attention; failures fail closed. */
  reader?: ReviewReader | null;
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
export async function runDailyScan(
  deps: DailyScanDeps,
): Promise<DailyScanResult> {
  const release = acquireStoreLock();
  if (!release)
    throw new Error(
      "The review store is busy or requires recovery; no scan was run.",
    );
  try {
    const locationId = deps.locationId ?? DEFAULT_LOCATION_ID;
    const location = locationRepo.get(locationId);
    const now = new Date();
    const scanStartedAt = now.toISOString();
    // listSince is exclusive; fetch the exact boundary too, then filter inclusively.
    const cutoff = new Date(reviewWindowStart(now).getTime() - 1).toISOString();
    const since = location.lastSuccessfulScanAt && location.lastSuccessfulScanAt > cutoff
      ? location.lastSuccessfulScanAt : cutoff;

    const fetched = await deps.provider.listSince(since);
    const reviews = fetched.filter(review => review.locationId === locationId && withinReviewWindow(review, now));
    let skipped = 0;

    for (const review of reviews) {
      const existing = approvalRepo.getByReviewId(review.id);
      // Preserve the source/draft that belongs to a completed or uncertain send.
      if (
        existing !== null &&
        existing.status !== "pending" &&
        existing.status !== "publish_failed"
      ) {
        skipped += 1;
        continue;
      }
      reviewRepo.upsert(review);
      // Rules, guards and the optional second reader (which can only raise, and fails closed).
      const triage = await triageReview(review, deps.policy, deps.reader ?? null);
      triageRepo.upsert(triage);
      const draft = deps.drafter.draft(review, triage, deps.facts);
      draftRepo.upsert(draft);

      const approval: Approval = existing ?? {
        reviewId: review.id,
        status: "pending",
        actor: STUB_OWNER_ACTOR,
      };
      approvalRepo.upsert(approval);
      await deps.approvalChannel.notify(review, triage, draft);

      const record: AuditRecord = {
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
        action: "pending_approval",
        actor: "system",
        outcome: null,
        recordedAt: new Date().toISOString(),
      };
      auditRepo.append(record);
    }

    locationRepo.update(locationId, { lastSuccessfulScanAt: scanStartedAt });

    return { scanned: reviews.length, skipped, since, scanStartedAt };
  } finally {
    release();
  }
}
