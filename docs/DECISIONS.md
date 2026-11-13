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
| 10 | **Second reader can only raise, and fails closed** | Two-way | A model reading is added on top of the keyword result; it can never lower one. Any failure holds the review. So the worst a bad model does is cost the owner a read, never mark a dangerous review safe. Removing the reader returns to rules only. |
| 11 | **Bring your own key**; keys live only in each owner's environment | Two-way | No hosted service, no stored secrets, no tenant model needed for keys. A hosted version that stores other people's keys would need encryption and a tenant key (see 8), so it waits for real demand. |
| 12 | Golden dataset versions are immutable once approved | Two-way | Pinned by checksum. A change is a new version file, so past evaluation runs stay comparable. |
| 14 | **Triage behaviour is release-gated** | Two-way | `npm run eval:gate` fails CI when a metric in `eval/thresholds.json` regresses, when the evaluation run is missing or stale, or when a limit is loosened without a stated reason. CI holds no key: it replays the committed run, so results reproduce from a clean checkout. |
| 13 | Gaps are fixed, not catalogued | Two-way | The handover proposed `knownGap` markers. The owner chose to make the classifier reason through them instead, so the dataset states the target and the second reader is the fix. |
| 15 | **Haiku reads every review; code routes the uncertain ones to Sonnet** (B13, `routing-v1`) | Two-way | The owner asked for Haiku by default with "another agent" routing to Sonnet when needed. The router is deterministic code, not a model: a model router would be another paid call, another thing that can fail or be talked round by the review it routes, and it could not be replayed exactly in CI. The rules are in `lib/triage/reader/cascade.ts`; changing them bumps `ROUTING_VERSION`, which makes the saved evaluation run stale. Escalation can only raise, and a failed escalation read holds the review. Swapping models is an environment variable. |
| 16 | **Cost is release-gated at one cent per review** | Two-way | The owner set US$0.01 per review read on 2026-11-13, before any evaluation run, so the limit was not fitted to a result. It is measured from recorded token usage, priced from `lib/triage/reader/pricing.ts`. An unknown price or an empty run fails. With Haiku and Sonnet the worst case is about 0.6¢, so today it catches misconfiguration (a pricier model, runaway thinking tokens) rather than shaping the choice. |
| 18 | **PR #6 and PR #8 combined as `policy-v1.2.0`** (2026-11-13) | Two-way | Both PRs had shipped different rules as `policy-v1.1.0`. The combined rules keep PR #8's fail-closed quick approve and PR #6's normalised matching, guards and reader. PR #8's shadow auto-send flag is now cleared whenever a guard or the reader holds a review, so B1 evidence never claims it would send a held review. On golden v1, rules alone now give 1 unsafe quick approve (was 6) but 4 false alarms (was 1): 5-star praise the rules cannot confirm in readable English (RC-003, RC-512 Singlish, RC-520 Chinese, RC-531 Malay) is held, and the reader can only raise, so 4 is a floor in both modes; `falseAlarm` limits moved 1 → 4 with a written `loosening_reason`. **Open owner question:** may a reader that reads such a review as plain praise confirm it to quick approve? That would be the first time a reader *lowers* a result (decision 10), so it needs its own decision, tests and golden evidence. |
| 17 | Golden dataset v1 **approved** by the owner (2026-11-13) | Two-way (by decision 12) | From now on `risk_classifier_v1.jsonl` is frozen; any change, including to RC-300 and RC-408, means a `v2` file and a new evaluation run. One person labelled and approved it, so its high-risk labels are not independently adjudicated (see `docs/LEARNING_LOOP_PLAN.md`). |

The three to watch are **6, 7 and 8**. Everything else can be changed in an afternoon.

### Proposed, not yet decided: where Google OAuth refresh tokens live (for B12)

The owner asked for the secured option, assessed. A Business Profile refresh token with
`business.manage` lets whoever holds it post, edit and delete replies and edit the profile as the
business, without a password, until it is revoked. Treat it as the business's public voice.

| Option | Protects against | Weak spot | Fit for one person, self-hosted |
|---|---|---|---|
| A. Plain `.env.local` or env var | Nothing at rest | Any process, backup or careless commit exposes it | Rejected |
| B. Encrypted file, key in an env var | A copied file on its own | Key and file sit on the same machine | Bare minimum |
| C. Encrypted file, key in the OS keychain (macOS Keychain, Windows Credential Manager, libsecret) | Disk theft, backups, other user accounts | Weak on a headless Linux server with no keychain; needs a native module or the OS CLI | **Recommended while it runs on the owner's own computer** |
| D. Cloud secret manager (e.g. Google Secret Manager in the same Google Cloud project as the API) | A stolen disk; also gives an access log and rotation | Another account and a network dependency | **Recommended once it runs on a server** |
| E. Store nothing; owner signs in each session | No standing secret | The daily scan cannot run unattended | Only for a manual-only phase |

**Recommendation:** put a `TokenVault` interface in front (a two-way door), and implement C first:
AES-256-GCM, one record per tenant, the tenant key (B10) and scope bound in as additional
authenticated data so a record cannot be replayed for another tenant, the file outside the repo
and outside `data/store/`. Swap to D when hosting. Around it: access tokens in memory only; the
scheduled scan uses read calls only (send stays an owner click, as today); revoke at Google on
disconnect; never log a token, and add a canary token to the CI log-leak check. To verify before
building: Google's current rules for apps whose OAuth consent screen is in "Testing" status (refresh
tokens have expired after 7 days) and whether `business.manage` needs app verification. The owner
has not yet applied for Business Profile API access; that approval is the long pole for B12.

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
resolve an interrupted send. Live provider semantics and operational testing remain unverified. Merged in PR #5 (2026-11-13), with a cross-process writer lock (part of B6).

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

### B13 — Cheaper reader model  *(built; waiting on the owner's evaluation run)*

Numbered B13 because PR #8 used B11 for a classifier behind `TriagePolicy`. The two are related:
this reader sits on top of the rules and can only raise; B11 would replace or join the rules
behind `TriagePolicy` and be scored on the routing harness (`npm run eval`), which does not yet
score the reader.

Done in code: Haiku first, Sonnet on escalation (decision 15); the gate checks the exact reader
(models, routing version, prompt fingerprint) and cost per review (decision 16). The
`rules_plus_reader` quality thresholds are unchanged except false alarms (decision 18). **Not yet shown to work:** that needs
`npm run read:golden -- --yes` with the owner's key. If the cascade misses the quality limits,
the fix is routing or prompt, never looser thresholds. Worth one comparison run before settling:
Sonnet alone at low effort (`CCR_READER_MODEL=claude-sonnet-5-5 CCR_READER_ESCALATION_MODEL=off
npm run read:golden -- --yes --out /tmp/sonnet.json`), since one model is simpler than two.

### B12 — Live Google reviews  *(after B10)*

Read the owner's real reviews through Google's Business Profile API with OAuth (scope
`business.manage`), or through an MCP connector if one fits. Needs the tenant key (B10) first,
and a decision on where OAuth refresh tokens live, since storing them is a one-way door (assessed
above: proposed, not decided). MCP stays a way to read, never the scheduler or system of record
(SPEC non-goal). The owner is still choosing between the API and an MCP connector.
