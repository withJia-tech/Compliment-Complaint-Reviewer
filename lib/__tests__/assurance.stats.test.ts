import { describe, expect, it } from "vitest";
import {
  binomialCdf,
  casesNeededForBound,
  describeResult,
  failureRateUpperBound,
  zeroFailureUpperBound,
} from "@/lib/assurance/stats";

describe("exact bounds for reporting test results", () => {
  it("0 misses in 6 safety cases still allows a miss rate up to about 39%", () => {
    expect(zeroFailureUpperBound(6)).toBeCloseTo(0.393, 3);
    expect(zeroFailureUpperBound(12)).toBeCloseTo(0.221, 3);
    expect(zeroFailureUpperBound(60)).toBeCloseTo(0.0487, 3);
  });

  it("matches the Clopper–Pearson bound when there are no failures", () => {
    expect(failureRateUpperBound(0, 6)).toBeCloseTo(zeroFailureUpperBound(6), 6);
  });

  it("gives the known Clopper–Pearson value for 1 failure in 10", () => {
    expect(failureRateUpperBound(1, 10)).toBeCloseTo(0.3942, 3);
  });

  it("a 10% bound needs 29 zero-failure cases", () => {
    expect(casesNeededForBound(0.1)).toBe(29);
    expect(zeroFailureUpperBound(29)).toBeLessThanOrEqual(0.1);
    expect(zeroFailureUpperBound(28)).toBeGreaterThan(0.1);
  });

  it("computes a stable binomial CDF", () => {
    expect(binomialCdf(10, 10, 0.3)).toBeCloseTo(1, 9);
    expect(binomialCdf(0, 1000, 0.01)).toBeCloseTo(Math.pow(0.99, 1000), 9);
  });

  it("describes a result as count plus bound", () => {
    expect(describeResult(0, 6)).toBe("0 of 6 failed (95% upper bound 39.3%)");
  });
});
