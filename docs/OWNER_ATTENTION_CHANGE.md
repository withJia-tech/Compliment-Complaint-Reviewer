> Historical PR #11 evidence. The main-based compatibility candidate and its different test/evaluation results are recorded in [PR7_PR11_COMPATIBILITY.md](PR7_PR11_COMPATIBILITY.md).

# Owner attention below five — approved scoped change

18 November 2026. Draft follow-up to PR #7; not deployed or promoted to main.

## Source and authority

The user approved proceeding with the documented below-five-star routing rule and
consistent queue presentation/tests, after the interpretation/context/learning plan.
No model integration, new memory store, owner-clarification workflow, automatic
publishing, merge or deployment is part of this instruction.

Initial preparation base: PR #7 `5cbb6c038b297d77cce27a42b2da7da8dd195489`, with the preceding
`dataset2-v2-name-masked` changes copied into this isolated branch.
Final review parent: `5d0cb9f1f32678327210bbad82b8f402bfa3d40b`, the subsequently pushed
PR #7 masking commit; its privacy changes are retained. The prior privacy,
mobile-inspection and cfe0daf regression workspaces remain separate and unchanged.
Preparation branch: `policy/pr7-owner-attention-20261118`.
GitHub review branch: `codex/owner-attention-and-masked-demo`.

Policy identity: `policy-v1.0.1-owner-attention.1` (previous local base: `policy-v1.0.0`).
The prior main inspection at cfe0daf has a separate policy-v1.1.0 and promotion gate.
This candidate must not replace it wholesale; its fail-closed/language safeguards
need an explicit comparison before integrating with main. No merge was attempted.

## Explicit requirement change

| Case | Previous expected result | New expected result | Preserved properties |
|---|---|---|---|
| Four-star praise | quick_approve / positive_no_complaint | needs_review / rating_below_five | Low risk; not sensitive; source wording and matched praise hints |
| Four-star no detected signal, including a bare rating | quick_approve | needs_review | No invented complaint, injury, sentiment certainty or staff blame |
| Four-star recognised complaint or injury | needs_review | needs_review | Existing category/severity and more specific reason |
| Five-star control and recognised complaint | Existing decisions | Unchanged | Human confirmation, sensitive precedence and no automatic send |

The historical unit test “classifies a clean 4-star review as low risk, quick approve”
now explicitly requires review and checks that risk and sensitivity stay unchanged.
Two golden cases change their primary reason: “clean 4-star praise” and the
“fellow must not match fell” false-positive guard. Every golden case now states an
explicit expected action; expected actions are static fixture labels, not generated
from the implementation during a test. No existing input text or unrelated expected
category/severity/theme was changed. No test was skipped or marked expected-failure.

## Implementation and effects

- Sensitive detection and complaint checks still run before the four-star branch.
  A rating hold cannot hide a recognised injury signal. Five-star semantics are unchanged.
- `lib/triage/attention.ts` supplies one current attention predicate and severity-first
  ranking to the desk, stored queue, hosted dataset order and theme rollups.
- Four-star low-risk cases display Needs review / Review & approve and an attention
  colour. Daily-brief groups remain disjoint; low-risk metrics still count them as low.
- Held low-risk cases sort before quick-review low-risk cases; delivery-unknown and
  sensitive/high/medium cases retain priority. Dates break ties within the same group.
- Weekly/monthly `needsAttention` reflects the current attention requirement, including
  four-star low-risk cases. It is not a count of confirmed grievances or a rewrite of
  historical decisions. Period/date denominators and daily-intake logic are untouched.
- Older pending four-star results still stored as quick_approve display the current
  review requirement, with an explanation that their recorded policy is older. Reading
  the queue does not rewrite triage or audit records. Completed decisions remain completed.
- No approval/send code, server action, provider adapter or store schema was changed.
  Existing confirmed fixture publishing remains a separate v0.7 gap; this change does
  not implement approved_local or a new no-send approval state. Hosted decisions remain
  session-only, and no durable recovery claim is added.
- The demo broken-glass candidate identity includes its base policy version, avoiding
  silently reusing the previous candidate name after a base routing change.

## Known limits

A review route is not semantic recognition. Four-star “dope” praise or sarcasm-shaped
text is held because of the rating rule, not because this code learned either meaning.
Five-star sarcasm, unfamiliar language and novel injury phrasing can still be missed
by this PR #7 baseline. Do not infer drug activity from the word “dope”; no such rule
was added. Owner context and validated model proposals remain future work.

The older v0.7 document pack is not regenerated by this slice. Historical checkpoint
links and test badges in the companion remain labelled as historical; its current
routing table describes this local candidate. Browser/mobile behaviour is not certified
by component rendering tests.

## Reproduction evidence

Before implementation, the updated requirement tests ran against the unchanged logic:
**16 failed / 57 passed (73 tests, four files), exit 1**. Failures included routing,
labels, daily and theme counts, priority, legacy queue ordering and rendered components.
After implementation the same focused command passed **73/73**, exit 0.

```sh
npm test -- lib/__tests__/owner.attention.test.ts lib/__tests__/queue.attention.test.ts lib/__tests__/triage.policy.test.ts lib/__tests__/golden.routing.test.ts
```

### Reading the failing assertions

The initial failures were expected requirement mismatches, not a broken test harness.

| Assertion group | Initial failures | What the assertion establishes |
|---|---:|---|
| Existing unit/golden expectations, four-star praise, bare rating, colloquial praise and sarcasm-shaped text | 7 | Four-star cases require review; low-risk cases stay non-sensitive with `rating_below_five` |
| Legacy result and explicit needs-review recommendation | 2 | The current desk must not infer the action solely from low risk |
| Daily brief counts and mutually exclusive urgency groups | 2 | Four-star praise counts as review workload, without duplicating urgent cases |
| Daily priority and stored queue order | 2 | A required review precedes a newer quick-review case; reading does not rewrite stored triage |
| Weekly/monthly theme counts | 1 | Attention counts include four-star low-risk cases without changing the denominator |
| Hosted workspace and server queue rendering | 2 | Both show the required-review action while preserving low-risk classification |
| Total | 16 | All pass after implementation |

The existing injury and five-star controls passed before and after. These controls
check that the new floor does not override a recognised safety concern or silently
change unrelated five-star expectations. No held-out evaluation set was used for tuning.

### Final local verification

| Check | Exact result |
|---|---|
| Focused regression command above | 73 passed / 0 failed, four files, exit 0 |
| `npm test` | 189 passed / 0 failed, 16 files, exit 0; 19 new tests beyond the 170-test privacy baseline |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0; Next.js 15.5.23 compiled and generated 7/7 static pages |
| `npm run build:comparison` | Exit 0; two datasets, 16 cases |
| Standard `npm run scan`, twice in a temporary store | Both exit 1 before worker execution: `listen EPERM` creating the launcher's `/tmp/tsx-1000/*.pipe` |
| Same worker via `node --import tsx scripts/dailyScan.ts`, twice in a fresh temporary store | Both exit 0; 11 processed, then 0 processed; no real email or provider calls |
| Static output inspection | Manifest digest matches; current companion guidance and attention CSS present; zero exact original-author matches in bundled JS and companion HTML |
| Preservation | Prior privacy snapshot hashes unchanged; masked dataset and privacy tests copied byte-for-byte; other inspected workspaces retain their prior status |

Runtime: Node 24.22.1, npm 11.9.0. Dependencies were reused from the inspected
workspace. This is not a fresh `npm ci` or a reproduction of CI's Node 22 environment.
The npm proxy-configuration and Vite CJS-deprecation warnings were non-fatal.
The standard scan CLI remains unverified in this environment; the successful loader
invocation verifies the worker without requiring the blocked IPC listener.

Static bundle SHA-256 (JS + CSS + companion HTML, as defined by the build script):
`1699f4c20e54ed3cfb15cfe56bde737de7f702687f928794725f2a774aa86255`.
This is a local artifact identity, not deployment provenance or a new Git commit.

### Observed cases and remaining gaps

| Synthetic example | Observed action / risk | Interpretation |
|---|---|---|
| Four stars: “Great food and fast service.” | needs_review / low / not sensitive | Required attention, without inventing a grievance |
| Four stars: “That croissant was dope—absolutely delicious.” | needs_review / low / not sensitive | Held by rating; no learned meaning or drug allegation |
| Four stars: “Great service—only waited fifty minutes.” | needs_review / low / not sensitive | Held by rating; sarcasm was not identified |
| Four stars: “Great food but I got hurt on a wet floor.” | needs_review / high / sensitive_safety | Recognised safety evidence keeps precedence |
| Five stars: “Great food and fast service.” | quick_approve / low / not sensitive | Existing control; still a human decision |
| Five stars: “Great service—only waited fifty minutes.” | quick_approve / low / not sensitive | Known semantic miss remains; not covered by the rating floor |
| Five stars: “食物很好吃，服务也不错。” | quick_approve / low / not sensitive | Positive text, but this baseline does not establish language understanding |
| Five stars: “The hot soup scalded my hand.” | quick_approve / low / not sensitive | Known safety wording miss remains; no claim of complete injury recall |

These are development examples, not estimates of real-world accuracy or error bounds.
The two five-star semantic/safety misses are recorded diagnostic observations, not
new passing acceptance labels. They must be addressed in a separate, explicitly scoped
comparison with main's newer fail-closed policy and the interpretation/context plan.

Browser/mobile execution was not performed for this slice. SSR assertions do not
establish touch layout, tab switching, browser back behaviour, draft restoration or
physical-device behaviour. The 11 existing hosted-boundary tests passed, but no live
host routes were probed here. Previously gathered host evidence is not refreshed by
this local build. This work does not update existing deployments or remove names from them.

At the earlier local checkpoint above, all changes were uncommitted. That checkpoint
did not merge, push, deploy, publish, send replies, integrate models, create durable
learning or change daily-intake fixtures. See the subsequent review-preparation record below.

Raw evidence is in [evidence/owner-attention-20261118](evidence/owner-attention-20261118):
the initial red run, focused green run, final full suite, production/static build logs,
scan failure and successful worker results, and a machine-readable verification summary.


## Draft PR preparation — fresh verification

The user asked to proceed with the planned PR. GitHub PR #8 is already merged: it is
the separate fail-closed policy/evaluation change. This follow-up targets
`codex/owner-review-desk` (PR #7), not `main`, and GitHub assigns its number.
The privacy changes are inherited from PR #7; the updated routing source and static
comparison bundle are included for review. Existing demo hosts
and git history are not changed by this PR.

The initial GitHub comparison on 18 November confirmed PR #7 and main diverge from
`809c0ef`: main had four unique commits; PR #7 had two. PR #7 then received the
masking commit `5d0cb9f` as its third commit. This follow-up preserves that update. Do not retarget or merge this
candidate into main without preserving main's fail-closed/language/contrast checks,
injected clock, provider dependencies, runtime store validation, and evaluation and
policy-promotion gates. Add `rating_below_five` to main's validated reason-code schema,
reconcile the explicit golden expectation change, bump and stamp the integrated policy,
and rerun the frozen evaluation gates without relaxing unrelated thresholds.
This draft does not claim that integration or semantic evaluation is complete.

Fresh verification in an isolated checkout reproduced **189/189 tests (16 files)**,
TypeScript, the Next.js production build and the static comparison build, all exit 0.
The static content digest is identical to the earlier checkpoint above. A current-tree
text scan found zero exact original-author matches, including the generated bundle;
this does not establish anonymity of searchable review text. Reused installed packages,
Node 24 and no mobile/browser execution remain the stated limits.

Logs preserve command outcomes and messages; trailing whitespace and progress-output
carriage returns were normalised for source control.
Fresh logs are in `docs/evidence/owner-attention-pr-preparation/`. The older evidence
folder records the earlier red-to-green exercise; its working-tree metadata and absolute
paths describe that historical run, not the later GitHub commit.

| Requirement / handoff | Current implementation | Evidence and limit |
|---|---|---|
| Review/rating → deterministic triage | Every rating below five requires review; recognised sensitive signals run first | `owner.attention.test.ts` and routing/golden tests; fixed development cases, not semantic accuracy |
| Triage → owner desk | Required action drives labels, grouping and priority independently of low risk | Desk, queue and SSR tests; not mobile proof |
| Prior stored result → current queue | Show current attention requirement; do not rewrite prior classification | `queue.attention.test.ts` compares stored bytes before/after the read |
| Source dataset → demo rows/bundle | Five masked aliases, opaque IDs, masked personal salutations and unchanged provenance | Three privacy tests plus exact known-name scan; original uploads/history are unchanged |
| Approval → external effects | Existing human-confirmed fixture path unchanged; hosted decisions remain session-only | Existing send-boundary tests; `approved_local` is not implemented here |
| Owner correction → reusable learning | Proposed bounded interpretation and reviewed promotion only | No model, clarification loop, memory store or learning implementation in this PR; ADR-001 remains open |
