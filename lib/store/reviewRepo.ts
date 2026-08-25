import { readJson, writeJson } from "@/lib/store/jsonStore";
import type { Review } from "@/lib/types";

const FILE = "reviews.json";

export const reviewRepo = {
  list(): Review[] {
    const map = readJson<Record<string, Review>>(FILE, {});
    return Object.values(map);
  },
  getById(reviewId: string): Review | null {
    const map = readJson<Record<string, Review>>(FILE, {});
    return map[reviewId] ?? null;
  },
  upsert(review: Review): void {
    const map = readJson<Record<string, Review>>(FILE, {});
    map[review.id] = review;
    writeJson(FILE, map);
  },
};
