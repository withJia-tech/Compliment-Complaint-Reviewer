# Handover — prove the cheaper reader (B13), then decide the learning-loop and Google questions

**20 November local update:** the owner approved the reader-evidence hardening patch only.
See [READER_EVIDENCE_HARDENING.md](READER_EVIDENCE_HARDENING.md) for current controls, tests
and the bounded run proposal. Historical commands below no longer authorize or initiate a run
without explicit budget/output arguments. No paid run, push or merge is authorized.

Written 2026-11-13. Read `CLAUDE.md`, `SPEC.md`, `docs/DECISIONS.md` and
`docs/LEARNING_LOOP_PLAN.md` first. Delete this file when the items below are done.

## How the owner wants to work

- Ask the open questions before writing code.
- When their framing may be wrong, say so **at the top**, with the reason, before doing the work.
- Artifacts on light backgrounds that read well in glare.
- End each reply with a brief token estimate and the share of the context window remaining.
- Commit and push to the working branch as you go; open a PR only when asked.

## Where things stand

- PR #5 (verified send, Dataset 2, hosted demo) is **merged** to `main` (`809c0ef`). `main` is merged
  into branch `claude/golden-risk-classifier-v1` (pushed, **no PR yet**): typecheck, 259 tests (none
  skipped), build, scan idempotency and the log-leak check pass. `npm run eval:gate` **fails on
  purpose** until the owner commits an evaluation run.
- **B13 (was B11) built, not yet proven.** `main` (PR #8) is merged in; rules are now
  `policy-v1.2.0` (decision 18), so the evaluation run can be recorded now and will stay valid.
  Haiku 5.5 reads every review; code (`routing-v1`) escalates the uncertain ones to Sonnet 5.5
  (decision 15). The gate checks the exact reader id and cost per review, max 1¢ (decision 16).
  Quality thresholds are unchanged except false alarms, now at most 4 (decision 18).
- **Golden v1 approved** (decision 17). Frozen: changes need a v2.
- **OAuth token storage:** assessed, recommendation recorded as *proposed* in `DECISIONS.md`.
- **Learning loop:** reconciled plan in `docs/LEARNING_LOOP_PLAN.md`, planning only, with
  decisions D2 and D4–D8 still open (D1 and D3 decided).

## Waiting on the owner

1. Review the bounded run proposal in `READER_EVIDENCE_HARDENING.md`. A fresh explicit approval
   is required before using an API key or recording model output. `npm run read:golden` is safe
   without a key and makes no requests. A demo recording is not needed for the golden gate.

2. Decisions D2 and D4–D8 in `docs/LEARNING_LOOP_PLAN.md` (D1 and D3 are decided).
3. Google route for B12 (API with OAuth, MCP connector, or both), and apply for Business Profile
   API access: approval is the long pole.
4. Repo settings: make the CI checks **required** on `main`; turn on secret scanning with push
   protection.

## Next tasks once the run is in

- If the gate fails on quality: fix routing (bump `ROUTING_VERSION`) or the prompt; never loosen
  `rules_plus_reader` thresholds.
- Open the PR for this branch once the evaluation run is committed (the gate fails until then).
- B10 tenant key, then B12.

## Environment notes

- This cloud environment cannot take an Anthropic key: live model runs happen on the owner's
  machine; CI replays saved readings.
- The sandbox cannot reach Sigstore, so `npm audit signatures` only runs in CI.
