/**
 * Golden evaluation gate. Runs the golden dataset in two modes and fails if
 * any metric breaches eval/thresholds.json:
 *
 * - rules_only:        keyword rules and guards, no key (what anyone gets)
 * - rules_plus_reader: the same plus the second reader, replayed from the
 *                      committed evaluation run. Missing or stale readings fail.
 *
 * With --base <file> it also fails if any limit is looser than in <file>
 * (the base branch's thresholds), unless loosening_reason is filled in.
 *
 * Writes eval-report/report.json and eval-report/report.md, and appends the
 * summary to $GITHUB_STEP_SUMMARY when set. Reports carry fixture ids and
 * labels only: never review text, personal details or the model's prose.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type Breach,
  type CaseOutcome,
  type EvalMetrics,
  type ModeThresholds,
  checkReadingsIdentity,
  checkThresholds,
  evaluate,
  loadGoldenFixtures,
  loosenedLimits,
  summarize,
} from "@/lib/eval/goldenEval";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { type ReadingCacheFile, cascadeFromCache, loadReadingCache } from "@/lib/triage/reader/cachedReader";
import { defaultReaderId } from "@/lib/triage/reader/fromEnv";
import { usageSummary } from "@/lib/triage/reader/pricing";

interface ThresholdsFile {
  dataset: string;
  readings: string;
  loosening_reason: string;
  modes: Record<string, ModeThresholds>;
}

interface ModeResult {
  mode: string;
  status: "pass" | "fail" | "not_run";
  note: string;
  metrics: EvalMetrics | null;
  breaches: Breach[];
  outcomes: CaseOutcome[];
}

const OUT_DIR = "eval-report";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function usd(n: number | undefined): string {
  if (n === undefined) return "—";
  return Number.isFinite(n) ? `$${n.toFixed(5)}` : "unknown";
}

function markdown(results: ModeResult[], loosened: string[], reason: string, passed: boolean): string {
  const lines = [`## Golden evaluation gate: ${passed ? "PASSED" : "FAILED"}`, ""];
  lines.push(
    "| Mode | Status | Exact match | Sensitive recall | Unsafe quick approve | False alarms | Reader failures | Cost / review | Escalated |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const m = r.metrics;
    lines.push(
      m
        ? `| ${r.mode} | ${r.status} | ${m.exactMatch}/${m.cases} (${pct(m.exactMatchRate)}) | ${pct(m.sensitiveRecall)} | ${m.unsafeQuickApprove} | ${m.falseAlarm} | ${m.readerFailures} | ${usd(m.costPerReviewUsd)} | ${m.escalations ?? "—"} |`
        : `| ${r.mode} | ${r.status} | — | — | — | — | — | — | — |`,
    );
  }
  for (const r of results) {
    if (r.note) lines.push("", `**${r.mode}:** ${r.note}`);
    for (const b of r.breaches) lines.push(`- ${r.mode}: \`${b.metric}\` is ${b.actual}, limit ${b.limit}`);
    const misses = r.outcomes.filter((o) => !o.exactMatch);
    if (misses.length > 0) {
      lines.push("", `<details><summary>${r.mode}: ${misses.length} mismatched fixture(s)</summary>`, "");
      lines.push("| Fixture | Family | Expected | Got | Lead reason | Reader |", "|---|---|---|---|---|---|");
      for (const o of misses) {
        const exp = `${o.expected.action}/${o.expected.risk}${o.expected.sensitive ? "/sensitive" : ""}`;
        const got = `${o.actual.action}/${o.actual.risk}${o.actual.sensitive ? "/sensitive" : ""}`;
        lines.push(`| ${o.fixtureId}${o.unsafeQuickApprove ? " ⚠" : ""} | ${o.family} | ${exp} | ${got} | ${o.actual.leadingReason} | ${o.readerConcern ?? "—"} |`);
      }
      lines.push("", "</details>");
    }
  }
  if (loosened.length > 0) {
    lines.push("", `**Thresholds loosened vs base branch:** ${loosened.join("; ")}`);
    lines.push(reason ? `Reason given: ${reason}` : "No loosening_reason given, so this fails the gate.");
  }
  lines.push("", "⚠ = expected needs review but got quick approve. Reports list fixture ids only, never review text.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const basePath = baseIndex >= 0 ? args[baseIndex + 1] : null;

  const config = JSON.parse(readFileSync("eval/thresholds.json", "utf8")) as ThresholdsFile;
  const fixtures = loadGoldenFixtures(config.dataset);
  const policy = new DefaultTriagePolicy();
  const results: ModeResult[] = [];

  // Mode 1: rules only.
  {
    const outcomes = await evaluate(fixtures, policy, null);
    const metrics: EvalMetrics = { ...summarize(outcomes), costPerReviewUsd: 0 };
    const breaches = checkThresholds(metrics, config.modes.rules_only);
    results.push({ mode: "rules_only", status: breaches.length ? "fail" : "pass", note: "", metrics, breaches, outcomes });
  }

  // Mode 2: rules + reader, replayed from the committed evaluation run.
  {
    const expectedReaderId = defaultReaderId();
    const rerun = "Run `npm run read:golden -- --yes` with your own key and commit the file.";
    const notRun = (status: "fail" | "not_run", note: string) =>
      results.push({ mode: "rules_plus_reader", status, note, metrics: null, breaches: [], outcomes: [] });

    let cache: ReadingCacheFile | null = null;
    let invalid = "";
    try {
      cache = loadReadingCache(config.readings);
    } catch (error) {
      invalid = error instanceof Error ? error.message : "unreadable";
    }
    const identity = checkReadingsIdentity(cache, expectedReaderId);

    if (invalid) notRun("fail", `${invalid} A run that cannot be validated is never replayed.`);
    else if (identity.status === "missing")
      notRun("not_run", `No evaluation run at ${config.readings}. ${rerun} A missing run fails the gate: it is never treated as a pass.`);
    else if (identity.status === "stale") notRun("fail", `${identity.note} ${rerun}`);
    else if (cache) {
      const reader = cascadeFromCache(cache);
      const outcomes = await evaluate(fixtures, policy, reader);
      const usage = usageSummary(reader.stats);
      const metrics: EvalMetrics = {
        ...summarize(outcomes),
        costPerReviewUsd: usage.costPerReviewUsd,
        escalations: reader.stats.escalations,
      };
      const breaches = checkThresholds(metrics, config.modes.rules_plus_reader);
      const priceNote = usage.unknownPriceModels.length
        ? ` No price for ${usage.unknownPriceModels.join(", ")}: cost cannot be measured, which fails.`
        : "";
      results.push({
        mode: "rules_plus_reader",
        status: breaches.length ? "fail" : "pass",
        note: `Replayed from ${cache.readerId}, recorded ${cache.createdAt}. ${reader.stats.escalations} of ${reader.stats.reads} reviews escalated.${priceNote}`,
        metrics,
        breaches,
        outcomes,
      });
    }
  }

  // Ratchet: thresholds may only tighten relative to the base branch.
  let loosened: string[] = [];
  if (basePath && existsSync(basePath)) {
    const base = JSON.parse(readFileSync(basePath, "utf8")) as ThresholdsFile;
    loosened = loosenedLimits(base.modes, config.modes);
  }

  const passed =
    results.every((r) => r.status === "pass") && (loosened.length === 0 || config.loosening_reason.trim() !== "");
  const md = markdown(results, loosened, config.loosening_reason.trim(), passed);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, "report.json"),
    `${JSON.stringify({ passed, generatedAt: new Date().toISOString(), loosened, results }, null, 2)}\n`,
  );
  writeFileSync(path.join(OUT_DIR, "report.md"), md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

  console.log(md);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Evaluation gate crashed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
