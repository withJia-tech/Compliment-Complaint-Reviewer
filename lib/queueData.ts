import { withinReviewWindow } from "@/lib/triage/reviewWindow";
import { contextVersion } from "@/lib/approval/context";
import businessFacts from "@/data/fixtures/businessFacts.json";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { locationRepo } from "@/lib/store/locationRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import { queuePriority } from "@/lib/desk/summary";
import {
  type Approval,
  type ApprovedBusinessFacts,
  DEFAULT_LOCATION_ID,
  type Draft,
  type Review,
  type TriageResult,
} from "@/lib/types";

export interface QueueRowData {
  review: Review;
  triage: TriageResult;
  draft: Draft | null;
  approval: Approval | null;
  version?: string;
}

/** Reviews joined with their triage/draft/approval, sensitive and high risk first. */
export function loadQueueRows(): QueueRowData[] {
  return reviewRepo
    .list()
    .map((review) => ({
      review,
      triage: triageRepo.getByReviewId(review.id),
      draft: draftRepo.getByReviewId(review.id),
      approval: approvalRepo.getByReviewId(review.id),
    }))
    .filter((row): row is QueueRowData => row.triage !== null)
    .map((row) => ({
      ...row,
      version: row.draft
        ? contextVersion(
            { review: row.review, triage: row.triage, draft: row.draft },
            businessFacts as ApprovedBusinessFacts,
          )
        : "",
    }))
    .sort((a, b) => {
      const attentionDiff = queuePriority(a) - queuePriority(b);
      if (attentionDiff !== 0) return attentionDiff;
      return (
        new Date(b.review.createTime).getTime() -
        new Date(a.review.createTime).getTime()
      );
    });
}

export function countPending(rows: QueueRowData[]): number {
  return rows.filter(
    (row) =>
      ["publishing", "publish_unknown"].includes(row.approval?.status ?? "") ||
      (withinReviewWindow(row.review) && (!row.approval || ["pending", "publish_failed"].includes(row.approval.status))),
  ).length;
}

export function loadHeaderData(rows: QueueRowData[]) {
  return {
    location: locationRepo.get(DEFAULT_LOCATION_ID),
    businessName: (businessFacts as ApprovedBusinessFacts).businessName,
    pendingCount: countPending(rows),
  };
}
