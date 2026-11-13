import type { Review } from "@/lib/types";

/** Six calendar months, UTC, clamping end-of-month rather than rolling into the next month. */
export function reviewWindowStart(now = new Date()): Date {
  const result = new Date(now);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - 6);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
export function withinReviewWindow(review: Review, now = new Date()): boolean {
  const created = Date.parse(review.createTime);
  return Number.isFinite(created) && created >= reviewWindowStart(now).getTime() && created <= now.getTime();
}
