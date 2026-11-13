import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The files whose behaviour POLICY_VERSION names. A change to any of them is
 * a routing change: it needs a version bump, so stored triage results and
 * audit records stay attributable to the rules that produced them.
 */
export const POLICY_SOURCE_FILES = [
  "lib/triage/rules.ts",
  "lib/triage/match.ts",
  "lib/triage/policy.ts",
];

/**
 * Comments and whitespace are stripped first, so rewording a comment doesn't
 * demand a version bump. Only whole-line `//` comments are removed, so a `//`
 * inside a string or regex can never be mistaken for one.
 */
export function normaliseSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function policySourceHash(root: string = process.cwd()): string {
  const hash = createHash("sha256");
  for (const file of POLICY_SOURCE_FILES) {
    hash.update(`${file}\n`);
    hash.update(normaliseSource(fs.readFileSync(path.join(root, file), "utf-8")));
    hash.update("\n");
  }
  return hash.digest("hex");
}

export interface PolicyManifest {
  policyVersion: string;
  sourceHash: string;
  files: string[];
}

export const POLICY_MANIFEST_PATH = "lib/triage/policyManifest.json";
