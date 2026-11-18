# Contracts, handoffs, memory and observed results

18 November 2026. Inspection and bounded verification; this is not implementation of v0.7.

## Trust boundary

The model may propose an interpretation or wording. Application code validates representations, references, scope, freshness and policy, and computes permitted actions. An authorised human supplies the final judgment. Storage acknowledges a decision only after the required durable transition. A browser simulation cannot stand in for that transition.

The current runtime is a modular Next.js prototype. H0–H5 are proposed contracts, not six deployed agents or services. Preserve that distinction when planning work. The v0.7 module pack and compiled context were previously found inconsistent (12 stale manifest entries, five differing compiled sections); this task read the modular contracts and did not regenerate or certify the pack.

## Output contract inventory and handoffs

| Boundary | Producer → consumer | Required output and guard | Current evidence / gap |
|---|---|---|---|
| Privacy preparation | Application adapter → permitted model input | Immutable minimised view, view ID/hash, source reference, policy/detector versions, ready/review-required status; keep original mappings private | Dataset 2 has five masked aliases and opaque IDs. No general PII detector, immutable model-view pipeline or external egress validator |
| H0 ReviewSnapshot | Source adapter → interpreter | Prepared text/hash/view, separate overall/aspect ratings, attributed language hint, privacy-ready status; reject profiles, invalid ratings, scope/view mismatch | `Review` in `lib/types.ts` has text, 1–5 stars and timestamps; `ScreenshotCase` separately represents unknown dates. It is not the nullable-rating, scope-checked H0 schema |
| H1 InterpretationResult | Fixed model task or authorised human → code validator → policy | Aspects/polarities with exact evidence spans, candidate grievance, ambiguity, reviewer-attributed allegations, sarcasm status, language capability | No H1 runtime. Current `DefaultTriagePolicy` combines keyword matching and routing. A keyword hit or valid quotation does not prove meaning |
| H2 PolicyDecision | Deterministic code → drafting and assurance | Route `draft/escalate/abstain`, response mode, required role, allowed facts/remedies/commitments, humour flag, policy and dependency versions | Current `TriageResult` has risk, reasons, sensitivity, themes and `quick_approve/needs_review`. No one-to-one mapping to H2; role/permission/catalogue/abstention contracts are missing |
| H3 DraftProposal | Owner or bounded model proposal → assurance | Immutable owner original; draft ID/revision/hash; prepared view; proposed claims with typed references; privacy status; separate extraction provenance | Current `Draft` has text, fact keys, template ID and optional source/facts fingerprints. No complete claim inventory, immutable owner-original chain or H3 validator |
| H4 AssuranceReport | Code + separately attributed model/human assessments → approval guard | Mandatory check manifest; pass/fail/warn/not-assessed; evidence and rater; hard blockers; at most three internal coaching notes; readiness computed by code | `validateReply` supplies pattern guards and confirmation is required. No full-draft semantic assessment or mandatory H4 manifest. Missing checks cannot be treated as passing |
| H5 ApprovalRecord | Authenticated human request → application → durable local state/audit | Exact draft/report/dependency digest, role snapshot, expected/committed revision, idempotent request ID; `approved_local/rejected`, `external_action:none` | Hosted outcomes are memory-only. Local fixture `Approval`/`AuditRecord` has context/version/attempt details but stub actor and simulated publishing. Neither is H5; atomic decision+audit transition remains a gap |
| Registered reads | Application tool gateway → stage | Tool/schema identity, server scope, deadline, bounded result/typed abstention; input may request a read but cannot grant permission | Fixture `ReviewProvider` exists. No model-selected tool execution or v0.7 gateway. The interface still contains `publishReply`, so prototype no-write capabilities need an explicit future boundary |
| Investigation note | Authorised owner/manager → private case workflow | Attributed issue, hypothesis, owner, evidence needed, signal, source, denominator, comparison period, verification method, status | Proposed only. Private notes must not automatically become drafting context or proof that an operational fix occurred |
| Learning candidate | Explicit owner correction → human curator → versioned example set | Scope, source/context references, proposed label, counterexamples, provenance, permission, status and promotion history | No implemented learning store or promotion pipeline. Approval/no edit is not a gold semantic label |
| Deployment evidence | Build job → host → verifier | Source identity, artifact digest, environment, deployment receipt, downloaded-byte comparison | Privacy Pages update has source/deployment commits and 5/5 byte checks. `build.json` itself lacks a source-commit field and excludes root HTML from its digest; root HTML was separately compared |

Every proposed model handoff uses an application-created envelope: contract version, run/stage/attempt IDs, tenant/location/case, producer/model/prompt/config identity, source/view hashes, input dependency references, timestamp, and `ok` or typed abstention. Manual runs use null model fields. A model cannot author these trusted identity/permission fields.

For evidence offsets, v0.7 proposes half-open UTF-16 indices against the exact named text view. Schema validity, matching quotation, semantic support, factual verification and authority require separate checks. Revisions to context, facts, interpretation or draft must invalidate dependent assurance and approval. The current `contextVersion()` hashes review/triage/draft/facts; it is a freshness token, not authentication or complete v0.7 dependency coverage.

## Task → assertion → metric → evidence

Do not sum overlapping suites or compare totals as a quality score. Preserve the code and dataset identity for each result.

| Task / requirement | Executed assertion or observation | Numerator / denominator or result | Status and evidence |
|---|---|---|---|
| P1 Mask real examples | Exact author aliases, embedded salutations/drafts, opaque IDs and dataset version | 3/3 tests; five expected aliases; zero original-author matches in reviewed bundled JS | PASS, privacy head `5d0cb9f`, `demo.privacy.test.ts`; does not measure all PII leakage |
| P2 Ship those bytes to GitHub Pages | Compare root HTML, JS, CSS, companion and manifest to reviewed bundle | 5/5 equal; recomputed digest equals manifest | PASS, Pages `de98c222`, live hash `6894a059…`; deployment receipt linked in mobile record |
| N1 Block operational access | Reject five mutation methods × three routes; redirect six operational paths × GET/HEAD; reject storage under either hosted flag | 21/21 Vitest cases, with additional loop assertions | PASS, `hosted.demo.test.ts`; in-process enforcement, not current live mobile interaction |
| N2 Explain session lifetime and preserve relative links | SSR copy/read-only/default-relative routes + generated output digest | Before rebuild 3/4; after rebuild 4/4 | PASS after stale artifact was regenerated, `companion.navigation.test.ts` |
| N3 Mobile navigation and state | Seven Playwright scenarios including exact draft equality, narrow widths, new tab, Back, reset and blocked routes | 0/7 scenarios executed here | BLOCKED/NOT_RUN; prior socket restriction and missing WebKit; syntax pass is not behaviour pass |
| N4 Strict return-link draft recovery | Returned companion-tab client must contain original unsent marker | No observed mobile result; source/earlier desktop show fresh session | OPEN expected-red requirement; wording change does not fix state restoration |
| R1 Below-five owner attention | Separate local routing candidate: exact action, labels/counts/order, low-risk preservation, legacy read without mutation | Focused 57 pass/16 fail → 73 pass; full 189/189 | Prior executed PASS on `policy/pr7-owner-attention-20261118`; not part of published privacy head or this verification branch |
| R2 Contextual safety discrimination | Original cfe0daf ZIP: 11 action checks and 9 sensitivity checks | Action 11/11; sensitivity 6/9; whole added suite 17 pass/3 fail | Prior FAIL remains: C3 burnt coffee, D1 burnt food false positives; D2 scalded hand false negative |
| R3 Current older PR semantic gaps | Five-star sarcasm-shaped text and scalded-hand wording | Diagnostic observations still quick-approve / low / not sensitive | Known misses; no claim that four-star holding means semantic recognition |
| B1 Verification candidate integrity | Full suite, types, production/static builds | 184/184, 15 files; all commands exit 0 | PASS on standalone verification tree; raw logs retained |
| B2 Privacy PR CI integration | GitHub temporary merge of privacy head into newer main | 201/201, 17 files; routing eval, build, idempotency successful | Provider-observed PASS in run 44321822284; different tree from standalone 170-test privacy head |
| L1 Model/learning value | Compare permitted interpretation with and without approved context on adjudicated unseen cases | Not measured; no model calls in this work | NOT_RUN; no learned-quality, latency, cost or calibrated-risk claim |
| U1 Owner usefulness | Material issues found, time/edit burden, useful vs unnecessary questions | Not measured | NOT_RUN; requires actual operator participation |

Finite regression compliance is not population accuracy. The known development cases have been used to shape requirements; keep them separate from the next unseen evaluation. Report sensitive-category recall independently from whether a case was held for review. A correct destination can conceal a missed injury, as D2 demonstrates.

## Discrepancies requiring explicit treatment

1. **170 vs 184 vs 189 vs 201:** different branch contents or integration trees. 184 = 167 PR baseline + 3 privacy + 10 additional guard tests + 4 navigation contracts. 189 belongs to the separate owner-attention candidate. 201 is the CI temporary merge with main, not evidence that either local candidate has been merged.
2. **Source vs generated output:** new wording initially existed only in source; one contract test failed. Regeneration fixed the artifact mismatch, not mobile lifecycle behaviour.
3. **Source vs live deployment:** Pages briefly served old bytes immediately after the branch update; eventual deployment + downloads established the new identity. Vercel still showed the previous digest during this turn; Sites was not updated. Do not say all three hosts match now. Fresh Pages operational requests initially returned five expected 404s and seven 503s; the latter leave host-boundary evidence incomplete despite passing middleware tests.
4. **PR metadata vs main:** PR metadata reported an older base SHA; direct `refs/heads/main` and CI checkout establish `cfe0daf`. Always name the exact checkout. The temporary merge is CI infrastructure, not a user-authorised merge into main.
5. **v0.7 vs runtime:** H0–H5 are proposed specifications. Existing freshness guards and tests cover useful subsets; they do not complete T1 or G1. T0 inspection exists; T2–T4 vertical-slice obligations and G2–G4 remain uncompleted.
6. **Anonymity vs masking:** five displayed names and embedded salutations are masked. Searchable text, business identity, old Git history and untouched hosts still permit linkage. No history rewrite was attempted.
7. **Attention vs semantics:** holding four-star text does not recognise sarcasm. The published PR-head policy retains its prior four-star behaviour; the approved routing candidate remains separate pending explicit reconciliation with main's newer safeguards.

## Bounded next regression work

Preserve the original C1–C6/D1–D5 fixture and results. Add tests only for a diagnosed invariant, keeping positive controls and explicit old/new expectations. For the interpretation seam, the next useful paired cases are food burnt / person burned or scalded; explicit delicious slang / one-word ambiguous slang / alleged drug offer; straightforward praise / ironic praise with a stated wait; owner menu evidence / owner unsupported guess. Use synthetic cases and manual/fake H1 payloads first.

Each case should separately score: meaning and attribution, supported praise/concern preservation, sensitive category, urgency, attention, permitted wording and external effects. Add malformed/stale/wrong-scope payloads and contextual correction invalidation. Do not introduce a blanket slang exception or simply increase holds to make a safety metric look better. Do not relabel an unseen set after seeing outputs.

The finite test scope here is deliberately closed: privacy projection, hosted guard matrix, navigation contract, generated artifact identity. No unrelated keyword expansion, daily-intake fixture change, model call or store migration was made. Browser recovery remains a named gate, not a hidden waiver.

## Memory decisions: hosting, isolation and learning are separate

Cloud hosting and per-business storage are compatible choices. The real choices are who operates the service, how businesses are isolated, what is retained, which devices must recover state, and how approved context changes later decisions. Buying a database does not cause learning.

| Record | Proposed scope / lifecycle | Who may promote it |
|---|---|---|
| Session draft | Tab/session; disposable in current demo | No automatic promotion |
| Case context | Business + case + revision; owner account/evidence remains attributed | Owner may revise this case; does not prove guest intent |
| Approved business facts | Business/location; source, approval, version, expiry/review status | Authorised owner; affects allowed claims, never erases an allegation |
| Correction / learning candidate | Explicitly selected, minimised example with label and counterexample | Human curator; correction is not automatically truth |
| Reusable contextual example | Versioned business-scoped set with permission and provenance | Explicit promotion after regression/semantic evaluation; rollback retained |
| Decision/audit record | Restricted authoritative state; retention/deletion/export policy still undecided | Application after authorised human action; separate from advisory memory |

Every future retrieval should be scoped before search, return source/version references, reject expired/disputed/out-of-scope material, and record which context was actually used. A context update invalidates downstream assurance/approval. Never build reviewer-personality profiles, silently share owner conventions across restaurants, or place private staff records in general model context.

| Option | When it may be justified | Trade-off to measure |
|---|---|---|
| Browser-only or local prototype | One-device synthetic usability work; recovery not required | Low operating burden, no dependable cross-device recovery |
| Managed cloud, logically isolated per business | Owners need shared devices, managed recovery and low maintenance | Authentication, tenant enforcement, backup, retention and shared-service operations |
| Dedicated store/deployment per business, possibly cloud-hosted | Contractual isolation, customer control or differing policies justify it | Per-instance upgrades, backup, support and version drift |
| Customer-operated package | Customer explicitly has operating capability and wants control | Transfers maintenance duties; does not remove total operating cost |

ADR-001 stays open. Prefer a small reviewed context/example set before retrieval infrastructure; add retrieval only after measured need. Model-weight training is neither selected nor required. No new database, provider or automatic learning mechanism is authorised by this document.

For a later context-value experiment, freeze the cases and rubric first, compare no-context vs approved-context conditions under the same policy, record correction usefulness and unnecessary-question burden, and include counterexamples. Report numerator/denominator, case/run identity, attribution disagreements, latency/cost if actual model calls are separately authorised. Thresholds and sample adequacy must be decided before the deciding experiment, not invented after a favourable run.

## Product decisions and remaining implementation choices

The user confirmed one owner across phone and desktop and both existing datasets. After reviewing trade-offs, the user accepted saved drafts plus approved business facts, with interpretation corrections retained as reviewable candidates rather than automatically learned rules. See `PILOT_MEMORY_POLICY.md` for the accepted scope and PM-01–PM-10 acceptance checks, all pending execution.

This resolves the earlier pilot-user and reusable-context questions. Shared storage, authentication, recovery, retention/deletion and operating ownership still need a concrete design. The exact companion return-link mechanism remains open; its existing assertion is unchanged. No memory capability or cross-device behaviour is claimed as implemented by this decision.


### Proposed context-value measurements — not yet executed

| Measurement | Numerator / denominator | Why it matters |
|---|---|---|
| Useful clarification | Answers that change a supported interpretation, urgency or permissible wording / answered questions | Avoid asking merely to reconfirm an already-required hold |
| Unnecessary interruption | Questions adjudicated unnecessary / all questions asked | Owner workload and abandonment risk |
| Context-induced error | Cases made wrong by supplied/retrieved context / context-using cases | More context can mislead; do not count only improvements |
| Reuse benefit | Repeat cases resolved with less correction under the same rubric / eligible repeat cases | Establish value before adding retrieval infrastructure |
| Retrieval authority | Out-of-scope, expired or disputed records admitted / attempted prohibited retrievals | Application boundary; finite tests must show each attempt and denial |
| Total operating cost | Hosting + inference + storage + support + recovery effort per business and per handled case | Compare managed and dedicated options on total burden, not database price alone |

Report paired case identities, rubric/dataset/context revisions, disagreements and missing data. All observed values here are `NOT_MEASURED`; numeric acceptance thresholds remain to be agreed before the experiment.

Post-deployment HTTP follow-up: one bounded retry resolved five of seven 503 results to 404. `/settings` GET/HEAD remained 503, so current exact-denial evidence is incomplete for those two pairs. Do not represent this as 12/12 live boundary checks passing. Both raw result sets are retained.
