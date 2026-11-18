# PR #7 mobile verification — 18 November 2026

## Scope and authority

The user authorised applying the proposed test patch on a separate PR #7 verification branch, optional navigation wording and fixes within this verification scope. Name masking was separately authorised for GitHub source and the GitHub Pages demo. Daily-intake improvements, model integrations, durable memory, merging and review replies are excluded.

Branch: `verification/pr7-mobile-navigation-20261118`. Starts from inspected PR head `5cbb6c038b297d77cce27a42b2da7da8dd195489`, includes the same privacy changes published as `5d0cb9f1f32678327210bbad82b8f402bfa3d40b`, then verification changes. The below-five owner-attention candidate remains a separate local branch and is not part of this candidate.

No pre-existing checkout was reset or overwritten. Both proposed patches passed `git apply --check` before application. Neither patch overlapped the privacy changes. Node 24.22.1, npm 11.9.0, existing locked dependencies reused; no new package or lockfile changes.

## What changed

- `hosted.demo.test.ts`: 21 tests instead of 11. Fifteen mutation method/path cases, twelve GET/HEAD redirect checks, eight allowed-route checks, the companion subroute boundary, storage blocked with either hosted flag, and a local-development control. Loop assertions are not counted as independent Vitest test cases.
- `scripts/verifyCompanionMobile.mjs`: the seven proposed browser scenarios, unchanged acceptance assertions. No automatic app rebuild, non-GET/HEAD browser requests blocked, no external reply approval clicked.
- `BehindTheHood.tsx`: “Open a fresh demo” plus explicit guidance to switch to the original tab for an unsent draft. It states reload/tab-closure recovery is unavailable.
- `companion.navigation.test.ts`: four tests for copy/lifetime distinctions, relative prefix links, read-only markup and generated-bundle correspondence.
- Static bundle regenerated because the approved wording changed. This is required artifact maintenance, not a Review Desk redesign. No state-storage or cross-tab architecture was introduced.

## Exact local results

| Check | Result | Limit |
|---|---|---|
| New guard and navigation tests before regenerating artifacts | 24 pass / 1 fail, exit 1 | Failure: generated companion still had old wording while source had new wording |
| Final full `npm test` | 184 pass / 0 fail; 15 files; exit 0 | Includes 21 guards + 4 navigation contracts; excludes browser runner |
| Typecheck | Exit 0 | Static type evidence |
| Production build | Exit 0 | Compiled successfully; browser behaviour not established |
| Static comparison build | Exit 0; 16 cases, two datasets | Candidate hash below, not deployed |
| Browser runner syntax | `node --check scripts/verifyCompanionMobile.mjs`, exit 0 | Syntax only |
| Seven mobile browser scenarios | NOT_RUN / environment blocked | Prior Chromium launch failed on prohibited local socket; WebKit binary absent; no physical device |

Candidate bundle hash: `7ef081349a6cedac510d67e39b73720775df816529807265140c24569accaa73`.

The fresh-session wording resolves misleading navigation copy. It does **not** implement draft recovery. The strict return-link assertion still expects the original marker and is expected to fail if run against this architecture. That assertion has not been weakened, skipped or converted into a fresh-fixture expectation. Same-tab Back depends on browser lifecycle/cache behaviour and remains unverified. Playwright's defaults can disable back-forward cache; retain the engine and launch configuration with any outcome.

## Browser execution in a suitable environment

Use the checked-in bundle; do not rebuild merely to run browser tests. Required: Node >=22.13, Playwright 1.62.1, installed Chromium/WebKit and OS dependencies, permitted browser process/socket operations, reachable URLs. These tools may live outside the repository.

```sh
npm test
npm run typecheck
python3 -m http.server 4177 --bind 127.0.0.1 --directory comparison/dist
# Separate terminal:
DEMO_BASE_URL=http://127.0.0.1:4177/ DEMO_KIND=static MOBILE_ENGINE=chromium PLAYWRIGHT_MODULE=/absolute/test-tools/node_modules/playwright/index.mjs node --test scripts/verifyCompanionMobile.mjs
```

Repeat with WebKit and the actual deployment prefix. Seven scenarios cover direct routes/assets, opening/closing a new tab, strict return-link recovery, same-tab Back, 320/390/412 CSS-pixel portrait and 844 landscape layouts, reload/session-only decisions, and operational GET/HEAD routes. A launcher failure means the assertions did not execute; it is not seven product failures.

On iPhone/Android additionally record OS/browser, normal tap and long press, tab switch/close, back gesture, keyboard and text scaling, portrait/landscape, backgrounding and tab discard. Compare exact unsent text, selected case and confirmation. Simulated decisions are not durable approvals. The stricter recovery requirement is an open product gate; no memory store should be added solely to hide it.

## GitHub publication evidence — privacy only

| Surface | Observed result |
|---|---|
| PR #7 source branch | `5d0cb9f1f32678327210bbad82b8f402bfa3d40b`; open, draft, unmerged after update |
| Source-local tests | 170/170, typecheck exit 0 |
| PR CI | [Run 44321822284](https://github.com/withJia-tech/Compliment-Complaint-Reviewer/actions/runs/44321822284): successful install, types, tests, routing eval, artifact upload, build, idempotency |
| CI test identity | 201/201 tests, 17 files, on GitHub's temporary merge of privacy head into `cfe0daf`; not the standalone 170-test source tree |
| Pages source | `de98c2225d6e97e7241f3a23a48b8fc16c63e60a`; only app.js and build.json changed |
| Pages deployment | [Run 44321942259](https://github.com/withJia-tech/Compliment-Complaint-Reviewer/actions/runs/44321942259) succeeded |
| Live Pages bytes | Five of five files match the local privacy bundle; independently recomputed digest matches |
| Live privacy hash | `6894a059e25de591320a27ee9c10d6b4c7460d76ae8744811b77fbf9b1c6f0ea` |
| Vercel comparison host | HTTP 200 manifest still showed old `154fc78c…` during this turn; no Vercel update performed |
| ChatGPT Sites | No update or fresh live verification; previous owner-only reads were blocked |

The first immediate post-push Pages read still returned the old bundle; after successful deployment, all five files matched the new bundle. Push success, deployment success and live byte identity are three separate observations. The verification wording/build has not been deployed. Main remains `cfe0daf`; historical Git versions still contain original names. Pseudonymisation is not erasure or complete anonymisation: searchable review wording and business remain.

Evidence: `docs/evidence/pr7-mobile-20261118/`. Full logs preserve failures and final results. These finite examples provide no statistical population-error bound, model-quality result or mobile certificate.
