# Compliment-Complaint-Reviewer — working notes for Claude

A governed review desk for a Google Business Profile owner. Read `SPEC.md` (product rules and
rubrics) and `docs/DECISIONS.md` (decision log + backlog) before changing behaviour. If a
`docs/HANDOVER.md` exists, it is the current task — start there.

## Stage and non-negotiables

- **Stage: prove the logic for one person, one business.** Scale later via two-way-door decisions.
- **Nothing is ever sent automatically.** The scan must never reach `provider.publishReply`; a test
  asserts it. Auto-send is backlog item B1, behind a shadow-mode gate — do not reintroduce it.
- **Google is the system of record** for reviews and replies. No local archive of review content.
- **Audit schema is additive only.** Add fields/actions; never repurpose or remove one.
- **No remedy, refund, voucher, timeline or promise in a published reply.** Goodwill is settled
  out of band and only *recorded* (`remedy_recorded`).
- Three risk levels (`low`/`medium`/`high`) plus a `sensitive` flag. No escalation tier.
  Actions are `quick_approve` (low) and `needs_review` (everything else).

## Commands

```bash
npm install
npm run typecheck && npm test && npm run build   # all three must pass; CI runs the same + both evals + an idempotency gate
npm run eval        # routing eval: dev + holdout, gated by evals/routing/thresholds.json
npm run eval:gate   # golden evaluation gate: rules only, and rules + the replayed second reader (eval/thresholds.json)
npm run policy:stamp  # after bumping POLICY_VERSION for any change to lib/triage/{rules,match,policy}.ts
npm run scan        # seed data/store/*.json from fixtures (store is gitignored)
npm run dev         # http://localhost:3000
```

## Where things live

- `lib/triage/rules.ts` — keyword lists (strong/weak sensitive tiers, complaint, positive, themes)
- `lib/triage/match.ts` — **all** keyword matching. Word boundaries; `foo*` = prefix. Never use
  `text.includes(keyword)`: substring matching once made "issue" match "sue".
- `lib/triage/policy.ts` — deterministic routing; bump `POLICY_VERSION` when rules change
- `lib/triage/normalize.ts`, `guards.ts` — normalised matching; personal-info, link and gibberish guards
- `lib/triage/reader/` — the optional second reader: Haiku on every review, code-routed escalation to
  Sonnet (`cascade.ts`, bump `ROUTING_VERSION` when routing changes), cached replay; `triageReview.ts`
  combines it with the rules. **It can only raise, and fails closed.** BYOK: `ANTHROPIC_API_KEY`, never stored.
- `tests/fixtures/golden/` — versioned, checksum-pinned golden dataset; never edit an approved version
- `lib/drafter/` — templates filled only from approved facts; `factsUsed` records citations
- `lib/decisions.ts` — send / skip / remedy / reconciliation; persistent attempt plus local writer lock
- `lib/scan/runDailyScan.ts` — the daily worker; idempotent, never publishes
- `data/fixtures/golden.json` + `lib/__tests__/golden.routing.test.ts` — the routing rubric as data
- `evals/routing/` — labelled dev (tune here) and holdout (never tune here) sets; see `evals/README.md`
- `lib/store/schema.ts` — runtime shape checks every store read must pass; add new union members here

## Test conventions (learned the hard way)

- Tests that touch the store set `process.env.CCR_STORE_DIR` to a temp dir (see existing tests).
- Scan tests use timestamps **relative to `Date.now()`** — `listSince` compares against the real
  clock, so fixed dates silently stop being "new" and assertions pass against an empty scan.
- Never skip a test to get green: CI fails on any skipped test. Never loosen `eval/thresholds.json`
  without filling in `loosening_reason`; only tighten it as results improve.
- Never print review text, personal details or keys in logs; CI scans logs and reports for them.
- Write the failing test first; for a fix, confirm the test fails without it (mutation check).
- Every bug becomes a golden or unit case before the fix lands.

## Routing changes (learned the hard way)

- Quick approve is fail-closed. Don't add a branch that reaches `quick_approve` on the absence
  of a signal; praise must be present.
- Never read holdout failures to choose a rule. Once you do, the holdout is burned: move it into
  dev and write a fresh one (ideally labelled by someone else).
- Tighten `evals/routing/thresholds.json` when a number improves; loosening needs a DECISIONS entry.
- `shadow.wouldAutoSend` is recorded only. Nothing may read it to route or send (B1).

## Gotchas

- `feat/assurance-contracts-v0.5` is unmerged and **will compile-fail against main** (imports the
  removed `ESCALATION_KEYWORDS`, and still substring-matches). Port its checks; don't merge it.
- README screenshots: `scripts/screenshots.mjs`, captured from `npm run build && npm start`
  (the dev server stamps an indicator on every page). Playwright is not a dependency.
- Read `docs/VERIFIED_SEND.md` before changing the send boundary. B2 semantic validation, B4 live
  provider behaviour and B5 audit retention remain open. A context hash is not authentication.
- Never expire the store lock automatically or retry an uncertain send. Recovery must establish
  whether the previous process and provider operation have completed.
