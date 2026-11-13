/**
 * Scans CI logs and uploaded reports for things that must never appear in
 * them: API keys and tokens, the text of any golden review, and the personal
 * details planted in the golden dataset. Fails if it finds any.
 *
 *   tsx scripts/ci/checkLogLeaks.ts <file-or-dir>...
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadGoldenFixtures } from "@/lib/eval/goldenEval";

const SECRET_PATTERNS: [string, RegExp][] = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{10,}/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

function files(target: string): string[] {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return [target];
  return readdirSync(target).flatMap((name) => files(path.join(target, name)));
}

const fixtures = loadGoldenFixtures("tests/fixtures/golden/risk_classifier_v1.jsonl");
// Whole review texts long enough to be distinctive, plus every planted personal detail.
const reviewTexts = fixtures.map((f) => f.review_text.trim()).filter((t) => t.length >= 20 && new Set(t).size > 3);
const plantedPii = fixtures
  .flatMap((f) => f.review_text.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}|\+?\d[\d\s().-]{6,}\d/gi) ?? [])
  .map((s) => s.trim());

const targets = process.argv.slice(2).flatMap(files);
let problems = 0;
for (const file of targets) {
  const content = readFileSync(file, "utf8");
  for (const [name, pattern] of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`LEAK ${file}: looks like a ${name}`);
      problems += 1;
    }
  }
  for (const text of reviewTexts) {
    if (content.includes(text)) {
      console.error(`LEAK ${file}: contains the full text of a golden review`);
      problems += 1;
      break;
    }
  }
  for (const pii of plantedPii) {
    if (content.includes(pii)) {
      console.error(`LEAK ${file}: contains a personal detail from the golden dataset`);
      problems += 1;
      break;
    }
  }
}
console.log(`Checked ${targets.length} file(s) for secrets, review text and personal details: ${problems} problem(s).`);
if (targets.length === 0) {
  console.error("Nothing to check: the logs and reports this step expects are missing.");
  process.exitCode = 1;
}
if (problems > 0) process.exitCode = 1;
