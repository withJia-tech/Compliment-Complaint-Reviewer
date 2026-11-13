import { readJson, writeJson } from "@/lib/store/jsonStore";
import { approvalMapCheck } from "@/lib/store/schema";
import type { Approval } from "@/lib/types";

const FILE = "approvals.json";

export const approvalRepo = {
  list(): Approval[] {
    const map = readJson<Record<string, Approval>>(FILE, {}, approvalMapCheck);
    return Object.values(map);
  },
  getByReviewId(reviewId: string): Approval | null {
    const map = readJson<Record<string, Approval>>(FILE, {}, approvalMapCheck);
    return map[reviewId] ?? null;
  },
  upsert(approval: Approval): void {
    const map = readJson<Record<string, Approval>>(FILE, {}, approvalMapCheck);
    map[approval.reviewId] = approval;
    writeJson(FILE, map);
  },
};
