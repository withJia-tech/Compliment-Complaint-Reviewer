# Controlled learning loop — reconciled implementation plan

Status: **planning only.** Nothing here approves a production integration, store, deployment,
threshold or promotion authority. ADR-001 stays open (it is the hosting, database, identity and
topology choice; it exists only as a mention in PR #5's docs, with no ADR file yet).

Source: the owner's "Controlled learning loop — implementation plan", which is also committed on
draft PR #5 as `docs/CONTROLLED_LEARNING_PLAN.md`. This file checks that plan against the
repository as it is on 2026-11-13, corrects what has moved, and turns its five PRs into
interfaces, files and tests for this codebase. Implement a slice only when the owner asks for it.

## 1. Observed baseline (2026-11-13)

| Line of work | Where | State |
|---|---|---|
| `main` | `6b8437d` (PR #4 merged) | Rules triage, template drafter, fixture provider, no auto-send. CI: typecheck, tests, build, scan idempotency. |
| Verified approval-to-send | draft PR #5, `codex/verified-approval-send` @ `f104a9d` | Pins source and facts, validates final text, records send intent, separates `publish_failed` from `publish_unknown` (B3 at the fixture boundary), cross-process writer lock (part of B6), hosted browser-only demo, Dataset 2. **Unmerged.** |
| Classifier, evaluation and security gates | `claude/golden-risk-classifier-v1` (no PR yet) | Golden dataset v1 (49 fixtures, **approved 2026-11-13**), normalised matching and guards, second reader (Haiku with code-routed escalation to Sonnet), golden evaluation gate with threshold ratchet, reader-identity check and a 1¢/review cost limit, gitleaks, npm audit and signatures, CodeQL, log-leak check, skipped-test check, SHA-pinned actions. **Unmerged.** |
| Assurance contracts v0.5 | draft PR #3 | Compile-fails against `main`; port its checks, do not merge (CLAUDE.md). |

### Corrections to the plan's assumptions

1. **Base has moved.** The plan inspected PR #5 at `6903ba2`; it is now `f104a9d`, six commits
   later (demo sessions, Vercel browser-only demo, review-desk focus, deployment verification,
   Dataset 2). Rebase the plan on whichever line merges first.
2. **"The broader classifier and security evaluation workflow is separate unmerged work"** is
   this branch. Plan PR 1 extends that gate, so it needs this branch *and* PR #5 (validation
   version for the manifest). The plan treats PR #5 as the base; it cannot be the base alone.
3. **The two lines conflict.** Both start at `6b8437d`; a trial merge conflicts in seven files:
   `.gitignore`, `README.md`, `app/globals.css`, `lib/__tests__/scan.runDailyScan.test.ts`,
   `lib/scan/runDailyScan.ts`, `lib/triage/policy.ts`, `package.json`. The dangerous one is
   `runDailyScan.ts`: PR #5 calls `deps.policy.classify(review)` directly, this branch calls
   `triageReview(review, deps.policy, deps.reader)`. Resolve by keeping `triageReview`, or the
   second reader silently stops running in scans. Add a test that a scan with a reader configured
   records a `reading` on every triage result with text.
4. **Part of the release manifest exists already.** The reader id pins models, routing version
   and a prompt-and-schema fingerprint; `POLICY_VERSION` pins rules; `MANIFEST.json` pins the
   dataset checksum and status; `eval/thresholds.json` is ratcheted against the base branch.
   Missing: one manifest object, app commit, validation version, gate-spec hash, report digests,
   incumbent comparison.
5. **B8 is narrower than the plan's promotion.** Today B8 is "fail if rules change without a
   `POLICY_VERSION` bump". Re-scope it to plan PR 1 (bundle identity) and PR 4 (promotion).
6. **AGENTS.md** does not exist. `docs/VERIFIED_SEND.md` exists only on PR #5.
7. **Dataset 2 conflicts with the plan and CLAUDE.md.** PR #5 commits transcribed real Google
   reviews of a named business with reviewer names, served on a hosted demo, from an account its
   own doc says is not affiliated or authorised. The plan says "do not commit raw production cases
   to GitHub"; CLAUDE.md says "no local archive of review content". Needs an owner decision (D3)
   before PR #5 merges.

### What today's evidence can and cannot show

The plan asks for counts and one-sided 95% bounds, and says zero misses in a small sample is not
evidence of negligible risk. On golden v1, with zero misses:

| Slice | Fixtures listing it | 95% upper bound on the miss rate |
|---|---|---|
| All sensitive | 30 | 9.5% |
| Safety / medical | 12 / 11 | 22% / 24% |
| Legal | 8 | 31% |
| Discrimination / fraud | 4 / 4 | 53% |
| Compensation | 3 | 63% |
| Prompt injection | 2 | 78% |

So the current `sensitiveRecall: 1` gate shows "no miss among 30", not "misses under 10%", and a
per-category gate on v1 would be *insufficient evidence* by construction. Showing a critical
category's miss rate is under 5% with zero misses takes **59** cases in that category. That sizes
golden v2 (D4).

## 2. PR sequence for this codebase

PR 0 is new: the plan cannot start until the two unmerged lines are one.

### PR 0 — One base

Merge both lines in the order the owner picks (D1), resolving the seven conflicts as above.
Done when: CI (all gates) is green on the merged `main`; the scan-with-reader test passes; D3 is
applied to Dataset 2.

### PR 1 — Release manifest, metric registry, baseline inventory

| | |
|---|---|
| New files | `lib/release/manifest.ts`, `lib/eval/metrics.ts`, `eval/metrics.json`, `lib/__tests__/release.manifest.test.ts`, `lib/__tests__/eval.metrics.test.ts` |
| Changed | `scripts/evalGate.ts` (write `eval-report/manifest.json` and report digests), `.github/workflows/ci.yml` (upload always, including failures; already does) |

```ts
// lib/release/manifest.ts — zod-validated; digest = sha256 of canonical (key-sorted) JSON
interface ReleaseManifest {
  schemaVersion: 1;
  app: { commit: string };
  rules: { policyVersion: string; validationVersion: string };
  reader: { id: string; primary: string; escalation: string | null; routingVersion: string; promptFingerprint: string } | null;
  retrieval: { mode: "disabled" };
  evaluation: { datasetFile: string; datasetSha256: string; datasetStatus: "approved";
                readingsSha256: string | null; metricRegistrySha256: string; incumbentDigest: string | null };
  createdAt: string;
}

// eval/metrics.json entries — acceptance-gate limits, kept apart from runtime thresholds
interface MetricSpec {
  id: string;                         // e.g. "recall.sensitive.safety"
  numerator: string; denominator: string;
  slice?: { family?: string; category?: string };
  minCases: number;                   // below this: insufficient_evidence (a failure)
  floor?: number; ceiling?: number;   // absolute limits
  maxRegressionVsIncumbent?: number;
  bound: "clopper_pearson_one_sided_95" | "none";
  approved: boolean;                  // false until the risk owner approves the number (D4)
}
type MetricResult = { id: string; status: "pass" | "fail" | "insufficient_evidence";
                      numerator: number; denominator: number; value: number | null; upperBound95?: number };
```

Regression tests (each written failing first):
- an empty denominator, or a slice below `minCases`, is `insufficient_evidence` and fails the gate;
- the bound for 0 of 30 is 0.095 (±0.001) and for 0 of 59 is under 0.05;
- the manifest digest is stable under key reordering and changes when any field changes;
- an `approved: false` metric is reported but cannot make a bundle eligible for promotion;
- editing `eval/metrics.json` to weaken a limit without `loosening_reason` fails (the existing
  ratchet, extended to the registry);
- today's rules-only numbers (29/49, 50%, 6 unsafe, 1 false alarm) reproduce exactly.

### PR 2 — Synthetic shadow runner and event contract (depends on 1)

| | |
|---|---|
| New files | `lib/shadow/types.ts`, `lib/shadow/runShadow.ts`, `lib/telemetry/events.ts`, `lib/__tests__/shadow.isolation.test.ts` |
| Changed | `lib/scan/runDailyScan.ts`: optional `shadow?: ShadowHook` in `DailyScanDeps`, default undefined (off) |

```ts
interface ShadowInput { caseRef: string; stars: number; text: string; incumbent: TriageResult } // minimised, read-only
interface ShadowCandidate { manifestDigest: string; classify(input: ShadowInput, signal: AbortSignal): Promise<TriageResult> }
interface ShadowRecord { caseRef: string; incumbentRelease: string; candidateRelease: string;
  sampled: boolean; samplingProbability: number;
  state: "completed" | "failed" | "timed_out" | "excluded"; agree: boolean | null; durationMs: number; usage?: TokenUsage }
type ShadowHook = (input: ShadowInput) => void;  // fire-and-forget; never awaited by the scan
```

The shadow runner receives no repositories and no provider: it cannot write state or publish
because it is never given anything that can. Records go to an in-memory sink in tests; no
persistent store is chosen (ADR-001).

Regression tests: a candidate that throws, hangs past its timeout or blows its budget leaves the
incumbent triage, queue and store byte-identical and the scan's duration within bound; a spy on
`provider.publishReply` and every repo `upsert` sees zero calls from the shadow path; counts of
eligible, sampled, completed, failed and excluded add up; a synthetic canary review text and a
canary key never appear in logs or `eval-report/` (extend `scripts/ci/checkLogLeaks.ts`).

### PR 3 — Synthetic feedback, adjudication and dataset export (depends on 1)

| | |
|---|---|
| New files | `lib/feedback/types.ts`, `lib/feedback/lifecycle.ts`, `lib/feedback/exportDataset.ts`, tests |
| Not changed | No UI route or server action writes feedback: real capture stays off |

```ts
interface FeedbackEvent {           // immutable; revisions supersede, never overwrite
  eventId: string; idempotencyKey: string; supersedes: string | null;
  actor: { id: string; role: "owner" | "reviewer" | "adjudicator" }; locationId: string;
  caseRef: string; sourceVersion: string; releaseDigest: string; draftVersion: string | null;
  outcome: "risk_too_low" | "risk_too_high" | "wrong_category" | "unsupported_claim" | "ok";
  reasonCodes: string[]; evidenceRefs: string[]; at: string;
  retentionClass: "synthetic" | "operational"; dataUseBasis: string;
}
type LabelState = "submitted" | "quarantined" | "reviewed" | "adjudicated" | "disputed" | "excluded" | "approved";
```

Regression tests: a replayed idempotency key is a no-op; a reviewer outside the location is
refused; a revision keeps the original; a disputed label never reaches `approved`; a high-risk
label with one reviewer cannot enter the holdout (D2); an unedited approval, a skip or silence
produces no label; text inside feedback that looks like an instruction stays data; the exporter
puts near-duplicates and revisions of one case in the same split and never leaks a holdout case
into development.

### PR 4 — Offline promotion simulator and rollback (depends on 1–3)

| | |
|---|---|
| New files | `lib/release/promotion.ts`, `lib/release/activePointer.ts`, tests |

States: `draft → evaluated → shadow_validated → approved → active → retired | rolled_back`.
`activePointer.swap(expectedDigest, nextDigest)` is compare-and-swap. Approval binds to one
manifest digest and one environment.

Regression tests: an unauthorised approver, a stale evaluation, a digest mismatch, a concurrent
swap and a candidate that weakens a gate limit are each refused and leave the incumbent active;
rollback picks a previously approved compatible bundle; rollback to a bundle whose data
permission was revoked is refused; pending decisions made under the old bundle are flagged for
re-check, never silently reinterpreted; no external write is replayed.

### PR 5 — Live pilot adapters and runbooks

Separately authorised. Blocked on D2, D5–D8, ADR-001, B10 (tenant key) and B12 (live reviews,
including where OAuth tokens live; see the proposal in `docs/DECISIONS.md`).

## 3. Decisions for the owner

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| D1 | Merge order of PR #5 and this branch | PR 0 | This branch first: its gates (evaluation, gitleaks, CodeQL, log-leak) then check PR #5 when it rebases. Either order works if `triageReview` survives the merge. |
| D2 | Who is the second, independent adjudicator for high-risk labels while there is one person? | PR 3 holdout, any promotion from live data | A second trusted human for high-risk and ambiguous labels only. A model cannot be one. Without a second person, live-derived labels stay development-only and cannot satisfy a gate. |
| D3 | Dataset 2 (real reviews of a named business, reviewer names, hosted demo) | PR 0 / PR #5 merge | Replace with synthetic look-alikes before merge. If the repo is or was public, also decide whether the history needs purging. |
| D4 | Critical categories and their numbers: which categories get their own recall gate, `minCases`, floors and allowed regression | PR 1 `approved: true` | Safety, medical, discrimination, legal, fraud as critical. Golden v2 with at least 59 cases per critical category if the target is "under 5% misses with 95% confidence". |
| D5 | Who operates, owns risk, adjudicates, promotes and rolls back | PR 4 authority, PR 5 | At this stage the owner holds all roles; write that down as an accepted exception, since separation of duties cannot hold with one person. |
| D6 | Live data: what may be kept or reused, for how long, where, and how deletion propagates | PR 2 live, PR 3 live | Keep references and hashes, fetch text from Google when needed (B5). Check Google's terms and the local data-protection law that applies to the business. |
| D7 | Budgets: model spend, shadow spend, review time | PR 2 live | Model spend is already gated at 1¢ per review; set a monthly cap on the API key as well. |
| D8 | Retrieval: allowed sources, and what result would justify a retained index | Retrieval stays disabled | Disabled until a separate experiment shows a measured gain. |
| — | ADR-001: hosting, database, identity, topology | Live work | Keep open. The token-storage proposal sits behind a `TokenVault` interface for this reason. |

None of these block synthetic contracts (PRs 1–4 in their offline form). They do block choosing
production stores or integrations, and turning on live capture, shadow runs or promotion.
