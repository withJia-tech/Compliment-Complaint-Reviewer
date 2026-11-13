# Handover — prove the cheaper reader (B11), then decide the learning-loop and Google questions

Written 2026-11-13. Read `CLAUDE.md`, `SPEC.md`, `docs/DECISIONS.md` and
`docs/LEARNING_LOOP_PLAN.md` first. Delete this file when the items below are done.

## How the owner wants to work

- Ask the open questions before writing code.
- When their framing may be wrong, say so **at the top**, with the reason, before doing the work.
- Artifacts on light backgrounds that read well in glare.
- End each reply with a brief token estimate and the share of the context window remaining.
- Commit and push to the working branch as you go; open a PR only when asked.

## Where things stand

- Branch `claude/golden-risk-classifier-v1` (pushed, **no PR yet**). Typecheck, 209 tests (none
  skipped) and build pass. `npm run eval:gate` **fails on purpose** until the owner commits an
  evaluation run.
- **B11 built, not yet proven.** Haiku 5.5 reads every review; code (`routing-v1`) escalates the
  uncertain ones to Sonnet 5.5 (decision 15). The gate checks the exact reader id and cost per
  review, max 1¢ (decision 16). Quality thresholds unchanged.
- **Golden v1 approved** (decision 17). Frozen: changes need a v2.
- **OAuth token storage:** assessed, recommendation recorded as *proposed* in `DECISIONS.md`.
- **Learning loop:** reconciled plan in `docs/LEARNING_LOOP_PLAN.md`, planning only, with
  decisions D1–D8 for the owner.

## Waiting on the owner

1. With your key, on your machine:
   ```bash
   npm run read:golden -- --yes   # writes tests/fixtures/golden/readings/risk_classifier_v1.json
   npm run read:demo -- --yes     # writes data/readings/demo.json
   npm run eval:gate              # should now pass, or show exactly which fixtures miss
   git add tests/fixtures/golden/readings data/readings && git commit -m "Record evaluation run" && git push
   ```
   Optional comparison (not committed): `CCR_READER_MODEL=claude-sonnet-5-5
   CCR_READER_ESCALATION_MODEL=off npm run read:golden -- --yes --out /tmp/sonnet.json`.
2. Decisions D1–D8 in `docs/LEARNING_LOOP_PLAN.md`; D1 (merge order) and D3 (Dataset 2 on PR #5)
   come first.
3. Google route for B12 (API with OAuth, MCP connector, or both), and apply for Business Profile
   API access: approval is the long pole.
4. Repo settings: make the CI checks **required** on `main`; turn on secret scanning with push
   protection.

## Next tasks once the run is in

- If the gate fails on quality: fix routing (bump `ROUTING_VERSION`) or the prompt; never loosen
  `rules_plus_reader` thresholds.
- PR 0 of the learning-loop plan (merge the two lines, keep `triageReview` in the scan).
- B10 tenant key, then B12.

## Environment notes

- This cloud environment cannot take an Anthropic key: live model runs happen on the owner's
  machine; CI replays saved readings.
- The sandbox cannot reach Sigstore, so `npm audit signatures` only runs in CI.
