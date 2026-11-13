/**
 * Runs reviews through the second reader with YOUR key and saves every model
 * attempt, so the demo and the evaluation gate can replay them for free.
 *
 *   npm run read:golden -- --yes   # the 49-review golden dataset (the evaluation run)
 *   npm run read:demo -- --yes     # the app's demo reviews (for CCR_READER=cache)
 *
 * The default reader is Claude Haiku 5.5 on every review, with the uncertain
 * ones escalated to Claude Sonnet 5.5. To compare another set-up, set
 * CCR_READER_MODEL / CCR_READER_ESCALATION_MODEL (or "off") and pass
 * --out <file>: a non-default run never overwrites the committed one.
 *
 * Without --yes it only prints how many reviews it would read and a cost ceiling.
 * Needs ANTHROPIC_API_KEY in your environment or .env.local. Never commit a key.
 * Prints fixture ids and labels only, never review text.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import demoReviews from "@/data/fixtures/reviews.json";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { ReadingRecorder } from "@/lib/triage/reader/cachedReader";
import { DEFAULT_DEMO_CACHE, defaultReaderId, liveReaderFromEnv } from "@/lib/triage/reader/fromEnv";
import { costUsd, usageSummary } from "@/lib/triage/reader/pricing";
import { triageReview } from "@/lib/triage/triageReview";
import type { RecommendedAction, Review, RiskLevel } from "@/lib/types";

// Rough per-review token use at low effort: the fixed instructions plus one review in, a short reading out.
const EST = { inputTokens: 900, outputTokens: 400 };
const COST_LIMIT_USD = 0.01;

interface GoldenFixture {
  fixture_id: string;
  stars: number;
  review_text: string;
  expected_primary_action: RecommendedAction;
  expected_risk_level: RiskLevel;
  expected_sensitive: boolean;
}

const GOLDEN = path.join("tests", "fixtures", "golden", "risk_classifier_v1.jsonl");
const GOLDEN_READINGS = path.join("tests", "fixtures", "golden", "readings", "risk_classifier_v1.json");

function loadGolden(): GoldenFixture[] {
  return readFileSync(GOLDEN, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldenFixture);
}

function asReview(id: string, stars: number, text: string): Review {
  return { id, locationId: "loc_001", author: "Reader", stars: stars as Review["stars"], text, createTime: "", updateTime: "" };
}

function money(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "unknown (model not in the price table)" : `$${n.toFixed(5)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];
  const confirmed = args.includes("--yes");
  const outIndex = args.indexOf("--out");
  const outArg = outIndex >= 0 ? args[outIndex + 1] : null;
  if (target !== "golden" && target !== "demo") {
    console.error("Usage: tsx scripts/readReviews.ts <golden|demo> [--yes] [--out <file>]");
    process.exitCode = 1;
    return;
  }

  const golden = target === "golden" ? loadGolden() : [];
  const reviews =
    target === "golden" ? golden.map((f) => asReview(f.fixture_id, f.stars, f.review_text)) : (demoReviews as Review[]);
  const toRead = reviews.filter((r) => r.text.trim() !== "");

  const recorder = new ReadingRecorder();
  const reader = liveReaderFromEnv(process.env, { wrap: (m) => recorder.wrap(m) });
  const isDefault = reader.id === defaultReaderId();
  const out = outArg ?? (isDefault ? (target === "golden" ? GOLDEN_READINGS : DEFAULT_DEMO_CACHE) : null);
  if (!out) {
    console.error(`${reader.id} is not the default reader (${defaultReaderId()}).`);
    console.error("Pass --out <file> so this comparison run does not overwrite the committed evaluation run.");
    process.exitCode = 1;
    return;
  }

  const ceiling = reader.models.reduce<number | null>((sum, m) => {
    const c = costUsd(m, EST);
    return sum === null || c === null ? null : sum + c * toRead.length;
  }, 0);
  console.log(`${toRead.length} review(s) to read with ${reader.id}.`);
  console.log(`Cost ceiling if every review escalated: ${money(ceiling)}. Writes ${out}.`);
  if (!confirmed) {
    console.log("Nothing sent. Re-run with --yes to read them with your key.");
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Put it in .env.local or export it in your shell.");
    process.exitCode = 1;
    return;
  }

  const policy = new DefaultTriagePolicy();
  let failures = 0;
  let mismatches = 0;
  for (const review of reviews) {
    const result = await triageReview(review, policy, reader);
    if (result.reasonCodes.includes("reader_failed")) failures += 1;

    const fixture = golden.find((f) => f.fixture_id === review.id);
    if (!fixture) continue;
    const ok =
      result.recommendedAction === fixture.expected_primary_action &&
      result.riskLevel === fixture.expected_risk_level &&
      result.sensitive === fixture.expected_sensitive;
    if (!ok) {
      mismatches += 1;
      console.log(
        `  MISMATCH ${review.id}: got ${result.recommendedAction}/${result.riskLevel}/sensitive=${result.sensitive}` +
          `, expected ${fixture.expected_primary_action}/${fixture.expected_risk_level}/sensitive=${fixture.expected_sensitive}` +
          (result.reading ? ` (reader: ${result.reading.concern}/${result.reading.category})` : ""),
      );
    }
  }

  recorder.save(out, reader);
  const { stats } = reader;
  const summary = usageSummary(stats);
  console.log(`Saved ${out}.`);
  console.log(`Reader failures (held for review): ${failures}`);
  console.log(`Escalated: ${stats.escalations} of ${stats.reads} (${JSON.stringify(stats.escalationReasons)})`);
  for (const [model, t] of Object.entries(stats.byModel)) {
    console.log(`  ${model}: ${t.calls} call(s), ${t.inputTokens} in / ${t.outputTokens} out, ${money(costUsd(model, t))}`);
  }
  console.log(
    `Cost per review: ${money(summary.costPerReviewUsd)} (gate limit $${COST_LIMIT_USD}); total ${money(summary.totalCostUsd)}.`,
  );
  if (target === "golden") console.log(`Golden dataset: ${golden.length - mismatches}/${golden.length} match.`);
}

main().catch((error) => {
  console.error("Reading failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
