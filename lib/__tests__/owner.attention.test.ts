import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HostedDemo } from "@/app/hosted-demo/sandbox";
import { QueueRow } from "@/app/components/QueueRow";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { dailyBrief, decisionExplanation, decisionHeading, decisionLabel, decisionMetrics } from "@/lib/desk/summary";
import { aggregateByPeriod } from "@/lib/insights/aggregate";
import { buildDemoDatasets, type DemoRow } from "@/lib/demo/datasets";
import type { ApprovedBusinessFacts, Review } from "@/lib/types";

const policy = new DefaultTriagePolicy();
const now = new Date("2026-11-13T08:00:00Z");
const facts: ApprovedBusinessFacts = { locationId: "synthetic", businessName: "Example Cafe", facts: [] };
function row(id: string, stars: Review["stars"], text = "Great food and fast service.") {
  const review: Review = { id, locationId: "synthetic", author: "Synthetic Reviewer", stars, text,
    createTime: "2026-11-12T08:00:00Z", updateTime: "2026-11-12T08:00:00Z" };
  return { review, triage: policy.classify(review),
    draft: { reviewId: id, text: "Thank you for your feedback.", factsUsed: [], templateId: "test", generatedAt: now.toISOString() } };
}

it.each([1, 2, 3, 4] as const)("requires owner review at %i stars even for praise", stars => {
  expect(row("praise", stars).triage.recommendedAction).toBe("needs_review");
});
it.each(["", "That croissant was dope—absolutely delicious.", "Great service—only waited fifty minutes."])(
  "holds four-star %j without asserting a sensitive incident", text => {
    expect(row("four", 4, text).triage).toMatchObject({ riskLevel: "low", sensitive: false,
      recommendedAction: "needs_review", reasonCodes: ["rating_below_five"] });
  },
);
it("does not let the rating floor hide a recognised safety allegation", () => {
  expect(row("injury", 4, "Great food but I got hurt on a wet floor.").triage).toMatchObject({
    riskLevel: "high", sensitive: true, recommendedAction: "needs_review", reasonCodes: ["sensitive_safety"],
  });
});
it("keeps a five-star praise control and a recognised five-star complaint distinct", () => {
  expect(row("praise", 5).triage).toMatchObject({ riskLevel: "low", sensitive: false, recommendedAction: "quick_approve" });
  expect(row("complaint", 5, "The table was dirty.").triage).toMatchObject({ riskLevel: "medium", recommendedAction: "needs_review" });
});
it("shows a current review requirement even for an old stored four-star quick recommendation", () => {
  const stored = row("old", 4);
  stored.triage = { ...stored.triage, riskLevel: "low", sensitive: false, recommendedAction: "quick_approve",
    reasonCodes: ["positive_no_complaint"], policyVersion: "policy-v1.0.0" };
  const original = structuredClone(stored.triage);
  expect(decisionHeading(stored)).toBe("Needs review");
  expect(decisionLabel(stored)).toBe("Review & approve");
  expect(decisionExplanation(stored)).toContain("earlier policy");
  expect(stored.triage).toEqual(original); // Presentation must not rewrite historical evidence.
});
it("honours a needs-review recommendation independently of low risk or five stars", () => {
  const held = row("held", 5);
  held.triage.recommendedAction = "needs_review";
  expect(decisionHeading(held)).toBe("Needs review");
  expect(decisionLabel(held)).toBe("Review & approve");
  expect(dailyBrief([held], now)).toMatchObject({ now: 0, review: 1, positive: 0 });
});
it("counts four-star praise in review workload while keeping both cases low risk", () => {
  const rows = [row("four", 4), row("five", 5)];
  expect(dailyBrief(rows, now)).toMatchObject({ active: 2, now: 0, review: 1, positive: 1 });
  expect(decisionMetrics(rows).risk).toEqual({ sensitive: 0, high: 0, medium: 0, low: 2 });
});
it("prioritises an older review-required case ahead of a newer quick-review case", () => {
  const four = row("four", 4), five = row("five", 5);
  five.review.createTime = "2026-11-13T07:00:00Z";
  expect(dailyBrief([five, four], now).priority?.review.id).toBe("four");
});
it("keeps urgent, review and quick groups disjoint and preserves completion", () => {
  const urgent = row("safety", 4, "I got hurt.");
  const four = row("four", 4), five = row("five", 5);
  expect(dailyBrief([four, five, urgent], now)).toMatchObject({ active: 3, now: 1, review: 1, positive: 1 });
  expect(dailyBrief([four, five, urgent], now).priority?.review.id).toBe("safety");
  expect(decisionHeading({ ...four, approval: { reviewId: "four", actor: "test", status: "no_response_required" } })).toBe("Decision recorded");
  const uncertain = { ...five, approval: { reviewId: "five", actor: "test", status: "publish_unknown" as const } };
  expect(dailyBrief([urgent, uncertain, four], now).priority?.review.id).toBe("five");
});
it("includes low-risk four-star reviews in weekly and monthly theme attention counts", () => {
  const rows = [row("four", 4, "Great food."), row("five", 5, "Great food.")];
  for (const period of ["week", "month"] as const) {
    expect(aggregateByPeriod(rows, period)[0].themes.find(theme => theme.theme === "food"))
      .toMatchObject({ count: 2, averageStars: 4.5, needsAttention: 1 });
  }
});
it("sorts review-required low-risk demo cases before quick-review low-risk cases", () => {
  const low = buildDemoDatasets()[0].rows.filter(item => item.triage.riskLevel === "low");
  const held = low.filter(item => item.review.stars < 5);
  const quick = low.filter(item => item.review.stars === 5);
  expect(held.length).toBeGreaterThan(0);
  expect(quick.length).toBeGreaterThan(0);
  expect(Math.max(...held.map(item => low.indexOf(item)))).toBeLessThan(Math.min(...quick.map(item => low.indexOf(item))));
});
it("renders the hosted four-star workspace as review-required, without a thank-you shortcut", () => {
  const item: DemoRow = { ...row("four", 4), dateLabel: "Synthetic case", historical: false, recencyOrder: 0 };
  const html = renderToStaticMarkup(createElement(HostedDemo, { datasets: [{ id: "dataset2", label: "Synthetic test",
    title: facts.businessName, kind: "synthetic", asOf: now.toISOString(), facts, rows: [item] }] }));
  expect(html).toContain("Needs review");
  expect(html).toContain("Review &amp; approve");
  expect(html).toContain("below five stars");
  expect(html).toContain("desk-priority priority-review");
  expect(html).not.toContain("Positive · reply optional");
  expect(html).not.toContain("Check the thank-you draft");
});
it("renders the server queue card as review-required while retaining the low risk label", () => {
  const html = renderToStaticMarkup(createElement(QueueRow, { ...row("four", 4), approval: null,
    explanation: "Rating requires review.", version: "test", facts }));
  expect(html).toContain("Needs review");
  expect(html).toContain("Review &amp; approve");
  expect(html).toContain("Low risk");
  expect(html).not.toContain("Positive · reply optional");
});
