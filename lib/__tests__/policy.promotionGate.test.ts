import { describe, expect, it } from "vitest";
import manifest from "@/lib/triage/policyManifest.json";
import { normaliseSource, policySourceHash } from "@/lib/triage/policyFingerprint";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";

/**
 * Backlog B8: a routing change cannot merge without a POLICY_VERSION bump.
 * If this fails: bump POLICY_VERSION in lib/triage/policyVersion.ts, run
 * `npm run policy:stamp`, then `npm run eval`.
 */
describe("policy promotion gate", () => {
  it("the routing source matches the stamped manifest", () => {
    expect(policySourceHash()).toBe(manifest.sourceHash);
  });

  it("the stamped version is the live POLICY_VERSION", () => {
    expect(manifest.policyVersion).toBe(POLICY_VERSION);
  });

  it("ignores comment and whitespace edits but not code edits", () => {
    const code = 'const a = ["sue"]; // note';
    expect(normaliseSource(`/** doc */\n${code}`)).toBe(normaliseSource(`${code}\n\n// another`));
    expect(normaliseSource('const a = ["sue"];')).not.toBe(normaliseSource('const a = ["sued"];'));
    // A // inside a string is code, not a comment.
    expect(normaliseSource('const u = "a//b";')).not.toBe(normaliseSource('const u = "a";'));
  });
});
