import fs from "node:fs";
import path from "node:path";
import {
  POLICY_MANIFEST_PATH,
  POLICY_SOURCE_FILES,
  policySourceHash,
  type PolicyManifest,
} from "@/lib/triage/policyFingerprint";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";

/**
 * Records the routing source hash against POLICY_VERSION.
 *
 * Refuses when the routing source changed but POLICY_VERSION did not: the
 * only way to make the promotion gate test pass after a rule change is to
 * bump the version first. Run `npm run eval` after stamping; the gates in
 * npm test must pass before the change merges.
 */
const file = path.join(process.cwd(), POLICY_MANIFEST_PATH);
const current: PolicyManifest | null = fs.existsSync(file)
  ? (JSON.parse(fs.readFileSync(file, "utf-8")) as PolicyManifest)
  : null;
const sourceHash = policySourceHash();

if (current && current.sourceHash === sourceHash && current.policyVersion === POLICY_VERSION) {
  console.log(`Nothing to stamp: ${POLICY_VERSION} already matches the routing source.`);
  process.exit(0);
}
if (current && current.sourceHash !== sourceHash && current.policyVersion === POLICY_VERSION) {
  console.error(
    `Routing source changed but POLICY_VERSION is still ${POLICY_VERSION}.\n` +
      "Bump it in lib/triage/policyVersion.ts (with a line saying what changed), then re-run.",
  );
  process.exit(1);
}

const next: PolicyManifest = { policyVersion: POLICY_VERSION, sourceHash, files: POLICY_SOURCE_FILES };
fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Stamped ${POLICY_VERSION} (${sourceHash.slice(0, 12)}). Now run: npm run eval && npm test`);
