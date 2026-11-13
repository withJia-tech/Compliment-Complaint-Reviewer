import { readJson, writeJson } from "@/lib/store/jsonStore";
import { draftMapCheck } from "@/lib/store/schema";
import type { Draft } from "@/lib/types";

const FILE = "drafts.json";

export const draftRepo = {
  list(): Draft[] {
    const map = readJson<Record<string, Draft>>(FILE, {}, draftMapCheck);
    return Object.values(map);
  },
  getByReviewId(reviewId: string): Draft | null {
    const map = readJson<Record<string, Draft>>(FILE, {}, draftMapCheck);
    return map[reviewId] ?? null;
  },
  upsert(draft: Draft): void {
    const map = readJson<Record<string, Draft>>(FILE, {}, draftMapCheck);
    map[draft.reviewId] = draft;
    writeJson(FILE, map);
  },
};
