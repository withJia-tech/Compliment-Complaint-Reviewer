import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";
import { triageRepo } from "@/lib/store/triageRepo";
import { triageCheck } from "@/lib/store/schema";
import { dailyBrief, decisionHeading, decisionMetrics, queuePriority } from "@/lib/desk/summary";
import { aggregateByPeriod } from "@/lib/insights/aggregate";
import type { Review } from "@/lib/types";

const now = new Date("2026-11-13T08:00:00Z");
const policy = new DefaultTriagePolicy(() => now);
const review = (id: string, stars: Review["stars"], text: string): Review => ({
  id, stars, text, author: "Synthetic", locationId: "test", createTime: now.toISOString(), updateTime: now.toISOString(),
});

it.each([
  ["praise", 4, "Great food.", "low", "rating_below_five"],
  ["wait", 4, "Great food—only waited fifty minutes.", "medium", "neutral_mixed_sentiment"],
  ["contrast", 5, "Great food, but not the experience I hoped for.", "medium", "neutral_mixed_sentiment"],
  ["language", 5, "Great food lah.", "medium", "unreadable_language"],
  ["unclear", 5, "Something about this food.", "medium", "unconfirmed_praise"],
] as const)("preserves attention and main's stronger interpretation for %s", (id, stars, text, risk, reason) => {
  expect(policy.classify(review(id, stars, text))).toMatchObject({
    policyVersion: POLICY_VERSION, riskLevel: risk, recommendedAction: "needs_review", sensitive: false,
    reasonCodes: [reason], computedAt: now.toISOString(), shadow: { wouldAutoSend: false },
  });
});

it("round-trips the new reason through main's validator without rewriting a legacy record", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-compat-"));
  vi.stubEnv("CCR_STORE_DIR", dir);
  try {
    const current = policy.classify(review("new", 4, "Great food."));
    const legacy = { ...current, reviewId: "old", policyVersion: "policy-v1.0.0", recommendedAction: "quick_approve" as const,
      reasonCodes: ["positive_no_complaint" as const], shadow: undefined };
    triageRepo.upsert(legacy);
    triageRepo.upsert(current);
    const beforeRead = fs.readFileSync(path.join(dir, "triage.json"), "utf8");
    expect(triageRepo.getByReviewId("new")).toEqual(current);
    expect(triageRepo.getByReviewId("old")).toEqual(legacy);
    expect(fs.readFileSync(path.join(dir, "triage.json"), "utf8")).toBe(beforeRead);
    expect(triageCheck({ ...current, reasonCodes: ["unrecognised_reason"] }, "triage")).not.toBeNull();
  } finally {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

it("keeps route, desk groups, priority, risk and theme workload coherent for the same cohort", () => {
  const rows = [
    review("praise4", 4, "Great food."), review("praise5", 5, "Great food."),
    review("mixed5", 5, "Great food but the visit was disappointing."),
    review("language5", 5, "Great food lah."), review("safety5", 5, "Great food. I got hurt on a wet floor."),
  ].map(r => ({ review: r, triage: policy.classify(r), draft: null }));
  expect(rows.map(decisionHeading)).toEqual(["Needs review", "Positive · reply optional", "Needs review", "Needs review", "Sensitive · approval required"]);
  expect(dailyBrief(rows, now)).toMatchObject({ active: 5, now: 1, review: 3, positive: 1 });
  expect(decisionMetrics(rows).risk).toEqual({ sensitive: 1, high: 0, medium: 2, low: 2 });
  expect([...rows].sort((a, b) => queuePriority(a) - queuePriority(b)).map(row => row.review.id))
    .toEqual(["safety5", "mixed5", "language5", "praise4", "praise5"]);
  for (const period of ["week", "month"] as const) {
    expect(aggregateByPeriod(rows, period)[0].themes.find(t => t.theme === "food"))
      .toMatchObject({ count: 5, needsAttention: 4 });
  }
});
