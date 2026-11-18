# PR #7 / PR #11 compatibility — 18 November 2026

The source and data-contract conflicts are reconciled in this separate candidate. **It is not merge-ready: two existing workload evaluation gates fail.** No source PR was merged, retargeted or updated, no deployment was performed, and no review reply was sent during this compatibility task.

## Exact inputs and branch relationship

| Input | Inspected revision | Role |
|---|---|---|
| Current `main` | `cfe0daf7473a54c04fb54d53f14c746cce2b5b3b` | Newer fail-closed routing, store validation, injected decision dependencies, evaluation and policy gates |
| [PR #7](https://github.com/withJia-tech/Compliment-Complaint-Reviewer/pull/7) | `5d0cb9f1f32678327210bbad82b8f402bfa3d40b` | Review Desk, read-only companion and masked dataset; open draft |
| [PR #11](https://github.com/withJia-tech/Compliment-Complaint-Reviewer/pull/11) | `6420809a4c04ccbb0a332d42c0740a1ab917bc21` | One commit on PR #7; below-five owner attention; open draft targeting PR #7 |
| Separate mobile verification | `01956e2a5edfb62e65e347c9f82df88f5302a791` | Approved companion wording, navigation checks, browser runner and accepted pilot-memory requirements |

PR #11 already contains PR #7's source changes and masked data. It is not an independent replacement for #7. Both diverge from current main at `809c0ef8b90306f735c245ccd6b4ddd360885e65`. The main-based candidate is `compatibility/pr7-pr11-main-20261118`; its single-parent history does not merge either source PR. Existing work in six other checkouts was hashed before/after and remains unchanged.

`git merge-tree` (analysis only, no branch merge) found five conflicts: `data/fixtures/golden.json`, `lib/triage/explain.ts`, `policy.ts`, `policyVersion.ts`, and `rules.ts`. Merely taking PR #11's files would discard main's protections. Taking main's files would lose the approved four-star attention rule.

## Resolved behaviour and documented assertion changes

The candidate policy is **`policy-v1.1.1-owner-attention.1`**. It retains main's sensitive checks, injected clock, language checks, contrast/complaint checks, unconfirmed-praise route, idiom handling and non-executing shadow output. The four-star floor follows these stronger checks. All actual sends still need human confirmation; the daily scanner cannot publish.

| Case | Earlier expectation | Candidate expectation and reason |
|---|---|---|
| Four-star praise with no stronger signal | Main: low / quick approve | Low / non-sensitive / needs review, `rating_below_five`; explicit owner requirement |
| Four-star “Great service—only waited fifty minutes.” | PR #11: low / `rating_below_five` | Medium / non-sensitive / `neutral_mixed_sentiment`; retain main's recognised complaint instead of downgrading it |
| Four-star “That croissant was dope—absolutely delicious.” | PR #11: low / needs review | Same. “Delicious” supplies the praise hint; this does not establish learned understanding of “dope” |
| Five-star complaint, contrast or unreadable-language signal | Older PR #7 may miss it | Preserve main's stronger review route; this is still heuristic interpretation |
| Known safety allegation at four or five stars | Sensitive review | Preserve precedence; star ratings cannot bypass it |
| Older stored four-star quick recommendation | Historically quick | Show current attention requirement without changing the stored classification or audit history |

All **32** main golden cases remain. Only the two clean four-star cases change their reason from `positive_no_complaint` to `rating_below_five`; all 32 now assert the recommended action explicitly. The existing PR #11 wait-complaint assertion is updated with an explanatory comment. No failure is skipped or converted to an expected failure.

The new reason must also be accepted by `lib/store/schema.ts`. The first new persistence regression failed with `StoreIntegrityError` when reading a freshly written four-star classification. Adding the reason to the exhaustive runtime schema resolves this without weakening validation; unknown reasons still fail, and legacy records remain readable.

The companion now describes the actual ordered rules, links both PRs, and identifies historical CI evidence as historical. Its return links say **Open a fresh demo** and explain that the original unsent draft lives in the original tab. This wording is not draft recovery. The separate browser runner retains its strict return-to-draft assertion.

## Exact fresh verification

Local runtime: Node 24.22.1, npm 11.9.0, reused installed dependencies. The lockfile is unchanged from main. This is not a new clean-install or GitHub CI result. Log copies remove terminal colours and trailing whitespace only; raw and saved SHA-256 values are recorded in `log-formatting.json`. Logs are under [evidence/pr7-pr11-compatibility-20261118](evidence/pr7-pr11-compatibility-20261118/).

| Check | Exact result |
|---|---|
| Main baseline, `npm test` | **183 passed**, 15 files, exit 0 |
| PR #11 baseline, `npm test` | **189 passed**, 16 files, exit 0 |
| Initial combined rules, before remaining corrections | **215 passed / 5 failed**, 19 files, exit 1: workload gates ×2, wait-complaint expectation, manifest source/version ×2 |
| Initial combined typecheck | Exit 2: runtime reason enum missing `rating_below_five` |
| New compatibility regressions before schema fix | **6 passed / 1 failed**: new reason could be written but not read |
| Final full suite | **239 passed / 2 failed**, 21 files, exit 1; only dev/holdout workload gates remain failing |
| New compatibility regressions within that full run | **7/7 passed** |
| Typecheck | Exit 0 |
| Next.js production build | Exit 0 |
| Static comparison build | Exit 0; 16 cases across the existing two datasets |
| Routing evaluation, same script through Node's TS loader | Exit 1; same two workload threshold breaches |
| Repeated scan in a temporary store | Exit 0 twice: **11 processed, then 0** |
| Mobile runner syntax | Exit 0; **seven browser scenarios NOT_RUN** |
| Privacy scan of derivative dataset and generated public assets | **0 exact original author matches; 5/5 masked aliases present**; not full anonymisation or history erasure |

The TS loader commands were `node --import tsx scripts/evalRouting.ts`, `scripts/stampPolicy.ts`, and `scripts/dailyScan.ts`. They run the same worker scripts without the `tsx` CLI's blocked local IPC pipe. No browser restriction was bypassed. Unit/SSR and middleware checks are not mobile proof.

The new seven checks pin interpretation precedence at both ratings, injected time/shadow output, runtime persistence/legacy-read compatibility, and one cohort's route → queue order → daily brief → risk totals → weekly/monthly theme workload. The cohort expects 5 active = 1 urgent + 3 review + 1 positive, with four of five food mentions requiring attention. It does not label all four as complaints.

## The two remaining failures: measurement contract versus attention policy

**Labels, thresholds, evaluation implementation and gate tests are byte-identical to main.** No holdout cases were inspected to select or tune routing rules. Only aggregate results were reviewed.

| Metric | Main dev (60) | Candidate dev (60) | Main holdout (40) | Candidate holdout (40) |
|---|---:|---:|---:|---:|
| Unsafe quick approvals | 0 | 0 | 5 | 4 |
| Sensitive cases flagged | 20/21 | 20/21 | 2/13 | 2/13 |
| Review route on legacy “safe” labels | 0/18 (0%) | **5/18 (27.78%)** | 4/14 (28.57%) | **6/14 (42.86%)** |
| Workload limit | 25% | **FAIL** | 30% | **FAIL** |
| Hypothetically unsafe shadow sends | 0 | 0 | 4 | 4 |

The workload numerator rises because the new contract deliberately requires review for four-star cases previously labelled safe to quick-approve. The original rate remains visible and failing. This is a genuine workload increase; calling it a semantic error alone would also be misleading. The routing change does **not** improve sensitive detection: holdout recall remains 2/13. Shadow results are measurements, never authorisation to send.

Before any integration into main, record a separate evaluation-contract decision: distinguish mandatory owner attention from unnecessary semantic/safety escalation, preserve this legacy series, and freeze the revised workload metric and acceptance budget before measuring again. Do not retroactively relabel holdout examples or raise a limit just to make this candidate green. A fresh independently labelled set is needed to support broader interpretation claims. The approved below-five rule remains implemented while that decision is open.

## Build Spine: contracts and remaining handoffs

| Boundary | Current contract / owner | Evidence and limitation |
|---|---|---|
| Source → classification | `ClassificationInput`: id, stars, text; deterministic policy | Main safeguards retained; no model or semantic guarantee |
| Classification → storage | `TriageResult`: version, reason, action, risk, sensitivity, time, optional shadow | Exhaustive TS union and runtime schema agree; round-trip and legacy tests pass |
| Classification → owner desk | Shared attention predicate, severity-first ordering | Labels, daily counts and theme workload use the same requirement; classifications/history are not rewritten |
| Draft → decision | Source/draft/fact context, confirmation, validation, fixture decision handler | Main's injected dependencies, locking and uncertain-delivery behaviour unchanged; no production authenticated approval |
| Desk → companion | Separate tab, read-only page, relative static links | Source/SSR/asset/middleware checks pass; browser Back, tab lifecycle and narrow layouts remain unverified |
| Draft/context → durable memory | Accepted [pilot-memory policy](PILOT_MEMORY_POLICY.md) | One owner, phone + desktop, both datasets; PM-01–PM-10 NOT_RUN; no provider, auth or store chosen |
| Correction → future interpretation | Reviewable candidate, owner context, explicit promotion | No automatic learning, global slang exemption, model integration or trusted-state write implemented |

The development-only ZIP regressions against `cfe0daf` remain in their original separate checkout. Their three known sensitivity failures were not fixed, relabelled or folded into this suite. Daily-intake fixture improvements are also separate. v0.7's broader H0–H5 handoffs, no-external-action approval transition, semantic assurance and production identity/state contracts remain later slices; this branch does not claim those releases are implemented. ADR-001 remains open.

## Deployment and mobile evidence

Candidate static content digest: `c44c15d91388daf4faab9c1ca0d7fe6ce747f2c61c55a6736360c26f1a6f1d7f`. **Not deployed.**

Fresh read-only `build.json` requests to GitHub Pages and Vercel returned 200 with `1699f4c20e54ed3cfb15cfe56bde737de7f702687f928794725f2a774aa86255`, matching the published PR #11 bundle's reported digest. This turn checked manifests, not every live asset or interaction. ChatGPT Sites returned 403; its current live content is unverified here. Earlier PR descriptions and deployment claims remain historical evidence.

The inherited mobile runner needs Playwright plus installed Chromium/WebKit, an environment permitted to launch them, and a served static or Next.js build (`DEMO_BASE_URL`, `DEMO_KIND`, optionally `MOBILE_ENGINE` / `PLAYWRIGHT_MODULE`). The prior environment could not launch Chromium and lacked WebKit. No browser rerun or physical-phone check was attempted here. The strict companion-return assertion remains expected to fail with the current fresh-session link. Back-cache restoration, narrow layouts, new-tab behaviour under mobile lifecycle/memory pressure, and cross-device draft recovery are not established by passing unit tests. Refresh/closure and another device have no durable draft to retrieve.

Keep both source PRs draft and preserve the dependency #11 → #7 while reviewing this candidate. Any later stack update must carry main's safeguards, this schema addition and the full policy identity together, regenerate the bundle, rerun gates and recheck source heads. Branch ordering alone cannot resolve the remaining measurement contract or certify mobile behaviour.
