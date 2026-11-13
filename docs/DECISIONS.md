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
| 13 | Gaps are fixed, not catalogued | Two-way | The handover proposed `knownGap` markers. The owner chose to make the classifier reason through them instead, so the dataset states the target and the second reader is the fix. |

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

### B2 — Validation stage  *(next)*

Check a draft, and any owner edit, before it can be sent. First failing test: an owner edit that
adds "we'll refund you" is flagged before publishing and the send is blocked, with the reason
shown — the owner's words are not silently rewritten. Port the deterministic checks from
`feat/assurance-contracts-v0.5`; do **not** merge that branch as it stands (it imports the removed
`ESCALATION_KEYWORDS`, and still matches on substrings).

### B3 — Publish failure handling

`sendReply` marks a review approved even if the provider returns `success: false`. Impossible with
the fixture, certain with Google. Needs a failure audit action and a retry path. Do it with the
provider contract tests (B4's neighbour), not before.

### B4 — Existing-reply awareness

Google's review resource carries the current reply. Reviews already answered must not enter the
queue — otherwise the first scan of a live account floods it with every old review — and "answered"
should be read from Google rather than inferred locally. Also makes the double-send guard
cross-process safe in practice, because Google's answer wins.

### B5 — Audit evidence by reference

Store the review id and a content hash, and fetch the text from Google when displaying. Closes the
data-residency gap. Additive to the schema (decision 7), so it can wait for the live provider.

### B6 — Cross-process write safety

`auditRepo.append` is read-modify-write, so the CLI scan and the dev server can drop each other's
records. The in-process double-send guard does not cover this. Fix with append-only JSONL plus a
lock, or by moving to SQLite — the repo layer exists to make that a small change.

### B7 — Capture owner edits; offline evaluation

Record the draft-versus-sent difference as structured data, then replay stored cases through the
current policy and drafter to report routing agreement and edit rate.

### B8 — Promotion gate

CI fails if the rules change without a `POLICY_VERSION` bump and a passing golden set.

### B9 — Prior-case retrieval

Read from Google at the moment of need. No local archive. Needs B7's data to be worth building.

### B10 — Tenant key

Before live OAuth, add a tenant key to the repos so multi-location is a migration, not a rewrite.
This is what keeps decision 8 a two-way door.
