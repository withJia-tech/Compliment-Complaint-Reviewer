import { describe, expect, it } from "vitest";
import dev from "@/evals/routing/dev.json";
import holdout from "@/evals/routing/holdout.json";
import thresholds from "@/evals/routing/thresholds.json";
import { checkThresholds, evaluateRouting, type RoutingEvalCase, type RoutingThresholds } from "@/lib/evals/routingEval";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";

/**
 * The routing eval as a test gate, so `npm test` enforces the same thresholds
 * as `npm run eval`. The script adds the per-category printout and the JSON
 * report artifact; this file makes a regression impossible to merge quietly.
 */
const policy = new DefaultTriagePolicy(() => new Date(0));
const splits = { dev: dev as RoutingEvalCase[], holdout: holdout as RoutingEvalCase[] };
const limits = thresholds as unknown as Record<"dev" | "holdout", RoutingThresholds>;

describe("routing eval gates", () => {
  it.each(["dev", "holdout"] as const)("%s meets its thresholds", (split: "dev" | "holdout") => {
    expect(checkThresholds(evaluateRouting(policy, splits[split]), limits[split])).toEqual([]);
  });

  it("dev and holdout share no case ids or texts", () => {
    const devTexts = new Set(splits.dev.map((c) => c.text.trim()).filter(Boolean));
    const devIds = new Set(splits.dev.map((c) => c.id));
    for (const c of splits.holdout) {
      expect(devIds.has(c.id)).toBe(false);
      if (c.text.trim()) expect(devTexts.has(c.text.trim())).toBe(false);
    }
  });

  it("every sensitive category appears in both splits", () => {
    for (const split of Object.values(splits)) {
      const categories = new Set(split.map((c) => c.expect.sensitive).filter(Boolean));
      expect(categories.size).toBe(6);
    }
  });
});

describe("eval harness", () => {
  const quickApproveEverything: TriagePolicy = {
    classify: (r) => ({
      reviewId: r.id, policyVersion: "test", riskLevel: "low", reasonCodes: ["positive_no_complaint"],
      recommendedAction: "quick_approve", sensitive: false, themes: [], confidence: 1,
      matchedKeywords: [], computedAt: "x", shadow: { rule: "t", wouldAutoSend: true },
    }),
  };

  it("catches a policy that approves everything", () => {
    const report = evaluateRouting(quickApproveEverything, splits.holdout);
    expect(report.unsafeQuickApprove.count).toBe(splits.holdout.filter((c) => c.expect.mustReview).length);
    expect(report.sensitiveRecall.recall).toBe(0);
    expect(checkThresholds(report, limits.holdout).length).toBeGreaterThan(0);
  });
});
