/**
 * Fails if the Vitest JSON report shows any skipped, pending or todo test, or
 * no tests at all. A green check must mean every test actually ran.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "test-results/vitest.json";
const report = JSON.parse(readFileSync(file, "utf8")) as {
  numTotalTests: number;
  numPassedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  numFailedTests: number;
};

const notRun = report.numPendingTests + report.numTodoTests;
console.log(
  `Tests: ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${notRun} skipped or todo, of ${report.numTotalTests}.`,
);
if (report.numTotalTests === 0 || notRun > 0 || report.numPassedTests !== report.numTotalTests) {
  console.error("Every test must run and pass. Remove skips rather than letting them pass silently.");
  process.exitCode = 1;
}
