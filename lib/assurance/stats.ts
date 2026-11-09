// Exact binomial bounds for reporting test results (Acceptance plan fixes,
// items 1–2). A finite suite with no failures does not show a zero error
// rate; these functions say how high the true rate could still be.

/** One-sided upper confidence bound on a failure rate after 0 failures in n cases. */
export function zeroFailureUpperBound(n: number, confidence = 0.95): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError("n must be a positive integer");
  return 1 - Math.pow(1 - confidence, 1 / n);
}

/** Smallest number of zero-failure cases that brings the upper bound to `target` or below. */
export function casesNeededForBound(target: number, confidence = 0.95): number {
  if (!(target > 0 && target < 1)) throw new RangeError("target must be in (0, 1)");
  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - target));
}

function logSumExp(values: number[]): number {
  const max = Math.max(...values);
  if (max === -Infinity) return -Infinity;
  return max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0));
}

/** P(X ≤ k) for X ~ Binomial(n, p), computed in log space. */
export function binomialCdf(k: number, n: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  const logP = Math.log(p);
  const logQ = Math.log1p(-p);
  const terms: number[] = [];
  let logPmf = n * logQ; // i = 0
  for (let i = 0; i <= k; i++) {
    terms.push(logPmf);
    logPmf += Math.log(n - i) - Math.log(i + 1) + logP - logQ;
  }
  return Math.min(1, Math.exp(logSumExp(terms)));
}

/**
 * Clopper–Pearson one-sided upper bound on a failure rate after k failures
 * in n cases. Equals zeroFailureUpperBound when k = 0.
 */
export function failureRateUpperBound(k: number, n: number, confidence = 0.95): number {
  if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(k) || k < 0 || k > n) {
    throw new RangeError("need integers with 0 ≤ k ≤ n and n > 0");
  }
  if (k === n) return 1;
  const alpha = 1 - confidence;
  let lo = k / n;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (binomialCdf(k, n, mid) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** "0 of 6 failed (95% upper bound 39.3%)". */
export function describeResult(failures: number, cases: number, confidence = 0.95): string {
  const bound = failureRateUpperBound(failures, cases, confidence);
  return `${failures} of ${cases} failed (${Math.round(confidence * 100)}% upper bound ${(bound * 100).toFixed(1)}%)`;
}
