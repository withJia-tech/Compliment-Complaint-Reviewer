# Handover — next tasks: cheaper reader model (B11), then live Google reviews (B12)

Written 2026-11-13 at the end of the previous session. Delete this file when both tasks are done.
Read `CLAUDE.md`, `SPEC.md` and `docs/DECISIONS.md` first.

## How the owner wants to work

- Ask the open questions below **before writing code**.
- When their framing may be wrong, say so **at the top**, with the reason, before doing the work.
- Artifacts on light backgrounds that read well in glare.
- End each reply with a brief token estimate and the share of the context window remaining.
- Commit and push to the working branch as you go; open a PR only when asked.

## Where things stand

- Branch `claude/golden-risk-classifier-v1` (pushed, **no PR yet**) holds all of this work on top
  of `main`. `main` has PR #4 merged.
- `npm run typecheck`, 176 tests (none skipped) and `npm run build` pass; `npm audit` is clean.
- `npm run eval:gate` **fails on purpose** until the owner commits an evaluation run (below).

### What was built

| Area | State |
|---|---|
| Golden dataset | `tests/fixtures/golden/risk_classifier_v1.jsonl`, 49 fixtures in 8 families (baseline, routine complaint, sensitive, mixed signal, PII, adversarial, multilingual incl. Singlish/Chinese/Malay/Japanese/Spanish, edge case). Checksum-pinned in `MANIFEST.json`, status **draft**: the owner still has to approve it, after which it is immutable and changes mean a v2. |
| Keyword rules | Normalised matching (zero-width, spaced, dotted, digit-for-letter), a `sensitive_prompt_injection` category, guards for personal info / links / gibberish, and without a reader a non-Latin-script review is never quick approve. `POLICY_VERSION` is `policy-v1.1.0`. |
| Second reader | `lib/triage/reader/`: Claude, structured output (zod), effort `low`, server-side refusal fallbacks on for Opus/Sonnet 5.5. **Can only raise, fails closed.** Default model `claude-opus-5-5`, override with `CCR_READER_MODEL`. Readings can be recorded and replayed (`CachedReviewReader`). |
| Bring your own key | Each owner sets `ANTHROPIC_API_KEY` in `.env.local`. No key is stored by the app. `.env` and `.env*.local` are git-ignored. |
| Licence | MIT, copyright `withJia-tech`; README credit section and an app footer. |
| CI | See "Gates" below. |

### Gates (all must pass on a PR)

- **Golden evaluation gate** (`npm run eval:gate`, `eval/thresholds.json`): two modes, rules only
  and rules + reader (replayed from `tests/fixtures/golden/readings/risk_classifier_v1.json`).
  Metrics: exact match rate, sensitive recall, unsafe quick approves, false alarms, reader
  failures. Fails on a breach, a missing or stale run, or a limit loosened against the base branch
  without `loosening_reason`. Uploads `eval-report/` (fixture ids only).
  Rules-only baseline: 29/49 exact, 50% sensitive recall, 6 unsafe, 1 false alarm.
  Reader limits: ≥90% exact, 100% sensitive recall, 0 unsafe, ≤1 false alarm, 0 failures.
- **Typecheck, tests, build**, plus a check that fails on any skipped test, and the scan
  idempotency check.
- **Security:** gitleaks (checksum-verified) over full history; `npm audit --audit-level=moderate`;
  `npm audit signatures`; CodeQL (`codeql.yml`, JS/TS and Actions).
- **Log leak check:** logs and reports must not contain keys, golden review text or planted PII.
- Read-only workflow permissions; all actions pinned to full SHAs; explicit `bash` so `| tee`
  steps fail correctly; Dependabot for pins.

### Waiting on the owner

1. Run `npm run read:golden -- --yes` and `npm run read:demo -- --yes` locally with their key,
   commit both readings files, and share the golden score.
2. Approve the golden dataset (two draft fixtures were changed: RC-300 now expects high with
   fraud; RC-408 now expects needs review, matching the accepted weak-tier rule).
3. In repo settings: make the CI checks **required** on `main`, and turn on GitHub secret scanning
   with push protection.

## Task 1 — B11: cheaper reader model

The owner wants low cost per review, e.g. Claude Sonnet 5.5.

- **Close the gate gap first:** `scripts/evalGate.ts` checks the readings' prompt version but not
  the model. Add a model check (the reading cache's `readerId` is `<model>:<promptVersion>`) so a
  run from a different model than the configured default fails as stale.
- Consider recording token usage and cost per review in the readings file, and adding a
  cost-per-review limit to `eval/thresholds.json`, so cost is gated as well as quality.
- Then compare models on the golden set: same 49 reviews, same thresholds. Do not loosen the reader
  thresholds to fit a cheaper model. Reference prices per million tokens (input/output): Opus 5.5
  $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50. Check current pricing.
- Model notes: Sonnet 5.5 recalibrated effort (we send `low`); Haiku 5.5 has no server-side
  refusal fallback (the code already omits it there; a refusal fails closed).

## Task 2 — B12: live Google reviews

- **Prerequisite B10:** add a tenant key to the repos before OAuth (decision 8 hardens otherwise).
- Two routes to weigh with the owner: Google Business Profile API with OAuth (scope
  `https://www.googleapis.com/auth/business.manage`; API access must be requested from Google and
  may take time — verify the current process), or an MCP connector if a suitable one exists
  (check, don't assume). An MCP connector reads inside a Claude session; it cannot run the daily
  worker unattended, and SPEC rules out MCP as scheduler or system of record.
- OAuth refresh tokens are secrets the app would store: decide where and how (encryption, per
  tenant) before writing code. Google stays the system of record; no local archive of reviews.
- `ReviewProvider` is the seam: a live provider replaces `FixtureReviewProvider` behind the same
  interface. B3 (failed publish recorded as approved) must be fixed before any live send.

## Open questions to ask first

1. Which model to try first: Sonnet 5.5 as asked, Haiku 5.5 as well, or both side by side?
2. Is a cost-per-review limit in the gate wanted, and at what figure?
3. Google route: Business Profile API with OAuth, an MCP connector, or prototype both?
4. Has the owner applied for Business Profile API access yet?
5. Where should OAuth tokens live for a one-person, self-hosted setup?

## Environment notes

- This cloud environment cannot take an Anthropic key: `request_credential` refuses Anthropic
  hosts. Live model runs happen on the owner's machine; CI replays saved readings.
- The sandbox cannot reach Sigstore, so `npm audit signatures` only runs in CI.
- A spare personal environment `compliment-complaint-reviewer` exists, unused; the owner may delete it.
