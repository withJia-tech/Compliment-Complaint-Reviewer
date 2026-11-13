import { readJson, writeJson } from "@/lib/store/jsonStore";
import { reviewMapCheck } from "@/lib/store/schema";
import type { Review } from "@/lib/types";

const FILE = "reviews.json";

export const reviewRepo = {
  list(): Review[] {
    const map = readJson<Record<string, Review>>(FILE, {}, reviewMapCheck);
    return Object.values(map);
  },
  getById(reviewId: string): Review | null {
    const map = readJson<Record<string, Review>>(FILE, {}, reviewMapCheck);
    return map[reviewId] ?? null;
  },
  upsert(review: Review): void {
    const map = readJson<Record<string, Review>>(FILE, {}, reviewMapCheck);
    map[review.id] = review;
    writeJson(FILE, map);
  },
};
