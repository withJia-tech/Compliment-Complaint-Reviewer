# Controlled learning loop — implementation plan

Status: proposed; planning only. No production integration, storage platform, deployment model,
threshold or promotion authority is approved by this document. ADR-001 remains open.

Inspected base: `codex/verified-approval-send` at
`6903ba22f1b367072a6fe5447fbbae6848d2eee4` (draft PR #5).
This plan must be rebased against the selected implementation base before work starts.

## Delivery priority

The client-facing demo and one-business pilot now take priority. See
[SINGLE_BUSINESS_DELIVERY.md](SINGLE_BUSINESS_DELIVERY.md). The sequence below applies to
the subsequent learning-loop track, not prerequisites for demonstrating the owner workflow.

## Objective and diagnostic hypothesis

Reviewer outcomes may reveal missed risks and unsupported claims that merge-time fixtures miss.
The hypothesis is that adjudicated examples improve a candidate on an untouched evaluation set
without increasing unsafe routing, unsupported claims or human workload beyond agreed limits.
Owner approval, editing or silence alone cannot establish classifier correctness.

The product principle remains an acceptance requirement: care for the guest, disciplined facts,
fair treatment of staff, and improvement supported by evidence. Every external reply still needs
human approval. Learning-loop promotion never authorises automatic publication.

## Observed starting point

- The active branch uses deterministic triage, template drafting and a fixture provider. It has
  no production authentication, live provider, retrieval index or production telemetry backend.
- CI runs type checking, unit/regression tests, build and repeated-scan idempotency. The broader
  classifier and security evaluation workflow is separate unmerged work, not an enforced base.
- Verified send pins source/facts, validates final text, records send intent and distinguishes
  confirmed failure from unknown publication. Those controls must remain authoritative.
- `docs/DECISIONS.md` B7–B9 discuss feedback, promotion and retrieval. B1's parked auto-send
  proposal is outside this plan and cannot be enabled by shadow evidence or a release manifest.
- The supplied offline evaluation plan calls for independent high-risk labelling, synthetic
  fixtures first and preregistered thresholds. Live data reuse/retention remains unresolved.

## Trust boundaries and data flow

1. Current application logic produces authoritative triage and the human review queue.
2. An optional shadow evaluator receives the same versioned, minimised permitted inputs through
   a read-only contract. Its output goes only to evaluation records, never queue routing,
   approved facts, publishing, remedies or production configuration.
3. Authenticated reviewers submit attributed feedback. Application code validates identity,
   location scope, source versions and schema; feedback enters quarantine.
4. Human adjudication creates versioned labels and approved dataset additions. Candidate authors
   use development data; evaluation uses a separate frozen holdout.
5. A candidate release bundle is measured against the incumbent. An authorised human explicitly
   promotes the exact validated bundle; application code verifies the evidence and atomically
   changes the active release pointer. Failed checks leave the incumbent active.

No model output or feedback submission can invoke promotion, choose its own permissions, alter
thresholds, add retrieval documents, or turn on publishing. Reviewer metadata is excluded from
classification. Private staff accounts never enter general telemetry, public drafts or ordinary
model context. Proposed schemas do not authorise a new persistence service.

## Workstream 1: release identity and evaluation gates

Define an immutable `ReleaseManifest` with a schema version and content digest. Include:

- application commit/build digest; classifier/rules version; exact model identifier and provider
  version information where available; prompt content hash and output/tool schema versions;
- restaurant policy version, validation version and operational threshold hash;
- retrieval mode (`disabled` initially), or an immutable index snapshot and corpus digest,
  embedding model, chunker, retrieval settings and access-policy version;
- evaluation code commit, dataset and label versions/digests, gate specification digest,
  incumbent bundle digest, run IDs, report digests, creation time and compatibility constraints.

Keep acceptance-gate thresholds separate from runtime policy thresholds. Changing the former
requires an explicit rationale and approval before evaluation; a candidate must not weaken its
own acceptance criteria. Missing or mutable dependencies make a bundle ineligible. If a provider
cannot pin model behaviour, document that limitation and require drift monitoring/revalidation.
Caches must be schema-validated and keyed by input/source, model, prompt, schema, policy and
retrieval hashes; a mismatched or missing cache is not a successful evaluation.

Freeze a metric registry before candidate scoring. Every metric specifies numerator, denominator,
coverage, minimum case count, absolute floor/ceiling, permitted incumbent regression and confidence
method. Required metrics: high-risk recall; recall for each approved critical category; unsafe
quick-approve rate; supported factual claims / all factual claims; policy-compliant outputs /
all scored outputs; abstention/failure rate; manual review burden. Critical category taxonomy and
numerical thresholds require risk-owner approval; do not silently inherit aggregate sensitive recall.

Report counts and uncertainty, including exact one-sided 95% miss-rate bounds where appropriate.
Zero misses in a small sample is not evidence of negligible population risk. Empty denominators,
insufficient slices, missing judgements or invalid model outputs produce insufficient evidence or
failure, never an automatic pass. Claim support requires evidence validation/adjudication, not merely
presence of a citation or `factsUsed`. Repeat stochastic evaluations using a preregistered protocol.

## Workstream 2: shadow evaluation

Start with synthetic replay behind a disabled-by-default shadow option. Use dependency injection
around `lib/scan/runDailyScan.ts`; do not give the shadow runner a provider publish method or write
repositories for operational state. Candidate failure must not delay, downgrade or replace the
incumbent result. Use bounded execution, separate resource budgets and a kill switch; proposed
isolation must be tested under timeouts and load before live use.

Record paired incumbent/candidate outcomes against the same source and fact versions, release
IDs, sampling eligibility/probability, completion state, latency and measured usage. Count eligible,
sampled, completed, failed and excluded cases separately. Stratify critical cases and account for
sampling bias. Hide shadow suggestions during initial reviewer labelling to reduce anchoring.
Disagreement identifies cases for review; agreement does not prove correctness.

Live shadow entry gate: authorised read-only source, identity/access controls, retention and data-use
approval, operating owner, approved budget and operational fallback. Shadowing provides no path
to auto-send. Retrieval stays disabled until a separate feasibility/value experiment and data-handling
decision support it; an index is retained derived data, not an exemption from retention restrictions.

## Workstream 3: production observability contract

Define allowlisted structured events with event/schema version, opaque trace ID, scoped case ID,
source/facts versions, active/candidate release ID, stage, timestamp, outcome/reason code, duration,
validation results and measured usage. Keep identity/audit records separately access-controlled.
Do not log raw reviews, prompts, staff accounts, reply text, access tokens or unbounded exception
strings. Hashes and case references still require protection; they are not anonymous data.

| Signal | Denominator or window | Owner action |
|---|---|---|
| Processing errors, missing outcomes | All attempted cases, fixed window | Operator investigates failed stage; retain incumbent |
| Source freshness and processing latency | Eligible cases; p50/p95 and missingness | Operator checks ingestion lag and capacity |
| Unknown publication or unreconciled intent | Each attempt; age and count | Owner reconciles; no blind resend |
| Validation rejection and queue age | All send attempts; queued high-risk cases | Owner reviews reasons and urgent backlog |
| Shadow completion, disagreements and costs | Eligible/sampled/completed counts | Evaluator checks sampling, budgets and candidate failures |
| Label coverage and disagreement | Submitted and adjudicated feedback | Dataset steward reviews gaps and inconsistent labels |
| Runtime release mismatch | Every activation/startup and recorded result | Block candidate activation; investigate drift |

For each production alert, approve the accountable person, measurable threshold, denominator,
comparison window, data source, verification method and runbook before enabling it. No invented
response-time promise while staffing is unknown. Test alert delivery and acknowledgement.
Telemetry failure must be visible; it must not bypass mandatory send audit persistence. Avoid high
cardinality raw IDs in metric labels and test redaction with synthetic canaries.

## Workstream 4: controlled feedback and datasets

Proposed `FeedbackEvent`: immutable event/revision ID, actor/role, authorised location, case/source
version, release/draft version, outcome type, reason codes, evidence references, time, access and
retention class, consent/data-use basis and superseded-event reference. Use stable idempotency keys.
Capture edits only when permitted and necessary; prefer structured reasons to retaining raw diffs.
Keep guest account, staff account, operational evidence, hypotheses and disputed facts distinct.

Lifecycle: submitted → quarantined → independently reviewed → adjudicated / disputed / excluded
→ approved dataset version. Preserve revisions and disagreements. Two independent reviewers cover
high-risk and ambiguous labels; unresolved cases remain explicit rather than forced into gold.
If only one reviewer is available, those cases cannot satisfy the independent-label gate.

Do not interpret an unedited reply as verified truth, a skip as a false alarm, or no response as a
negative label. Protect feedback from prompt injection, poisoning, duplicates and unauthorised
cross-location submission. No automatic training, prompt editing or index ingestion.

Split development and locked holdout by underlying case/incident and time, with location isolation
where relevant; near duplicates and revisions stay in one split. Record provenance, eligibility,
label revisions and exclusions. Restrict candidate authors' access to held-out labels; periodically
refresh holdouts to limit repeated-test overfitting. Report synthetic and production-derived results
separately. Rights withdrawal/deletion must propagate to permitted copies and derived indexes;
revoke affected dataset/release eligibility and rebuild where needed without retaining forbidden
content for audit. Do not commit raw production cases to GitHub or CI artifacts.

## Promotion and rollback

Proposed states: draft → evaluated → shadow-validated → approved → active → retired/rolled-back.
Rejection or insufficient evidence cannot advance. Offline-only fixture experiments may stop at
evaluated; they do not imply permission for live operation.

Promotion verifies the approver's role/location/environment scope, exact manifest/report digests,
preapproved gates, incumbent comparator, evaluation freshness, dataset eligibility, compatibility and
required shadow evidence. Approval is bound to a single immutable manifest and environment;
any component change invalidates approval. Use compare-and-swap against the expected active
release to prevent concurrent or stale promotions. Failed activation must preserve the incumbent.
Persist an attributable approval/activation record and verify the observed runtime digest.

Rollback selects a previously approved, still-permitted compatible whole bundle, including its
retrieval snapshot and policy thresholds. Test rollback before promotion and invalidate/re-evaluate
pending decisions as needed; never silently reinterpret prior approvals or replay external writes.
Define operator authority and incident triggers before live rollout. No automatic fallback to a
bundle whose data permissions have been revoked. Keep human reply approval invariant throughout.

## Delivery sequence and acceptance evidence

| PR | Scope and dependencies | Done when |
|---|---|---|
| 1 | Manifest, metric registry and baseline inventory; build on reviewed send/CI work | Version/schema mismatch and empty/undersized metric gates fail; current fixture baseline is reproducible; numerical production gates remain explicitly unapproved |
| 2 | Synthetic-only shadow runner and event contract; depends on 1 | Paired report emitted; injection, timeout and failure tests prove zero operational writes or routing changes; sensitive canaries absent from logs |
| 3 | Synthetic feedback/adjudication contracts and dataset exporter; depends on 1 | Role/source/idempotency/revision, disputed-label, poisoning and split-leakage tests pass; real-data capture remains disabled |
| 4 | Offline bundle promotion simulator and rollback; depends on 1–3 | Unauthorised, stale, mismatched, concurrent and threshold-weakening promotions fail; compatible rollback and pending-state handling pass |
| 5 | Approved live pilot adapters and operational runbooks; separately authorised | Identity, retention, ADR-001 operating responsibilities, alerts, budgets, data permissions and source feasibility resolved; read-only shadow pilot demonstrates approved evidence requirements |

Extend CI as these capabilities land: lint/type checks, unit/policy tests, frozen golden evaluation,
adversarial tests, claim-grounding checks, dependency/secret scans and always-uploaded sanitised
reports for each run, including failed evaluations. Upload step must run even after failures;
missing required evidence is a failed gate. Confirm artifact access/retention before live-derived
reports. A green merge check is necessary but does not itself promote a production bundle.

## Decisions to resolve before live implementation

- Who operates the service, owns risk acceptance, adjudicates labels and can promote/rollback?
- Which data may be retained/reused, for how long, with which location/role boundaries and deletion path?
- What are the critical taxonomy, sample minima, absolute and regression gates, review SLA and budgets?
- Does retrieval improve measured outcomes enough to justify a retained index, and what sources are allowed?

These decisions do not block synthetic contracts and planning. They do block selecting production
stores/integrations or enabling live capture, shadow execution and promotion.

## Codex task brief

Work in `withJia-tech/Compliment-Complaint-Reviewer`. Read AGENTS.md if present, SPEC.md,
docs/DECISIONS.md, docs/VERIFIED_SEND.md and this plan. Inspect the latest base and open PRs;
do not assume draft PR #5 or the separate classifier branch is merged. Start by reporting the
observed baseline and reconciling stale assumptions. Plan the PR sequence above with concrete
interfaces, files and regression tests. Keep ADR-001 open. Do not install live integrations, create
production data stores, enable feedback capture, change operational thresholds, deploy, merge or
publish replies. Separate proposed gates from measured results. Deliver a reviewable plan and
explicit decision list; implement only after the user requests the relevant slice.
