import businessFacts from "@/data/fixtures/businessFacts.json";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { locationRepo } from "@/lib/store/locationRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import {
  type Approval,
  type ApprovedBusinessFacts,
  DEFAULT_LOCATION_ID,
  type Draft,
  type Review,
  type RiskLevel,
  type TriageResult,
} from "@/lib/types";

export interface QueueRowData {
  review: Review;
  triage: TriageResult;
  draft: Draft | null;
  approval: Approval | null;
}

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

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
    .sort((a, b) => {
      if (a.triage.sensitive !== b.triage.sensitive) return a.triage.sensitive ? -1 : 1;
      const riskDiff = RISK_ORDER[a.triage.riskLevel] - RISK_ORDER[b.triage.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return new Date(b.review.updateTime).getTime() - new Date(a.review.updateTime).getTime();
    });
}

export function countPending(rows: QueueRowData[]): number {
  return rows.filter((row) => !row.approval || row.approval.status === "pending").length;
}

export function loadHeaderData(rows: QueueRowData[]) {
  return {
    location: locationRepo.get(DEFAULT_LOCATION_ID),
    businessName: (businessFacts as ApprovedBusinessFacts).businessName,
    pendingCount: countPending(rows),
  };
}
