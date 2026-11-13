/**
 * Runs reviews through the Claude second reader with YOUR key and saves the
 * readings, so the demo and the golden test can replay them for free.
 *
 *   npm run read:golden -- --yes   # the 49-review golden dataset (an evaluation run)
 *   npm run read:demo -- --yes     # the app's demo reviews (for CCR_READER=cache)
 *
 * Without --yes it only prints how many reviews it would read and a rough cost.
 * Needs ANTHROPIC_API_KEY in your environment or .env.local. Never commit a key.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import demoReviews from "@/data/fixtures/reviews.json";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { RecommendedAction, Review, RiskLevel } from "@/lib/types";
import { RecordingReviewReader } from "@/lib/triage/reader/cachedReader";
import { ClaudeReviewReader } from "@/lib/triage/reader/claudeReader";
import { DEFAULT_DEMO_CACHE } from "@/lib/triage/reader/fromEnv";
import { triageReview } from "@/lib/triage/triageReview";

// $ per million tokens (input, output). Check current pricing before relying on these.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
// Rough per-review token use at low effort: the fixed instructions plus one review in, a short reading out.
const EST_INPUT = 900;
const EST_OUTPUT = 400;

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

function dollars(model: string, input: number, output: number): string {
  const price = PRICES[model];
  return price ? `$${((input * price[0] + output * price[1]) / 1_000_000).toFixed(4)}` : "unknown (model not in price table)";
}

async function main() {
  const [target, flag] = process.argv.slice(2);
  if (target !== "golden" && target !== "demo") {
    console.error("Usage: tsx scripts/readReviews.ts <golden|demo> [--yes]");
    process.exitCode = 1;
    return;
  }

  const golden = target === "golden" ? loadGolden() : [];
  const reviews =
    target === "golden"
      ? golden.map((f) => asReview(f.fixture_id, f.stars, f.review_text))
      : (demoReviews as Review[]);
  const toRead = reviews.filter((r) => r.text.trim() !== "");
  const live = new ClaudeReviewReader();

  console.log(`${toRead.length} review(s) to read with ${live.model}.`);
  console.log(`Rough cost: ${dollars(live.model, toRead.length * EST_INPUT, toRead.length * EST_OUTPUT)}`);
  if (flag !== "--yes") {
    console.log("Nothing sent. Re-run with --yes to read them with your key.");
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Put it in .env.local or export it in your shell.");
    process.exitCode = 1;
    return;
  }

  const out = target === "golden" ? GOLDEN_READINGS : DEFAULT_DEMO_CACHE;
  const recorder = new RecordingReviewReader(live, out);
  const policy = new DefaultTriagePolicy();
  let failures = 0;
  let mismatches = 0;

  for (const review of reviews) {
    const result = await triageReview(review, policy, recorder);
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

  recorder.save();
  console.log(`Saved ${out}.`);
  console.log(`Reader failures (held for review): ${failures}`);
  if (target === "golden") console.log(`Golden dataset: ${golden.length - mismatches}/${golden.length} match.`);
  console.log(`Actual tokens: ${live.usage.inputTokens} in, ${live.usage.outputTokens} out, about ${dollars(live.model, live.usage.inputTokens, live.usage.outputTokens)}.`);
}

main().catch((error) => {
  console.error("Reading failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
