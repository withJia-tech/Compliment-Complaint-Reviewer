import { readFileSync } from "node:fs";
import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { ReviewReader } from "@/lib/triage/reader/types";
import { triageReview } from "@/lib/triage/triageReview";
import type { RecommendedAction, Review, RiskLevel, TriageResult } from "@/lib/types";

export interface GoldenFixture {
  fixture_id: string;
  version: string;
  family: string;
  stars: number;
  review_text: string;
  language: string;
  business_context: string;
  expected_primary_action: RecommendedAction;
  expected_risk_level: RiskLevel;
  expected_sensitive: boolean;
  expected_categories: string[];
  notes: string;
}

export function loadGoldenFixtures(file: string): GoldenFixture[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as GoldenFixture);
}

export function fixtureToReview(fixture: GoldenFixture): Review {
  return {
    id: fixture.fixture_id,
    locationId: "loc_001",
    author: "Golden Tester",
    stars: fixture.stars as Review["stars"],
    text: fixture.review_text,
    createTime: "2026-08-20T00:00:00Z",
    updateTime: "2026-08-20T00:00:00Z",
  };
}

/** One fixture's outcome. Carries ids and labels only, never the review text or the model's prose. */
export interface CaseOutcome {
  fixtureId: string;
  family: string;
  language: string;
  expected: { action: RecommendedAction; risk: RiskLevel; sensitive: boolean; categories: string[] };
  actual: { action: RecommendedAction; risk: RiskLevel; sensitive: boolean; leadingReason: string };
  readerConcern: string | null;
  exactMatch: boolean;
  /** Expected needs review, got quick approve: the costly miss. */
  unsafeQuickApprove: boolean;
  /** Expected quick approve, got needs review: costs the owner a read. */
  falseAlarm: boolean;
  readerFailed: boolean;
}

export interface EvalMetrics {
  cases: number;
  exactMatch: number;
  exactMatchRate: number;
  unsafeQuickApprove: number;
  falseAlarm: number;
  sensitiveRecall: number;
  readerFailures: number;
}

export function judge(fixture: GoldenFixture, result: TriageResult): CaseOutcome {
  const leadingReason = result.reasonCodes[0] ?? "";
  const categoryOk =
    !fixture.expected_sensitive || fixture.expected_categories.includes(leadingReason.replace("sensitive_", ""));
  const exactMatch =
    result.recommendedAction === fixture.expected_primary_action &&
    result.riskLevel === fixture.expected_risk_level &&
    result.sensitive === fixture.expected_sensitive &&
    categoryOk;
  return {
    fixtureId: fixture.fixture_id,
    family: fixture.family,
    language: fixture.language,
    expected: {
      action: fixture.expected_primary_action,
      risk: fixture.expected_risk_level,
      sensitive: fixture.expected_sensitive,
      categories: fixture.expected_categories,
    },
    actual: { action: result.recommendedAction, risk: result.riskLevel, sensitive: result.sensitive, leadingReason },
    readerConcern: result.reading ? `${result.reading.concern}/${result.reading.category}` : null,
    exactMatch,
    unsafeQuickApprove: fixture.expected_primary_action === "needs_review" && result.recommendedAction === "quick_approve",
    falseAlarm: fixture.expected_primary_action === "quick_approve" && result.recommendedAction === "needs_review",
    readerFailed: result.reasonCodes.includes("reader_failed"),
  };
}

export function summarize(outcomes: CaseOutcome[]): EvalMetrics {
  const sensitive = outcomes.filter((o) => o.expected.sensitive);
  const exactMatch = outcomes.filter((o) => o.exactMatch).length;
  return {
    cases: outcomes.length,
    exactMatch,
    exactMatchRate: outcomes.length === 0 ? 0 : exactMatch / outcomes.length,
    unsafeQuickApprove: outcomes.filter((o) => o.unsafeQuickApprove).length,
    falseAlarm: outcomes.filter((o) => o.falseAlarm).length,
    sensitiveRecall: sensitive.length === 0 ? 1 : sensitive.filter((o) => o.actual.sensitive).length / sensitive.length,
    readerFailures: outcomes.filter((o) => o.readerFailed).length,
  };
}

export async function evaluate(
  fixtures: GoldenFixture[],
  policy: TriagePolicy,
  reader: ReviewReader | null,
): Promise<CaseOutcome[]> {
  const outcomes: CaseOutcome[] = [];
  for (const fixture of fixtures) {
    outcomes.push(judge(fixture, await triageReview(fixtureToReview(fixture), policy, reader)));
  }
  return outcomes;
}

/** Limits a mode must meet. `min` metrics may not fall below; `max` metrics may not rise above. */
export interface ModeThresholds {
  exactMatchRate: { min: number };
  sensitiveRecall: { min: number };
  unsafeQuickApprove: { max: number };
  falseAlarm: { max: number };
  readerFailures: { max: number };
}

export interface Breach {
  metric: keyof ModeThresholds;
  actual: number;
  limit: string;
}

export function checkThresholds(metrics: EvalMetrics, thresholds: ModeThresholds): Breach[] {
  const breaches: Breach[] = [];
  for (const [metric, limit] of Object.entries(thresholds) as [keyof ModeThresholds, { min?: number; max?: number }][]) {
    const actual = metrics[metric];
    if (limit.min !== undefined && actual < limit.min) breaches.push({ metric, actual, limit: `>= ${limit.min}` });
    if (limit.max !== undefined && actual > limit.max) breaches.push({ metric, actual, limit: `<= ${limit.max}` });
  }
  return breaches;
}

/**
 * Compares two threshold sets and lists every limit the candidate loosens:
 * a lower `min` or a higher `max`. Thresholds may only tighten.
 */
export function loosenedLimits(base: Record<string, ModeThresholds>, candidate: Record<string, ModeThresholds>): string[] {
  const loosened: string[] = [];
  for (const [mode, baseLimits] of Object.entries(base)) {
    const next = candidate[mode];
    if (!next) {
      loosened.push(`${mode}: removed`);
      continue;
    }
    for (const [metric, limit] of Object.entries(baseLimits) as [keyof ModeThresholds, { min?: number; max?: number }][]) {
      const after = next[metric] as { min?: number; max?: number } | undefined;
      if (!after) loosened.push(`${mode}.${metric}: removed`);
      else if (limit.min !== undefined && (after.min === undefined || after.min < limit.min))
        loosened.push(`${mode}.${metric}.min: ${limit.min} -> ${after.min}`);
      else if (limit.max !== undefined && (after.max === undefined || after.max > limit.max))
        loosened.push(`${mode}.${metric}.max: ${limit.max} -> ${after.max}`);
    }
  }
  return loosened;
}
