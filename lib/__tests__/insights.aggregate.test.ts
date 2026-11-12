import { describe, expect, it } from "vitest";
import { aggregateByPeriod } from "@/lib/insights/aggregate";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { Review } from "@/lib/types";

const policy = new DefaultTriagePolicy();

function row(id: string, stars: Review["stars"], text: string, createTime: string) {
  const review: Review = {
    id,
    locationId: "loc_001",
    author: "Tester",
    stars,
    text,
    createTime,
    updateTime: createTime,
  };
  return { review, triage: policy.classify(review) };
}

describe("aggregateByPeriod", () => {
  const rows = [
    // Week of Mon 2026-08-17
    row("a", 5, "The coffee was delicious", "2026-08-17T10:00:00Z"),
    row("b", 3, "Staff were slow today", "2026-08-19T10:00:00Z"),
    // Week of Mon 2026-08-24
    row("c", 1, "I slipped and got hurt", "2026-08-24T10:00:00Z"),
  ];

  it("groups into Monday-started weeks, newest first", () => {
    const buckets = aggregateByPeriod(rows, "week");
    expect(buckets.map((b) => b.key)).toEqual(["2026-08-24", "2026-08-17"]);
    expect(buckets[0].reviewCount).toBe(1);
    expect(buckets[1].reviewCount).toBe(2);
  });

  it("groups into calendar months", () => {
    const buckets = aggregateByPeriod(rows, "month");
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe("2026-08-01");
    expect(buckets[0].reviewCount).toBe(3);
  });

  it("reports average stars per period", () => {
    const buckets = aggregateByPeriod(rows, "week");
    expect(buckets[1].averageStars).toBe(4); // (5 + 3) / 2
  });

  it("counts sensitive claims separately", () => {
    const buckets = aggregateByPeriod(rows, "week");
    expect(buckets[0].sensitiveCount).toBe(1);
    expect(buckets[1].sensitiveCount).toBe(0);
  });

  it("always reports all three Google-aligned themes, even when empty", () => {
    const buckets = aggregateByPeriod(rows, "month");
    expect(buckets[0].themes.map((t) => t.theme)).toEqual(["food", "service", "atmosphere"]);
  });

  it("splits counts and averages per theme", () => {
    const buckets = aggregateByPeriod(rows, "month");
    const food = buckets[0].themes.find((t) => t.theme === "food");
    const service = buckets[0].themes.find((t) => t.theme === "service");
    expect(food?.count).toBe(1);
    expect(food?.averageStars).toBe(5);
    expect(service?.count).toBe(1);
    expect(service?.needsAttention).toBe(1); // the 3-star mixed review
  });

  it("returns nothing for no reviews", () => {
    expect(aggregateByPeriod([], "week")).toEqual([]);
  });
});
