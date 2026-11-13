import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ModeThresholds,
  checkThresholds,
  evaluate,
  loadGoldenFixtures,
  loosenedLimits,
  summarize,
} from "@/lib/eval/goldenEval";
import { DefaultTriagePolicy } from "@/lib/triage/policy";

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
