import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { triageReview } from "@/lib/triage/triageReview";
import type { RecommendedAction, Review, RiskLevel } from "@/lib/types";

/**
 * Versioned golden dataset for the risk classifier.
 *
 * Each line of tests/fixtures/golden/risk_classifier_v<N>.jsonl states what
 * the classifier SHOULD decide for a review. The file is pinned by a sha256
 * in MANIFEST.json: once a version is approved it is never edited — a change
 * means a new file, a new version and a new evaluation run.
 */
const DIR = path.resolve(__dirname, "../../tests/fixtures/golden");
const FILE = "risk_classifier_v1.jsonl";


const CATEGORIES = [
  "safety",
  "medical",
  "discrimination",
  "legal",
  "fraud",
  "compensation",
  "pii",
  "prompt_injection",
] as const;
const FAMILIES = [
  "baseline",
  "routine_complaint",
  "sensitive",
  "mixed_signal",
  "pii",
  "adversarial",
  "multilingual",
  "edge_case",
] as const;

interface Fixture {
  fixture_id: string;
  version: string;
  family: (typeof FAMILIES)[number];
  stars: number;
  review_text: string;
  language: string;
  business_context: string;
  expected_primary_action: RecommendedAction;
  expected_risk_level: RiskLevel;
  expected_sensitive: boolean;
  expected_categories: (typeof CATEGORIES)[number][];
  notes: string;
}

const raw = readFileSync(path.join(DIR, FILE), "utf8");
const fixtures: Fixture[] = raw
  .split("\n")
  .filter((line) => line.length > 0)
  .map((line) => JSON.parse(line) as Fixture);
const manifest = JSON.parse(readFileSync(path.join(DIR, "MANIFEST.json"), "utf8"))[FILE] as {
  version: string;
  status: "draft" | "approved";
  fixtures: number;
  sha256: string;
};

function toReview(fixture: Fixture): Review {
  return {
    id: fixture.fixture_id,
    locationId: "loc_001",
    author: "Golden Tester",
    stars: fixture.stars as Review["stars"],
    text: fixture.review_text,
    createTime: "2026-08-20T00:00:00Z",
    updateTime: "2026-08-20T00:00:00Z",
  };
}

describe("risk classifier golden dataset — integrity", () => {
  it("matches the checksum pinned in MANIFEST.json (the file is immutable)", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe(manifest.sha256);
    expect(fixtures).toHaveLength(manifest.fixtures);
  });

  it("has unique ids and one version throughout", () => {
    expect(new Set(fixtures.map((f) => f.fixture_id)).size).toBe(fixtures.length);
    expect(new Set(fixtures.map((f) => f.version))).toEqual(new Set([manifest.version]));
  });

  it("uses only this product's vocabulary", () => {
    for (const f of fixtures) {
      expect(["quick_approve", "needs_review"], f.fixture_id).toContain(f.expected_primary_action);
      expect(["low", "medium", "high"], f.fixture_id).toContain(f.expected_risk_level);
      expect([1, 2, 3, 4, 5], f.fixture_id).toContain(f.stars);
      expect(FAMILIES, f.fixture_id).toContain(f.family);
      for (const category of f.expected_categories) expect(CATEGORIES, f.fixture_id).toContain(category);
    }
  });

  it("never expects quick approve for a sensitive or non-low review", () => {
    for (const f of fixtures) {
      if (f.expected_sensitive || f.expected_risk_level !== "low") {
        expect(f.expected_primary_action, f.fixture_id).toBe("needs_review");
      }
    }
  });

  it("covers every family and every category", () => {
    expect(FAMILIES.filter((family) => !fixtures.some((f) => f.family === family))).toEqual([]);
    expect(
      CATEGORIES.filter((category) => !fixtures.some((f) => f.expected_categories.includes(category))),
    ).toEqual([]);
  });
});

const policy = new DefaultTriagePolicy();
// The rules + reader replay of the committed evaluation run is gated by
// `npm run eval:gate` (scripts/evalGate.ts), not here, so that a missing run
// fails CI loudly instead of showing up as skipped tests.

/**
 * Keyword rules and deterministic guards alone, with no reader (the mode
 * anyone runs without a key). It must never mark a review quick approve when
 * the dataset says it needs a read, except the ones listed here, which only
 * a reader that understands meaning can catch.
 */
const NEEDS_A_READER = new Set<string>([
  "RC-002", // "two hours late" inside a polite 4-star review: no complaint keyword
  "RC-200", // "felt unwell", "piece of plastic": paraphrase of illness and a foreign object
  "RC-202", // cultural misrepresentation described without any discrimination keyword
  "RC-311", // a staff member's full name: no pattern can tell a name from other words
  "RC-407", // sarcasm: praise words wrapped around a complaint
  "RC-503", // Spanish food poisoning, Latin script, so the script guard can't see it
]);

describe("risk classifier golden dataset — rules only (no key)", () => {
  it.each(fixtures.filter((f) => f.expected_primary_action === "needs_review" && !NEEDS_A_READER.has(f.fixture_id)))(
    "$fixture_id is not quick approve without a reader",
    async (fixture) => {
      const result = await triageReview(toReview(fixture), policy, null);
      expect(result.recommendedAction).toBe("needs_review");
    },
  );
});
