# Start here in a fresh Codex work session

Prepared 18 November 2026. No API control for creating a fresh Codex work session was exposed, so the previous session prepared this portable branch and handoff. A new session must not claim it was already created.

## Repository and starting point

Repository: `withJia-tech/Compliment-Complaint-Reviewer`.
Start from branch `verification/pr7-mobile-navigation-20261118`.
Read `docs/PR7_MOBILE_VERIFICATION.md` and `docs/CONTRACT_METRIC_MAP.md` first.

Reinspect current branch/head, dirty files, remote references and applicable instructions before edits. Never overwrite an existing checkout. Do not assume a PR description or a passing count describes the selected branch.

## User's current authorisation

- Apply the mobile test proposal on a separate PR #7 verification branch, including optional wording and implementation fixes within that scope.
- Push the real-example name masking to GitHub so the source and GitHub Pages demo reflect masked names. This has been completed as recorded below.
- Keep regression work bounded; assess memory/context trade-offs before selecting cloud, tenant storage or learning infrastructure.
- Inventory output contracts and handoffs, tie tasks to measured evidence, and surface discrepancies and useful product questions.
- No merge, review replies or unrelated daily-intake improvements. No new model provider, real-data model egress, automatic learning or production memory architecture is selected. Further publication of verification or routing features is not part of the completed privacy deployment.

## Established state and evidence

| Work | Exact identity / status |
|---|---|
| PR #7 before privacy | `5cbb6c038b297d77cce27a42b2da7da8dd195489` |
| PR #7 privacy source | `5d0cb9f1f32678327210bbad82b8f402bfa3d40b`, branch `codex/owner-review-desk`; open/draft/unmerged at verification |
| Privacy local verification | 170 tests pass; typecheck passes |
| PR CI | Run 44321822284: 201 tests pass on temporary PR+main merge; not the standalone PR tree |
| Main | Direct ref checked at `cfe0daf7473a54c04fb54d53f14c746cce2b5b3b`; do not replace its newer fail-closed policy with the older PR policy |
| GitHub Pages | `de98c2225d6e97e7241f3a23a48b8fc16c63e60a`; run 44321942259 successful; 5/5 live files matched privacy artifact |
| Privacy live digest | `6894a059e25de591320a27ee9c10d6b4c7460d76ae8744811b77fbf9b1c6f0ea` |
| This verification branch | Privacy changes + 21 hosted guards + four companion contract tests + seven-scenario browser runner + wording clarification |
| Verification local result | 184 tests pass, types/build/static build pass, runner syntax passes; browser scenarios NOT_RUN |
| Verification artifact digest | `7ef081349a6cedac510d67e39b73720775df816529807265140c24569accaa73`; not deployed |
| Previous owner-attention slice | Separate local candidate; focused 16 fail/57 pass → 73 pass; full 189 pass. Four-star low-risk praise requires review; no semantic model added |
| Original cfe0daf development ZIP | Separate regression branch: 200 pass/3 fail overall; added suite 17 pass/3 fail. C3/D1 false sensitive flags for burnt taste/food; D2 missed scalded-hand sensitivity |

Vercel still served the old comparison manifest at the latest read in this session. Sites was not updated or freshly verified. Main and historical Git versions still contain prior content; masking is not complete anonymisation or history erasure.

## Portable preservation of the separate routing work

`docs/handoff/owner-attention-source.patch` preserves the *incremental source changes* from the privacy snapshot to the approved local owner-attention candidate. Generated bundle files and prior raw evidence logs are excluded. Applicability was checked against the exact privacy source tree. It is an artifact, not an applied part of this verification branch.

To inspect/reproduce it, use a separate clean checkout based on `5d0cb9f1f32678327210bbad82b8f402bfa3d40b`, inspect the patch, run `git apply --check`, then apply only within the user's already approved routing scope. Run tests/typecheck and rebuild artifacts. Do not apply wholesale to main: compare its newer v1.1.0 policy and promotion gate first. A reproduced result is new evidence; do not inherit 189 passes without running it.

The original development ZIP remains a separate user attachment and is not silently transplanted into this branch. Its source files in the previous workspace were `docs/OWNER_LEARNING_DEV.md`, `evals/routing/owner-learning-dev.json`, `lib/__tests__/owner.learning.dev.test.ts`, all untracked at cfe0daf. The user can supply that ZIP to a new environment if that line of work is needed.

## Remaining verification gate

The live original tab retains React state while the companion opens separately. The companion link opens a fresh demo in its own tab. New wording makes this clear, but the strict browser test still requires a return link to recover the original unsent marker and is expected red for the current design. Do not weaken or skip it to obtain a green result.

Browser execution was blocked by Chromium local-socket permissions and missing WebKit; no physical iPhone/Android was available. Do not bypass browser security controls. Use a supported environment and run the seven scenarios, retaining exact host, artifact, engine/viewport, lifecycle and draft comparisons. Same-tab Back, narrow layout, keyboard, tab discard and long-press/new-tab behaviours remain unverified. The existing HTTP and SSR observations are not mobile proof.

Clarify whether switching to the original live tab satisfies the desired return contract. If return-link recovery is mandatory, prepare the smallest explicit state/navigation design, including stale drafts, duplicate tabs, confirmation invalidation, privacy and reload semantics. The user allowed fixes, but did not select a new durable memory/tenancy architecture. Avoid a cross-tab or persistence shortcut that quietly expands trust or data retention.

## Build Spine and next design boundary

Model: interpretation, candidate claims, optional rewrite. Code: schema/evidence/scope/freshness/policy, readiness, tool permissions and persistence. Human: contextual judgment and final approval. H0–H5 are proposed output contracts; current runtime types are only partial counterparts. An owner correction is attributed context, not automatic truth or a global learned rule.

Cloud vs per-business storage is not a binary choice. Ask which devices/people need recovery, who operates the service, what context may be reused and who can delete it. Keep case working context, approved business facts, learning candidates, promoted examples and authoritative audit state separate. ADR-001 stays open.

No real model calls occurred. Do not claim sarcasm recognition, learned slang, calibrated error bounds, durable production approval or completion of v0.7 G1–G4. Known development cases are not the unseen evaluation set.

## Suggested first message in the new session

> Continue ComplimentOrComplaint from branch `verification/pr7-mobile-navigation-20261118`. Read `docs/CODEX_NEXT_SESSION.md`, inspect current Git state and the linked evidence before changes. Preserve all existing work. Continue the authorised mobile verification and bounded fixes; keep the original return-link assertion visible. Explain the next diagnostic hypothesis and ask only for the product/storage decisions that materially change implementation. Do not merge, send review replies, introduce a provider/memory architecture or publish additional features without the applicable authorisation.
