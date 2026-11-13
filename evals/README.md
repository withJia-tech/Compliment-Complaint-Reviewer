# Routing evals

`data/fixtures/golden.json` is the **regression rubric**: hand-picked cases that pin specific
decisions. This folder is the **measurement**: labelled sets scored with rates, so a rule change
shows its effect on the whole distribution and not just on the cases someone remembered.

```bash
npm run eval          # score dev + holdout, write evals/reports/latest.json, fail on a breached gate
npm run eval:report   # score without gating
```

`npm test` runs the same gates (`lib/__tests__/evals.routing.test.ts`), so a regression cannot
merge quietly. CI also runs `npm run eval` and uploads the JSON report as a build artifact.

## Sets

| Set | Cases | Role | Rule |
|---|---|---|---|
| `routing/dev.json` | 60 | Tuning | Look at failures, change rules, re-run. |
| `routing/holdout.json` | 40 | Generalisation check | **Never tune against it.** Read the score, not the failures. |

Each case is labelled with what a careful human needs, not what the rules currently do:

- `mustReview` — a person has to read this before any reply goes out.
- `sensitive` — the sensitive category it belongs to, or `null`.

Tags (`contrast`, `sarcasm`, `non_english`, `sensitive_paraphrase`, `idiom`, …) let the report
break results down by failure mode.

## Metrics, in priority order

1. **Unsafe quick approvals.** A `mustReview` case offered as a one-click approve. This is the
   safety metric; the target is 0.
2. **Shadow unsafe auto-send.** A `mustReview` case the parked B1 rule would have auto-sent.
   B1 cannot leave shadow mode while this is above 0 on a set nobody tuned against.
3. **Sensitive recall**, overall and per category. A missed sensitive claim is still read by a
   person if it isn't quick-approved, but without the flag it isn't sorted to the top or given
   the sensitive template.
4. **False alarm rate.** Safe cases sent to review: the owner's workload cost of caution.

## Results

| Metric | v1.0.0 dev | v1.0.0 holdout | v1.1.0 dev | v1.1.0 holdout |
|---|---|---|---|---|
| Unsafe quick approvals | 20 / 60 | 15 / 40 | 0 | **5** |
| Shadow unsafe auto-send | — | — | 0 | **4** |
| Sensitive recall | 57% | 15% | 95% | **15%** |
| False alarm rate | 22% | 14% | 0% | 29% |

How to read this:

- **Dev looks solved because it was tuned on.** That number is not evidence.
- **Fail-closed routing generalised.** Holdout unsafe approvals fell from 15 to 5 without
  looking at the holdout. Requiring praise to be present, treating contrast words as a
  reservation, and routing unreadable text to a person are structural rules, not word lists.
- **Keyword additions did not generalise.** Holdout sensitive recall did not move. Paraphrased
  claims ("spent the night in A&E", "people like us should eat elsewhere") don't share words
  with the dev phrases. More keywords won't fix this; it needs a classifier evaluated on this
  same harness behind the `TriagePolicy` interface.
- **B1 stays parked.** The shadow rule would have auto-sent 4 holdout reviews a person must read.

## Gates

`routing/thresholds.json`. Dev gates are strict. Holdout gates are a **ratchet** at the v1.1.0
measurement: they stop regression; they do not say v1.1.0 is good enough. Tighten a number when
the policy improves. Loosening one needs a `docs/DECISIONS.md` entry.

## Known limits of this set (read before trusting the numbers)

- **Same author.** Both sets were written and labelled by the same person who wrote the rules,
  and the holdout ids were visible during v1.1.0 work (the rules were not tuned to them). The
  next holdout must be labelled by someone else, against this README's label definitions,
  before anyone reads the rules.
- **Small.** 13 holdout sensitive cases means each one moves category recall by 33–50 points.
  Treat per-category numbers as direction, not measurement, until the set is 150–300 cases.
- **Synthetic.** Written to probe failure modes, not sampled from real traffic. Once the live
  provider lands, sample real reviews (with the data-residency decision in `docs/DECISIONS.md`
  #5 respected) and label those.
- **Single-label `mustReview`.** Labeller disagreement isn't measured yet. Double-label a
  sample and report agreement before setting tighter gates.

## Retiring a holdout

Once you have looked at holdout failures to decide a rule change, that holdout is burned: move
its cases into dev and write a fresh holdout. Record the swap in `docs/DECISIONS.md`.
