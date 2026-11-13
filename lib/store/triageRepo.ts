import { readJson, writeJson } from "@/lib/store/jsonStore";
import { triageMapCheck } from "@/lib/store/schema";
import type { TriageResult } from "@/lib/types";

const FILE = "triage.json";

export const triageRepo = {
  list(): TriageResult[] {
    const map = readJson<Record<string, TriageResult>>(FILE, {}, triageMapCheck);
    return Object.values(map);
  },
  getByReviewId(reviewId: string): TriageResult | null {
    const map = readJson<Record<string, TriageResult>>(FILE, {}, triageMapCheck);
    return map[reviewId] ?? null;
  },
  upsert(result: TriageResult): void {
    const map = readJson<Record<string, TriageResult>>(FILE, {}, triageMapCheck);
    map[result.reviewId] = result;
    writeJson(FILE, map);
  },
};
