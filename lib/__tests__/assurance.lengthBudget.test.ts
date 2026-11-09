import { describe, expect, it } from "vitest";
import { checkLengthBand, GOOGLE_REPLY_MAX_BYTES, lengthUnits, utf8Bytes } from "@/lib/assurance/length";
import { CaseBudget, checkModelCall } from "@/lib/assurance/budget";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("byte cap", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(utf8Bytes("a")).toBe(1);
    expect(utf8Bytes("好")).toBe(3);
    expect(utf8Bytes("👍")).toBe(4);
  });

  it("puts the Chinese ceiling at 1,365 characters", () => {
    expect(utf8Bytes("谢".repeat(1365))).toBeLessThanOrEqual(GOOGLE_REPLY_MAX_BYTES);
    expect(utf8Bytes("谢".repeat(1366))).toBeGreaterThan(GOOGLE_REPLY_MAX_BYTES);
  });
});

describe("length band (proposed values)", () => {
  it("a one-word review still gets the floor", () => {
    const band = checkLengthBand("Terrible.", "Sorry to hear that.", "en", false);
    expect(band.minUnits).toBe(15);
    expect(band.status).toBe("below_band");
  });

  it("a 600-word review is capped at the ceiling, not mirrored", () => {
    const band = checkLengthBand(words(600), words(300), "en", false);
    expect(band.maxUnits).toBe(150);
    expect(band.status).toBe("above_band");
  });

  it("escalated cases use the lower ceiling", () => {
    expect(checkLengthBand(words(600), words(100), "en", true).maxUnits).toBe(80);
  });

  it("counts characters for Chinese and words for English", () => {
    expect(lengthUnits("服务很好但是咖啡太酸", "zh-Hans")).toEqual({ unit: "chars", count: 10 });
    expect(lengthUnits("Service good, coffee sour", "en-SG")).toEqual({ unit: "words", count: 4 });
  });

  it("flags the hard cap separately from the band", () => {
    expect(checkLengthBand("Bad.", "谢".repeat(1366), "zh", false).hardCapExceeded).toBe(true);
  });
});

describe("token budgets (proposed values)", () => {
  it("F-32: a truncated output abstains instead of being forwarded", () => {
    const verdict = checkModelCall({ stage: "suggested_edit", inputTokens: 900, outputTokens: 400, stopReason: "max_tokens" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.abstain).toBe("budget_exceeded");
  });

  it("F-32: an output over its stage budget abstains", () => {
    const verdict = checkModelCall({ stage: "interpretation", inputTokens: 900, outputTokens: 1501, stopReason: "end_turn" });
    expect(verdict.ok).toBe(false);
  });

  it("stops the case when retries push it past the 20k ceiling", () => {
    const budget = new CaseBudget();
    const call = { stage: "suggested_edit" as const, inputTokens: 5000, outputTokens: 1000, stopReason: "end_turn" };
    expect(budget.record(call).ok).toBe(true); // 6,000
    expect(budget.record(call).ok).toBe(true); // 12,000
    expect(budget.record(call).ok).toBe(true); // 18,000
    expect(budget.record(call).ok).toBe(false); // 24,000
    expect(budget.tokensUsed).toBe(24000);
  });
});
