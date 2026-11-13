# Decisions and backlog

Stage: **prove the logic for one person first.** Scaling is deferred on purpose, so each decision
here is judged by one question — *if we are wrong, what does it cost to undo?*

- **Two-way door** — cheap to reverse: a code change, a revert, a migration nobody notices. Decide
  quickly and move on.
- **One-way door** — expensive or impossible to reverse once real data or real customers depend on
  it. Slow down, and prefer the option that keeps a way out.

## Decision log

| # | Decision | Door | Why it is safe, or what makes it hard to undo |
|---|---|---|---|
| 1 | **Nothing is auto-sent.** The owner sends every reply. | Two-way | The auto path was deleted, not flagged off, so there is no dormant switch to flip by accident. A test proves a scan cannot reach `publishReply`, even with a stale `autoPublishConsent` flag in an old store. Re-adding it is a new, narrower rule (B1). |
| 2 | Three risk levels; sensitive is a flag, not a tier | Two-way | The policy is deterministic, versioned (`POLICY_VERSION`) and checked against `data/fixtures/golden.json`, so the blast radius of any rule change is visible before it ships. |
| 3 | JSON-file store behind repository modules | Two-way | Nothing touches `fs` except `jsonStore.ts`. Moving to SQLite means reimplementing the repos. |
| 4 | Provider, drafter, triage and approval channel are interfaces | Two-way | The fixture and the live Google adapter are interchangeable behind the same contract. |
| 5 | **Google is the system of record**; no local archive of reviews | Two-way, with one soft spot | See [Data residency](../SPEC.md#data-residency). The soft spot: audit records still embed review text (B5). |
| 6 | **A published reply** | **One-way** | A customer may read a reply before it can be edited or deleted. This is *why* decision 1 exists, and why validation (B2) runs before send, not after. |
| 7 | **Audit record schema** | **One-way (additive only)** | Records are history. Add fields freely; never repurpose or remove one. `remedy_recorded` was added rather than overloading `approved_published`, which would have falsified past records. |
| 8 | Single owner, single location (`STUB_OWNER_ACTOR`, `DEFAULT_LOCATION_ID`) | Two-way now; **quietly hardens** | `locationId` is already on reviews and audit records, but the owner is a string and the repos have no tenant key. Every table added without one makes multi-location more expensive. **Decide the tenant key before live Google OAuth lands (B10).** |
| 9 | No escalation tier | Two-way | A solo owner has nobody to escalate to. Sensitive claims are flagged and sorted first instead. |

The three to watch are **6, 7 and 8**. Everything else can be changed in an afternoon.

## Backlog

Ordered. Each item says what has to be true before it starts.

### B1 — Auto-send for deterministic 5-star positives

Parked deliberately. It replaces the old consent toggle, which was **broader than what is wanted**:
it covered 4–5 stars with *no complaint keyword found*, which is the absence of a signal, not
evidence of praise. The narrower rule, all of which must hold:

- the rating is exactly 5 stars;
- there is **no** hit in any complaint list or any sensitive list, strong or weak;
- there is **at least one** positive hint, so praise is affirmatively present;
- the review has no existing reply in Google (B4);
- the draft passes validation (B2);
- the owner has switched it on for that business, with a one-line kill switch.

**Entry gate — shadow mode first.** Before anything is sent, compute and record
`wouldAutoSend` on every triage result, then compare it with what the owner actually did. The
rule is ready when, over a meaningful run, every review it would have auto-sent was one the owner
approved **unedited**, and the golden set holds a negative case for each way it could be fooled
(sarcasm, "5 stars but…", an owner-visible edit). That evidence is the way out: if shadow mode
disagrees with the owner, we have lost nothing.

**Shadow status (policy-v1.1.0).** `TriageResult.shadow.wouldAutoSend` records the triage-side
conditions (5 stars, praise present, no complaint, contrast, sensitive or unreadable-language
signal) on every result, and `npm run eval` reports how many must-review cases it would have
sent. On the holdout it would have sent **4**, so B1 stays parked. The existing-reply (B4) and
owner-switch conditions are not computed yet. Comparing shadow decisions with what the owner
actually sent needs B7.

### B2 — Validation stage (partial implementation)

Implemented in the verified-send slice: source/draft/facts freshness checks, explicit human
confirmation, bounded English checks on both drafts and edits, visible refusal messages, and no
blank-edit fallback. Semantic claim provenance, multilingual validation and manager identity are
still release gates. See [VERIFIED_SEND.md](VERIFIED_SEND.md). Do not merge the older assurance
branch unchanged.

### B3 — Publish failure handling (implemented for the fixture boundary)

Confirmed provider failure records `publish_failed`; exceptions or incomplete receipts record
`publish_unknown`. Persisted intent blocks duplicate retries after process restart. Reconciliation
never sends and only conclusive non-publication allows human retry. The stateless fixture cannot
resolve an interrupted send. Live provider semantics and operational testing remain unverified.

### B4 — Existing-reply awareness

Google's review resource carries the current reply. Reviews already answered must not enter the
queue — otherwise the first scan of a live account floods it with every old review — and "answered"
should be read from Google rather than inferred locally. A read-before-write alone does not guarantee cross-process exclusion or resolve an in-flight write.

### B5 — Audit evidence by reference

Store the review id and a content hash, and fetch the text from Google when displaying. Closes the
data-residency gap. Additive to the schema (decision 7), so it can wait for the live provider.

### B6 — Cross-process write safety

Scans and decision entry points now share an exclusive filesystem writer lock. This protects the
existing local store without choosing a database. Crash recovery is manual and conservative;
no distributed locking, power-loss durability or multi-file transaction guarantee is claimed.
Low-level repository methods must remain behind the guarded entry points.

### B7 — Capture owner edits; offline evaluation

Record the draft-versus-sent difference as structured data, then replay stored cases through the
current policy and drafter to report routing agreement and edit rate.

### B8 — Promotion gate (implemented)

`lib/__tests__/policy.promotionGate.test.ts` fails when `lib/triage/{rules,match,policy}.ts`
change (comments and whitespace excluded) without a matching `lib/triage/policyManifest.json`.
`npm run policy:stamp` refuses to stamp an unbumped `POLICY_VERSION`. Golden and eval gates
run in the same `npm test`. What is not covered: the stamp records no reviewer identity or eval
evidence, so it is a tripwire, not the authorised promotion in CONTROLLED_LEARNING_PLAN.md.

### B9 — Prior-case retrieval

Read from Google at the moment of need. No local archive. Needs B7's data to be worth building.

### B11 — Classifier behind `TriagePolicy`

Holdout sensitive recall is 15% with keyword rules, and dev-tuned phrases moved it by zero.
Paraphrased claims share no words with the lexicon. A classifier (model or embedding) that
implements `TriagePolicy` can be scored on the same harness with no caller changes. Entry gate:
a fresh holdout labelled by someone other than the rule author, 150+ cases, and double-labelled
agreement reported. Exit gate: holdout unsafe quick approvals 0, per-category recall at an agreed
floor, false alarms within the owner's stated workload.

### B10 — Tenant key

Before live OAuth, add a tenant key to the repos so multi-location is a migration, not a rewrite.
This is what keeps decision 8 a two-way door.
