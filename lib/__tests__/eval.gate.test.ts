import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ModeThresholds,
  checkReadingsIdentity,
  checkThresholds,
  evaluate,
  loadGoldenFixtures,
  loosenedLimits,
  summarize,
} from "@/lib/eval/goldenEval";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { cascadeReaderId } from "@/lib/triage/reader/cascade";
import { defaultReaderId } from "@/lib/triage/reader/fromEnv";

const limits: ModeThresholds = {
  exactMatchRate: { min: 0.9 },
  sensitiveRecall: { min: 1 },
  unsafeQuickApprove: { max: 0 },
  falseAlarm: { max: 1 },
  readerFailures: { max: 0 },
};
const good = { cases: 10, exactMatch: 10, exactMatchRate: 1, unsafeQuickApprove: 0, falseAlarm: 0, sensitiveRecall: 1, readerFailures: 0 };

describe("evaluation gate", () => {
  it("passes metrics inside every limit", () => {
    expect(checkThresholds(good, limits)).toEqual([]);
  });

  it("fails on a single unsafe quick approve, however good the rest", () => {
    expect(checkThresholds({ ...good, unsafeQuickApprove: 1 }, limits).map((b) => b.metric)).toEqual(["unsafeQuickApprove"]);
  });

  it("fails when sensitive recall or exact match regress", () => {
    const breaches = checkThresholds({ ...good, sensitiveRecall: 0.95, exactMatchRate: 0.8 }, limits);
    expect(breaches.map((b) => b.metric).sort()).toEqual(["exactMatchRate", "sensitiveRecall"]);
  });

  it("detects loosened limits and ignores tightened ones", () => {
    const tighter = { m: { ...limits, falseAlarm: { max: 0 }, exactMatchRate: { min: 0.95 } } };
    expect(loosenedLimits({ m: limits }, tighter)).toEqual([]);
    const looser = { m: { ...limits, unsafeQuickApprove: { max: 2 }, sensitiveRecall: { min: 0.8 } } };
    expect(loosenedLimits({ m: limits }, looser)).toEqual([
      "m.sensitiveRecall.min: 1 -> 0.8",
      "m.unsafeQuickApprove.max: 0 -> 2",
    ]);
    expect(loosenedLimits({ m: limits }, {})).toEqual(["m: removed"]);
  });

  it("treats a missing or non-numeric metric as a breach, never a pass", () => {
    const withCost: ModeThresholds = { ...limits, costPerReviewUsd: { max: 0.01 } };
    expect(checkThresholds({ ...good, costPerReviewUsd: 0.004 }, withCost)).toEqual([]);
    expect(checkThresholds({ ...good, costPerReviewUsd: 0.02 }, withCost).map((b) => b.metric)).toEqual(["costPerReviewUsd"]);
    expect(checkThresholds(good, withCost).map((b) => b.metric)).toEqual(["costPerReviewUsd"]);
    expect(checkThresholds({ ...good, costPerReviewUsd: Number.NaN }, withCost).map((b) => b.metric)).toEqual(["costPerReviewUsd"]);
  });

  it("adding a limit is not loosening; removing one is", () => {
    const withCost = { ...limits, costPerReviewUsd: { max: 0.01 } };
    expect(loosenedLimits({ m: limits }, { m: withCost })).toEqual([]);
    expect(loosenedLimits({ m: withCost }, { m: limits })).toEqual(["m.costPerReviewUsd: removed"]);
    expect(loosenedLimits({ m: withCost }, { m: { ...withCost, costPerReviewUsd: { max: 0.05 } } })).toEqual([
      "m.costPerReviewUsd.max: 0.01 -> 0.05",
    ]);
  });

  it("caps the committed reader at one cent per review", () => {
    const config = JSON.parse(readFileSync("eval/thresholds.json", "utf8"));
    expect(config.modes.rules_plus_reader.costPerReviewUsd).toEqual({ max: 0.01 });
  });

  it("rejects an evaluation run made by any reader other than the configured default", () => {
    const expected = defaultReaderId();
    expect(expected).toContain("claude-haiku-5-5>claude-sonnet-5-5");
    expect(checkReadingsIdentity({ readerId: expected }, expected)).toEqual({ status: "ok" });
    // Same prompt version, different model: the old prompt-version-only check let this through.
    const opusRun = cascadeReaderId("claude-opus-5-5", null);
    expect(opusRun.split(":")[1]).toBe(expected.split(":")[1]);
    expect(checkReadingsIdentity({ readerId: opusRun }, expected)).toMatchObject({ status: "stale" });
    expect(checkReadingsIdentity({ readerId: cascadeReaderId("claude-haiku-5-5", null) }, expected)).toMatchObject({ status: "stale" });
    expect(checkReadingsIdentity(null, expected)).toMatchObject({ status: "missing" });
  });

  it("today's rules-only results meet the committed rules_only thresholds", async () => {
    const config = JSON.parse(readFileSync("eval/thresholds.json", "utf8"));
    const outcomes = await evaluate(loadGoldenFixtures(config.dataset), new DefaultTriagePolicy(), null);
    expect(checkThresholds(summarize(outcomes), config.modes.rules_only)).toEqual([]);
  });

  it("never puts review text in an outcome", async () => {
    const fixtures = loadGoldenFixtures("tests/fixtures/golden/risk_classifier_v1.jsonl");
    const serialized = JSON.stringify(await evaluate(fixtures, new DefaultTriagePolicy(), null));
    for (const f of fixtures.filter((x) => x.review_text.length >= 20)) {
      expect(serialized.includes(f.review_text)).toBe(false);
    }
  });
});
