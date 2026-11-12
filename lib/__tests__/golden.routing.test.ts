import { describe, expect, it } from "vitest";
import goldenCases from "@/data/fixtures/golden.json";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { ReasonCode, Review, ReviewTheme, RiskLevel } from "@/lib/types";

/**
 * The routing rubric, as data. Each case states what the policy is supposed
 * to decide for a given review, so a rule change that shifts a decision
 * fails loudly instead of quietly.
 *
 * The `false positive guard` cases exist because keyword matching used to be
 * substring-based: "issue" contains "sue", so any review mentioning an issue
 * was classified as a legal threat.
 */
interface GoldenCase {
  label: string;
  stars: number;
  text: string;
  expect: {
    riskLevel: RiskLevel;
    sensitive: boolean;
    reasonCode: ReasonCode;
    themes: ReviewTheme[];
  };
}

const policy = new DefaultTriagePolicy();
const cases = goldenCases as GoldenCase[];

function toReview(testCase: GoldenCase): Review {
  return {
    id: `golden_${testCase.label.replace(/\W+/g, "_")}`,
    locationId: "loc_001",
    author: "Golden Tester",
    stars: testCase.stars as Review["stars"],
    text: testCase.text,
    createTime: "2026-08-20T00:00:00Z",
    updateTime: "2026-08-20T00:00:00Z",
  };
}

describe("golden routing set", () => {
  it("covers every reason code the policy can emit", () => {
    const covered = new Set(cases.map((c) => c.expect.reasonCode));
    const all: ReasonCode[] = [
      "positive_no_complaint",
      "neutral_mixed_sentiment",
      "negative_issue",
      "sensitive_safety",
      "sensitive_medical",
      "sensitive_discrimination",
      "sensitive_legal",
      "sensitive_fraud",
      "sensitive_compensation",
    ];
    expect([...all].filter((code) => !covered.has(code))).toEqual([]);
  });

  it.each(cases)("$label", (testCase) => {
    const result = policy.classify(toReview(testCase));
    expect({
      riskLevel: result.riskLevel,
      sensitive: result.sensitive,
      reasonCode: result.reasonCodes[0],
      themes: [...result.themes].sort(),
    }).toEqual({
      riskLevel: testCase.expect.riskLevel,
      sensitive: testCase.expect.sensitive,
      reasonCode: testCase.expect.reasonCode,
      themes: [...testCase.expect.themes].sort(),
    });
  });

  it("never offers quick approve for anything sensitive", () => {
    for (const testCase of cases) {
      const result = policy.classify(toReview(testCase));
      if (result.sensitive) {
        expect(result.recommendedAction).toBe("needs_review");
      }
    }
  });
});
