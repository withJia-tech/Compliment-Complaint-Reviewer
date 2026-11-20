import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "ccr-cli-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function run(args: string[]) {
  const env = { NODE_ENV: "test" as const, ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ANTHROPIC_") && !key.startsWith("CCR_"))) };
  // Exit before dispatch if any code attempts networking; neither a mock key nor a real transport is needed.
  const guard = `data:text/javascript,${encodeURIComponent("globalThis.fetch = async () => { process.exit(91); };")}`;
  return spawnSync(process.execPath, ["--import", "tsx", "--import", guard, "scripts/readReviews.ts", ...args], { encoding: "utf8", env, timeout: 15_000 });
}
describe("reader CLI authorization boundary", () => {
  it("dry-runs with no key, transport or output file", () => {
    const before = readdirSync(dir);
    const result = run(["golden", "--out", path.join(dir, "never-written.json")]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("47 non-empty reviews");
    expect(result.stdout).toContain("$0.28623 (not a ceiling)");
    expect(result.stdout).toContain("no client created, no requests sent, no files written");
    expect(readdirSync(dir)).toEqual(before);
  });
  it.each([
    ["golden", "--yes"],
    ["golden", "--yes", "--max-cost-usd", "0", "--max-calls", "94", "--out", path.join(dir, "zero.json")],
    ["golden", "--yes", "--max-cost-usd", "3", "--max-calls", "95", "--out", path.join(dir, "too-many.json")],
    ["golden", "--yes", "--out", path.resolve("tests/fixtures/golden/readings/risk_classifier_v1.json")],
    ["golden", "--unknown"],
    ["golden", "--out"],
    ["golden", "--yes", "--yes"],
  ].map((args) => ({ args })))("rejects incomplete or invalid authorization %# without networking", ({ args }) => {
    expect(run(args).status).toBe(1);
    expect(readdirSync(dir)).toEqual([]);
  });
  it("refuses an existing output before any external request", () => {
    const out = path.join(dir, "keep.json"); writeFileSync(out, "existing evidence");
    try {
      expect(run(["golden", "--yes", "--max-cost-usd", "3", "--max-calls", "94", "--out", out]).status).toBe(1);
      expect(readFileSync(out, "utf8")).toBe("existing evidence");
    } finally { rmSync(out); }
  });
});
