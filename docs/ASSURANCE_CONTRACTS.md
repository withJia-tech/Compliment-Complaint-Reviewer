# Assurance contracts — v0.5 (proposed)

**Status:** additive and unwired. Nothing in the scan pipeline, app routes, drafter or store calls
this code yet, and no existing file was changed. It implements the code-decided parts of four
design documents: *Failure Modes, Tool Contracts and Validation v0.5*, *Deterministic vs reasoning*,
*Incident operations engineering* and *Acceptance plan fixes*. No model is called anywhere.

Every number marked **PROPOSED** in the source is a placeholder for the owner to sign off.

## Modules

| Path | What it enforces |
| --- | --- |
| `lib/assurance/types.ts` | Handoff contracts H0–H5 and the shared envelope |
| `lib/assurance/schema.ts` | Strict validators: unknown fields rejected, no coercion, no defaults |
| `lib/assurance/payloadSchemas.ts` | Shape of each handoff payload |
| `lib/assurance/envelope.ts` | Consumer rules 1–5: shape, version, source binding, abstain, payload |
| `lib/assurance/handoffs.ts` | Context rules per handoff, and the deterministic route |
| `lib/assurance/checks.ts` | Code-decided assurance checks, creativity log, H4 report |
| `lib/assurance/postits.ts` | Template post-its: ranked by severity, capped at three |
| `lib/assurance/approval.ts` | H5 gate: stale source, edits, blocked reports, post-it leaks |
| `lib/assurance/length.ts` | 4,096-byte reply cap and the length band |
| `lib/assurance/budget.ts` | Token budget per model stage and per case; no truncation |
| `lib/assurance/lexical.ts` | Safety trigger and the promise second net |
| `lib/assurance/stats.ts` | Exact binomial bounds for reporting test results |
| `lib/incidents/stateMachine.ts` | Incident lifecycle, guarded transitions, parallel tracks |
| `lib/incidents/assertions.ts` | Claim records; only named roles set judgement statuses |
| `lib/incidents/escalation.ts` | Escalation chain with stored deadlines and acknowledgement |
| `lib/incidents/evidenceTools.ts` | Purpose-bound evidence requests and clock-aware intervals |
| `lib/incidents/suppression.ts` | Small-group suppression for staff-level figures |

## Test map

| Spec IDs | Test file |
| --- | --- |
| F-09, F-11, F-13, F-14, F-15, F-16, F-20, F-23, F-31, H-04, H-14 | `assurance.handoffs.test.ts` |
| F-04, F-05, F-06, F-08, F-09, F-23, F-24, F-30, F-33, H-01, H-03 | `assurance.checks.test.ts` |
| F-15, H-13, H-19 | `assurance.approval.test.ts` |
| F-31, F-32, F-33 | `assurance.lengthBudget.test.ts` |
| Acceptance fixes 1–2 | `assurance.stats.test.ts` |
| O-01, O-02, O-13, H-18 | `incidents.stateMachine.test.ts` |
| O-03, O-04, O-05, O-08, H-06, H-07 | `incidents.assertionsEscalation.test.ts` |
| O-06, O-07, O-09, H-08, H-10 | `incidents.evidenceSuppression.test.ts` |

Model-judged tests (F-01 to F-03, F-12, F-26 to F-28) need a model and labelled fixtures, so they
are not here. F-21, F-22 and the publishing path stay deferred, as in the spec.

## Proposed values awaiting sign-off

| Value | Where |
| --- | --- |
| Review text ≤ 5,000 characters | `payloadSchemas.ts` |
| Length band: floor 15, ratio 0.5–1.0×, ceiling 150, escalated ceiling 80 | `length.ts` |
| Stage token budgets; 20,000 per case | `budget.ts` |
| Evidence window ± 120 minutes (caller passes it) | tests only |
| k = 3 staff before a figure shows | `suppression.ts` |

Escalation deadlines and the unknown-time lookback have no defaults: the owner must set them.

## Where this differs from the written spec

1. **H3 support rejects apply to model drafts only.** An owner's unsupported fact or remedy is not
   bounced at the handoff; it fails assurance and gets a post-it, so the owner keeps their words.
2. **Post-its are template-only.** The model fallback for notes no template covers is not built.
3. **The creativity log is the deterministic pass only.** Uncovered spans are logged as
   `unclassified`; the type classifier and model self-declaration are follow-ups.
4. **Reopening an incident resets mitigation and verification evidence**, because a recurrence
   needs a new fix and new proof.
5. **Staff counts merge conservatively:** max across windows, sum across sections.

## Findings from building it

- **The proposed length band is too tight for short reviews.** With a floor of 15 and a ratio
  ceiling of 1.0, the maximum for a 13-word review is 15 words, so any reply that addresses three
  aspects warns. Calibrate before use (a test records this).
- **The shared escalation keywords match substrings.** "sick" escalates slang praise ("the burgers
  are SICK"), and "slip" matches "slippers". The safety trigger reuses this list as-is; over-firing
  is the accepted cost, but the list itself could use word boundaries.
- **The existing drafter puts `review.author` into every reply.** The v0.4 decision contract keeps
  reviewer profile data out of drafting (PROVENANCE-001).
- **The existing escalation template says "we will follow up with you as soon as possible".** That
  is a follow-up commitment with no recorded action (RESP-SAFETY-001); the new promise net would
  flag it.
- **The existing pipeline can auto-publish** low-risk replies with consent, while v0.4 requires human
  approval for every external reply in the initial release.

None of these were changed here.

## Not built yet

Metric and experiment registries, retention jobs, the promote-to-fact gate, duplicate-incident
linking, rubric scoring, every model stage, and wiring into `runDailyScan`.

## Running the tests

```bash
npm install
npm test
```

The tests use vitest like the rest of the repo. They were verified in an environment where
`npm install` was blocked, by running them on Node's built-in test runner through a local stand-in
for the vitest API; the first `npm test` with real vitest is the confirming run.
