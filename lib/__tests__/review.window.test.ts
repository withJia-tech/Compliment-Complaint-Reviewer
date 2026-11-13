import { expect, it } from "vitest";
import { reviewWindowStart, withinReviewWindow } from "@/lib/triage/reviewWindow";
import type { Review } from "@/lib/types";
const now = new Date('2026-11-13T00:00:00Z');
const review = (date: string) => ({createTime: date, updateTime: now.toISOString()} as Review);
it('uses six calendar months and includes the boundary', () => {
  expect(reviewWindowStart(now).toISOString()).toBe('2026-05-13T00:00:00.000Z');
  expect(withinReviewWindow(review('2026-05-13T00:00:00Z'),now)).toBe(true);
  expect(withinReviewWindow(review('2026-05-12T23:59:59.999Z'),now)).toBe(false);
});
it('does not re-admit old reviews edited recently or invalid/future dates', () => {
  for(const date of ['2025-01-01','invalid','2026-11-14']) expect(withinReviewWindow(review(date),now)).toBe(false);
});
it('clamps month ends and leap-year February', () => {
  expect(reviewWindowStart(new Date('2024-08-31T12:00:00Z')).toISOString()).toBe('2024-02-29T12:00:00.000Z');
});
