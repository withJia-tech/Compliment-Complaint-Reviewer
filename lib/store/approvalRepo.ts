import { readJson, writeJson } from "@/lib/store/jsonStore";
import type { Approval } from "@/lib/types";

const FILE = "approvals.json";

export const approvalRepo = {
  list(): Approval[] {
    const map = readJson<Record<string, Approval>>(FILE, {});
    return Object.values(map);
  },
  getByReviewId(reviewId: string): Approval | null {
    const map = readJson<Record<string, Approval>>(FILE, {});
    return map[reviewId] ?? null;
  },
  upsert(approval: Approval): void {
    const map = readJson<Record<string, Approval>>(FILE, {});
    map[approval.reviewId] = approval;
    writeJson(FILE, map);
  },
};
