import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { ReadingCacheFileSchema, readingKey, type ReadingCacheFile } from "@/lib/triage/reader/cachedReader";
import { escalationReasons } from "@/lib/triage/reader/cascade";
import { REQUEST_CONTRACT } from "@/lib/triage/reader/requestContract";
import { costUsd } from "@/lib/triage/reader/pricing";
import type { Review } from "@/lib/types";

// Byte fingerprints automatically invalidate evidence when executable behaviour or dependency versions change.
export const EVIDENCE_SOURCES = [
  "package.json", "package-lock.json", "lib/eval/goldenEval.ts", "lib/eval/readerEvidence.ts", "scripts/evalGate.ts", "scripts/readReviews.ts",
  "lib/triage/policy.ts", "lib/triage/policyVersion.ts", "lib/triage/rules.ts", "lib/triage/match.ts", "lib/triage/guards.ts", "lib/triage/normalize.ts", "lib/triage/triageReview.ts",
  "lib/triage/reader/types.ts", "lib/triage/reader/prompt.ts", "lib/triage/reader/requestContract.ts", "lib/triage/reader/runBudget.ts", "lib/triage/reader/claudeReader.ts", "lib/triage/reader/fromEnv.ts", "lib/triage/reader/cascade.ts", "lib/triage/reader/cachedReader.ts", "lib/triage/reader/pricing.ts",
] as const;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function implementationFingerprint(read: (file: string) => string | Buffer = (file) => readFileSync(file)): string {
  const hash = createHash("sha256");
  for (const file of EVIDENCE_SOURCES) hash.update(file).update("\0").update(read(file)).update("\0");
  return hash.digest("hex");
}
export function evidenceBinding(dataset: string, reviews: Review[]) {
  const keys = reviews.filter((r) => r.text.trim()).map(readingKey).sort();
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate star/text pairs cannot be recorded without losing attempt identity");
  return { implementationSha256: implementationFingerprint(), datasetSha256: digest(readFileSync(dataset)), reviewSetSha256: digest(JSON.stringify(keys)), requestSha256: digest(JSON.stringify(REQUEST_CONTRACT)) };
}
export type EvidenceBinding = ReturnType<typeof evidenceBinding>;
export function cleanSourceCommit(): string {
  if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw new Error("Commit the reviewed local patch before an external run");
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}
export function verifySourceCommit(cache: ReadingCacheFile): void {
  if (!cache.evidence) throw new Error("Recording lacks execution provenance");
  try {
    const fingerprint = implementationFingerprint((file) => execFileSync("git", ["show", `${cache.evidence!.sourceCommit}:${file}`], { stdio: ["ignore", "pipe", "ignore"] }));
    if (fingerprint !== cache.evidence.implementationSha256) throw new Error("mismatch");
  } catch { throw new Error("Recorded source commit is unavailable or differs from execution fingerprint"); }
}

/** Completeness is independent of final recovery: omitted attempts cannot be laundered into success. */
export function validateRecording(input: ReadingCacheFile, reviews: Review[], binding: EvidenceBinding, expectedReaderId: string) {
  const parsed = ReadingCacheFileSchema.safeParse(input);
  if (!parsed.success) throw new Error("Recording schema or model identity invalid");
  const cache = parsed.data, evidence = cache.evidence;
  if (!evidence || !evidence.completed) throw new Error("Recording is incomplete or lacks execution provenance");
  if (cache.readerId !== expectedReaderId) throw new Error("Recording does not use the qualified reader");
  for (const field of Object.keys(binding) as (keyof EvidenceBinding)[]) {
    if (evidence[field] !== binding[field]) throw new Error(`Stale recording: ${field}`);
  }
  const { primary, escalation } = cache.models;
  const requiredPrimary = new Set<string>(), requiredEscalation = new Set<string>();
  const policy = new DefaultTriagePolicy(() => new Date(0));
  let primaryFailures = 0, escalationFailures = 0, recoveredReads = 0;
  for (const review of reviews.filter((r) => r.text.trim())) {
    const key = readingKey(review); requiredPrimary.add(key);
    const first = cache.attempts[primary]?.[key];
    if (!first) throw new Error("Missing primary recording");
    if (!first.ok) primaryFailures += 1;
    if (!first.usageKnown || (!first.ok && ["not_cached", "api_error", "invalid_response"].includes(first.reason))) throw new Error("Unknown usage or invalid primary attempt");
    if (escalation && escalationReasons(review, { ...first, model: primary }, { rules: policy.classify(review) }).length) {
      requiredEscalation.add(key);
      const second = cache.attempts[escalation]?.[key];
      if (!second) throw new Error("Missing required escalation recording");
      if (!second.ok) escalationFailures += 1;
      if (!second.usageKnown || (!second.ok && ["not_cached", "api_error", "invalid_response"].includes(second.reason))) throw new Error("Unknown usage or invalid escalation attempt");
      if (!first.ok && second.ok) recoveredReads += 1;
    }
  }
  for (const [model, required] of [[primary, requiredPrimary], ...(escalation ? [[escalation, requiredEscalation] as const] : [])] as const) {
    const actual = Object.keys(cache.attempts[model] ?? {});
    if (actual.length !== required.size || actual.some((key) => !required.has(key))) throw new Error("Recording contains missing or unused attempts");
  }
  const calls = requiredPrimary.size + requiredEscalation.size;
  if (!requiredPrimary.size || evidence.maxCalls > requiredPrimary.size * (escalation ? 2 : 1) || evidence.generationCalls !== calls || evidence.tokenCountCalls !== calls || calls > evidence.maxCalls) throw new Error("Execution call counts do not reconcile");
  let reservation = 0;
  for (const [model, attempts] of Object.entries(cache.attempts)) {
    const perCall = costUsd(model, { inputTokens: REQUEST_CONTRACT.maxInputTokens, outputTokens: REQUEST_CONTRACT.maxOutputTokens });
    if (perCall === null) throw new Error("Unqualified price");
    for (const attempt of Object.values(attempts)) {
      if (attempt.usage.inputTokens > REQUEST_CONTRACT.maxInputTokens || attempt.usage.outputTokens > REQUEST_CONTRACT.maxOutputTokens) throw new Error("Usage exceeds execution bounds");
      reservation += perCall;
    }
  }
  if (reservation > evidence.maxCostUsd + 1e-12) throw new Error("Run exceeded authorized reservation budget");
  return { primaryFailures, escalationFailures, recoveredReads, attemptFailures: primaryFailures + escalationFailures, calls, reservationUsd: reservation };
}
