import type { TriagePolicy } from "@/lib/interfaces/triagePolicy";
import type { Review } from "@/lib/types";
import type { SensitiveReasonCode } from "@/lib/triage/rules";

/**
 * One labelled routing case. The label states what a careful human would
 * need, not what the rules currently do:
 *
 * - `mustReview`: a person has to read this before any reply goes out.
 * - `sensitive`: the sensitive category it belongs to, or null.
 */
export interface RoutingEvalCase {
  id: string;
  stars: number;
  text: string;
  expect: { mustReview: boolean; sensitive: SensitiveReasonCode | null };
  tags: string[];
  note?: string;
}

export interface RecallCell {
  total: number;
  flagged: number;
  recall: number | null;
}

export interface RoutingEvalReport {
  policyVersion: string;
  cases: number;
  /** The safety metric: a case a human must read was offered as a one-click approve. */
  unsafeQuickApprove: { count: number; ids: string[] };
  /** Share of sensitive cases the policy flagged `sensitive` at all. */
  sensitiveRecall: RecallCell;
  sensitiveRecallByCategory: Record<string, RecallCell>;
  /** Sensitive cases flagged sensitive but filed under a different category. */
  sensitiveCategoryMismatch: { count: number; ids: string[] };
  /** Sensitive cases not flagged sensitive. Still reviewed unless also listed as unsafe. */
  sensitiveMissed: { count: number; ids: string[] };
  /** Non-sensitive cases the policy flagged sensitive (idioms, figures of speech). */
  sensitiveFalseFlag: { count: number; ids: string[] };
  /** Cases safe to quick-approve that were sent to review: the workload cost of caution. */
  falseAlarm: { count: number; of: number; rate: number | null; ids: string[] };
  byTag: Record<string, { cases: number; unsafeQuickApprove: number; falseAlarm: number }>;
  /** B1 shadow: cases a human must read that the shadow rule would have auto-sent. */
  shadowUnsafeAutoSend: { count: number; ids: string[] };
}

function cell(total: number, flagged: number): RecallCell {
  return { total, flagged, recall: total === 0 ? null : flagged / total };
}

function toReview(testCase: RoutingEvalCase): Pick<Review, "id" | "stars" | "text"> {
  return { id: testCase.id, stars: testCase.stars as Review["stars"], text: testCase.text };
}

/** Pure: same policy and cases in, same report out. No clock, no I/O. */
export function evaluateRouting(policy: TriagePolicy, cases: RoutingEvalCase[]): RoutingEvalReport {
  const unsafe: string[] = [];
  const mismatch: string[] = [];
  const missed: string[] = [];
  const falseFlag: string[] = [];
  const falseAlarm: string[] = [];
  const shadowUnsafe: string[] = [];
  const perCategory = new Map<string, { total: number; flagged: number }>();
  const byTag: RoutingEvalReport["byTag"] = {};
  let sensitiveTotal = 0;
  let sensitiveFlagged = 0;
  let safeTotal = 0;
  let policyVersion = "unknown";

  for (const testCase of cases) {
    const result = policy.classify(toReview(testCase));
    policyVersion = result.policyVersion;
    const quick = result.recommendedAction === "quick_approve";
    const isUnsafe = testCase.expect.mustReview && quick;
    const isFalseAlarm = !testCase.expect.mustReview && !quick;

    if (isUnsafe) unsafe.push(testCase.id);
    if (testCase.expect.mustReview && result.shadow?.wouldAutoSend) shadowUnsafe.push(testCase.id);
    if (!testCase.expect.mustReview) {
      safeTotal += 1;
      if (isFalseAlarm) falseAlarm.push(testCase.id);
    }

    const category = testCase.expect.sensitive;
    if (category) {
      sensitiveTotal += 1;
      const bucket = perCategory.get(category) ?? { total: 0, flagged: 0 };
      bucket.total += 1;
      if (result.sensitive) {
        sensitiveFlagged += 1;
        bucket.flagged += 1;
        if (result.reasonCodes[0] !== category) mismatch.push(testCase.id);
      } else {
        missed.push(testCase.id);
      }
      perCategory.set(category, bucket);
    } else if (result.sensitive) {
      falseFlag.push(testCase.id);
    }

    for (const tag of testCase.tags) {
      const entry = (byTag[tag] ??= { cases: 0, unsafeQuickApprove: 0, falseAlarm: 0 });
      entry.cases += 1;
      if (isUnsafe) entry.unsafeQuickApprove += 1;
      if (isFalseAlarm) entry.falseAlarm += 1;
    }
  }

  const sensitiveRecallByCategory: Record<string, RecallCell> = {};
  for (const [category, bucket] of [...perCategory.entries()].sort()) {
    sensitiveRecallByCategory[category] = cell(bucket.total, bucket.flagged);
  }

  return {
    policyVersion,
    cases: cases.length,
    unsafeQuickApprove: { count: unsafe.length, ids: unsafe },
    sensitiveRecall: cell(sensitiveTotal, sensitiveFlagged),
    sensitiveRecallByCategory,
    sensitiveCategoryMismatch: { count: mismatch.length, ids: mismatch },
    sensitiveMissed: { count: missed.length, ids: missed },
    sensitiveFalseFlag: { count: falseFlag.length, ids: falseFlag },
    falseAlarm: {
      count: falseAlarm.length,
      of: safeTotal,
      rate: safeTotal === 0 ? null : falseAlarm.length / safeTotal,
      ids: falseAlarm,
    },
    byTag,
    shadowUnsafeAutoSend: { count: shadowUnsafe.length, ids: shadowUnsafe },
  };
}

export interface RoutingThresholds {
  maxUnsafeQuickApprove: number;
  maxShadowUnsafeAutoSend: number;
  minSensitiveRecall: number;
  minSensitiveRecallPerCategory: number;
  maxFalseAlarmRate: number;
}

/** Every threshold breach as a readable line. Empty means the gate passes. */
export function checkThresholds(report: RoutingEvalReport, limits: RoutingThresholds): string[] {
  const failures: string[] = [];
  if (report.unsafeQuickApprove.count > limits.maxUnsafeQuickApprove)
    failures.push(
      `unsafe quick approvals ${report.unsafeQuickApprove.count} > ${limits.maxUnsafeQuickApprove} (${report.unsafeQuickApprove.ids.join(", ")})`,
    );
  if (report.shadowUnsafeAutoSend.count > limits.maxShadowUnsafeAutoSend)
    failures.push(
      `shadow auto-send on must-review cases ${report.shadowUnsafeAutoSend.count} > ${limits.maxShadowUnsafeAutoSend} (${report.shadowUnsafeAutoSend.ids.join(", ")})`,
    );
  const overall = report.sensitiveRecall.recall;
  if (overall !== null && overall < limits.minSensitiveRecall)
    failures.push(`sensitive recall ${overall.toFixed(2)} < ${limits.minSensitiveRecall}`);
  for (const [category, value] of Object.entries(report.sensitiveRecallByCategory)) {
    if (value.recall !== null && value.recall < limits.minSensitiveRecallPerCategory)
      failures.push(
        `${category} recall ${value.recall.toFixed(2)} < ${limits.minSensitiveRecallPerCategory}`,
      );
  }
  const alarm = report.falseAlarm.rate;
  if (alarm !== null && alarm > limits.maxFalseAlarmRate)
    failures.push(`false alarm rate ${alarm.toFixed(2)} > ${limits.maxFalseAlarmRate}`);
  return failures;
}
