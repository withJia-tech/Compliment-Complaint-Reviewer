import { readJson, writeJson } from "@/lib/store/jsonStore";
import type { TriageResult } from "@/lib/types";

const FILE = "triage.json";

export const triageRepo = {
  list(): TriageResult[] {
    const map = readJson<Record<string, TriageResult>>(FILE, {});
    return Object.values(map);
  },
  getByReviewId(reviewId: string): TriageResult | null {
    const map = readJson<Record<string, TriageResult>>(FILE, {});
    return map[reviewId] ?? null;
  },
  upsert(result: TriageResult): void {
    const map = readJson<Record<string, TriageResult>>(FILE, {});
    map[result.reviewId] = result;
    writeJson(FILE, map);
  },
};
