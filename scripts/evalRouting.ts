import fs from "node:fs";
import path from "node:path";
import {
  checkThresholds,
  evaluateRouting,
  type RoutingEvalCase,
  type RoutingThresholds,
} from "@/lib/evals/routingEval";
import { DefaultTriagePolicy } from "@/lib/triage/policy";

/**
 * Routing evaluation. Runs the current policy over the labelled dev and
 * holdout sets, writes a JSON report, and exits non-zero if a threshold in
 * evals/routing/thresholds.json is breached.
 *
 *   npm run eval              gate against thresholds
 *   npm run eval -- --report-only   measure without gating (used for baselines)
 */
const root = process.cwd();
const dir = path.join(root, "evals", "routing");
const reportOnly = process.argv.includes("--report-only");

function load<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as T;
}

const thresholds = load<Record<string, RoutingThresholds>>("thresholds.json");
delete thresholds._comment;
const policy = new DefaultTriagePolicy();
const pct = (value: number | null) => (value === null ? "n/a" : `${Math.round(value * 100)}%`);

let failed = false;
const output: Record<string, unknown> = {};

for (const split of ["dev", "holdout"]) {
  const report = evaluateRouting(policy, load<RoutingEvalCase[]>(`${split}.json`));
  output[split] = report;
  console.log(`\n${split} (${report.cases} cases, ${report.policyVersion})`);
  console.log(`  unsafe quick approvals : ${report.unsafeQuickApprove.count} ${report.unsafeQuickApprove.ids.join(" ")}`);
  console.log(`  sensitive recall       : ${pct(report.sensitiveRecall.recall)} (${report.sensitiveRecall.flagged}/${report.sensitiveRecall.total})`);
  for (const [category, value] of Object.entries(report.sensitiveRecallByCategory))
    console.log(`    ${category.padEnd(26)}: ${pct(value.recall)} (${value.flagged}/${value.total})`);
  console.log(`  sensitive missed       : ${report.sensitiveMissed.count} ${report.sensitiveMissed.ids.join(" ")}`);
  console.log(`  sensitive false flags  : ${report.sensitiveFalseFlag.count} ${report.sensitiveFalseFlag.ids.join(" ")}`);
  console.log(`  false alarm rate       : ${pct(report.falseAlarm.rate)} (${report.falseAlarm.count}/${report.falseAlarm.of}) ${report.falseAlarm.ids.join(" ")}`);
  console.log(`  shadow auto-send unsafe: ${report.shadowUnsafeAutoSend.count} ${report.shadowUnsafeAutoSend.ids.join(" ")}`);

  if (!reportOnly) {
    const failures = checkThresholds(report, thresholds[split]);
    for (const failure of failures) console.error(`  FAIL ${split}: ${failure}`);
    if (failures.length > 0) failed = true;
  }
}

const outDir = path.join(root, "evals", "reports");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, reportOnly ? "baseline.json" : "latest.json");
fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(`\nReport written to ${path.relative(root, outFile)}`);

if (failed) {
  console.error("\nRouting eval gate FAILED.");
  process.exit(1);
}
if (!reportOnly) console.log("Routing eval gate passed.");
