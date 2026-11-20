/** Dry by default. --yes authorizes external requests only when explicit bounds and a new private output are supplied. */
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { loadGoldenFixtures, fixtureToReview, evaluate, summarize, checkThresholds } from "@/lib/eval/goldenEval";
import { cleanSourceCommit, evidenceBinding, validateRecording } from "@/lib/eval/readerEvidence";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { ReadingRecorder, cascadeFromCache } from "@/lib/triage/reader/cachedReader";
import { liveReaderFromEnv } from "@/lib/triage/reader/fromEnv";
import { DEFAULT_READER_MODEL, DEFAULT_ESCALATION_MODEL } from "@/lib/triage/reader/claudeReader";
import { cascadeReaderId } from "@/lib/triage/reader/cascade";
import { RunBudget } from "@/lib/triage/reader/runBudget";
import { REQUEST_CONTRACT } from "@/lib/triage/reader/requestContract";
import { costUsd, usageSummary } from "@/lib/triage/reader/pricing";
import { triageReview } from "@/lib/triage/triageReview";
import type { Review } from "@/lib/types";

class RunInputError extends Error {}

const GOLDEN = "tests/fixtures/golden/risk_classifier_v1.jsonl";

function options(args: string[]) {
  const target = args[0];
  if (target !== "golden" && target !== "demo") throw new RunInputError("Target must be golden or demo");
  const values = new Map<string, string>();
  let yes = false;
  for (let i = 1; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--yes" && !yes) { yes = true; continue; }
    if (!["--out", "--max-cost-usd", "--max-calls"].includes(flag) || values.has(flag) || !args[i + 1] || args[i + 1].startsWith("--")) throw new RunInputError("Invalid, duplicate or incomplete argument");
    values.set(flag, args[++i]);
  }
  return { target, yes, out: values.get("--out"), maxCostUsd: Number(values.get("--max-cost-usd")), maxCalls: Number(values.get("--max-calls")) };
}
function assertNewPrivateOutput(out: string) {
  if (!path.isAbsolute(out)) throw new RunInputError("Output must be an absolute path outside the repository");
  let parent = path.dirname(out);
  while (!existsSync(parent)) parent = path.dirname(parent);
  const relative = path.relative(realpathSync(process.cwd()), realpathSync(parent));
  if (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new RunInputError("Output must be outside the repository");
  try { lstatSync(out); throw new RunInputError("Output already exists; never overwrite evidence"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
async function main() {
  const opts = options(process.argv.slice(2));
  const dataset = opts.target === "golden" ? GOLDEN : "data/fixtures/reviews.json";
  const golden = opts.target === "golden" ? loadGoldenFixtures(dataset) : [];
  const reviews: Review[] = opts.target === "golden" ? golden.map(fixtureToReview) : JSON.parse(readFileSync(dataset, "utf8"));
  const binding = evidenceBinding(dataset, reviews);
  const primary = process.env.CCR_READER_MODEL || DEFAULT_READER_MODEL;
  const escalationSetting = process.env.CCR_READER_ESCALATION_MODEL || DEFAULT_ESCALATION_MODEL;
  const escalation = escalationSetting === "off" ? null : escalationSetting;
  const models = escalation ? [primary, escalation] : [primary];
  if (primary === escalation) throw new RunInputError("Primary and escalation models must differ");
  const n = reviews.filter((r) => r.text.trim()).length;
  const estimate = models.reduce((sum, model) => {
    const cost = costUsd(model, { inputTokens: 900, outputTokens: 400 });
    if (cost === null) throw new RunInputError("Unqualified model price");
    return sum + cost * n;
  }, 0);
  const reservation = models.reduce((sum, model) => sum + costUsd(model, { inputTokens: REQUEST_CONTRACT.maxInputTokens, outputTokens: REQUEST_CONTRACT.maxOutputTokens })! * n, 0);
  console.log(`${n} non-empty reviews; ${cascadeReaderId(primary, escalation)}.`);
  console.log(`Estimate at 900 input / 400 output tokens per call: $${estimate.toFixed(5)} (not a ceiling).`);
  console.log(`Full reservation at input/output bounds: $${reservation.toFixed(5)}; at most ${n * models.length} generation and ${n * models.length} token-count requests.`);
  console.log(`Endpoint ${REQUEST_CONTRACT.endpoint}; retries 0; server fallback off; request timeout 60s; run timeout 30m.`);
  if (!opts.yes) {
    console.log("Dry run: no client created, no requests sent, no files written. Live execution needs --yes --max-cost-usd <budget> --max-calls <limit> --out <new-absolute-private-path> and separate owner approval.");
    return;
  }
  if (!opts.out) throw new RunInputError("An explicit private output path is required");
  assertNewPrivateOutput(opts.out);
  if (!Number.isFinite(opts.maxCostUsd) || opts.maxCostUsd <= 0 || !Number.isSafeInteger(opts.maxCalls) || opts.maxCalls <= 0) throw new RunInputError("Explicit positive --max-cost-usd and --max-calls values are required");
  const budget = new RunBudget(opts.maxCostUsd, opts.maxCalls);
  if (opts.maxCalls > n * models.length) throw new RunInputError("Call limit exceeds dataset/model bound");
  if (!process.env.ANTHROPIC_API_KEY) throw new RunInputError("Owner API key is not configured");
  let sourceCommit: string;
  try { sourceCommit = cleanSourceCommit(); } catch { throw new RunInputError("Commit the reviewed local patch before a live run"); }
  const recorder = new ReadingRecorder();
  const reader = liveReaderFromEnv(process.env, { budget, wrap: (model) => {
    const recorded = recorder.wrap(model);
    return { model: model.model, attempt: async (review) => {
      const attempt = await recorded.attempt(review);
      budget.observe(attempt); // A failure stops this experiment even if application recovery is possible.
      return attempt;
    } };
  } });
  let completed = false;
  try {
    for (const review of reviews) {
      budget.assertActive();
      const result = await triageReview(review, new DefaultTriagePolicy(), reader);
      budget.assertActive();
      if (result.reasonCodes.includes("reader_failed")) throw new RunInputError("A reader attempt failed");
    }
    completed = true;
  } catch { console.error(`Run stopped: ${budget.stopped ?? "reader failure"}. Evidence is incomplete; no automatic retry.`); }
  const evidence = { ...binding, sourceCommit, maxCostUsd: opts.maxCostUsd, maxCalls: opts.maxCalls, tokenCountCalls: budget.tokenCountCalls, generationCalls: budget.calls, completed };
  recorder.save(opts.out, reader, evidence);
  console.log(`Saved ${completed ? "complete" : "incomplete"} private recording. Generation calls: ${budget.calls}; token-count calls: ${budget.tokenCountCalls}.`);
  if (!completed) { process.exitCode = 1; return; }
  const cache = recorder.snapshot(reader, evidence);
  const integrity = validateRecording(cache, reviews, binding, reader.id);
  const replay = cascadeFromCache(cache);
  if (opts.target === "golden") {
    const outcomes = await evaluate(golden, new DefaultTriagePolicy(), replay);
    const usage = usageSummary(replay.stats);
    const metrics = { ...summarize(outcomes), readerFailures: integrity.attemptFailures, costPerReviewUsd: usage.costPerReviewUsd };
    const config = JSON.parse(readFileSync("eval/thresholds.json", "utf8"));
    const breaches = checkThresholds(metrics, config.modes.rules_plus_reader);
    console.log(`Golden exact match (including category): ${metrics.exactMatch}/${metrics.cases}; unsafe quick approvals: ${metrics.unsafeQuickApprove}; sensitive recall: ${metrics.sensitiveRecall}; attempt failures: ${integrity.attemptFailures}; recorded mean cost/read: $${usage.costPerReviewUsd.toFixed(5)}.`);
    console.log(`Threshold comparison: ${breaches.length ? "FAIL" : "PASS"}; this is not production approval.`);
    if (breaches.length) process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error instanceof RunInputError ? error.message : "Reader run failed preflight or evidence validation. No result approved; inspect settings and private output before retry."); process.exitCode = 1; });
