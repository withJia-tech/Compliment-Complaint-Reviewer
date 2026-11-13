# Handover — next task: Google OAuth (live provider) and BYOK

Written 2026-11-13 for a fresh session. Delete this file when the task is done. The previous
handover (golden-set extension) is archived in `docs/handovers/`; PR #8 has since covered its
multilingual and sarcasm cases, but its PII, leetspeak and `knownGap` items are still open.

## Before anything else: confirm what "BYOK" means

The owner asked for "BYOK and Google OAuth" without defining BYOK, and nothing in the repo or
earlier sessions defines it. **Ask first; it decides half of this plan.**

- **(a) Bring your own model key — assumed below.** The business owner supplies their own model
  provider API key (Anthropic, OpenAI, …) for future model stages (B11 classifier, drafting).
- **(b) Bring your own Google client.** The owner's own Google Cloud project and OAuth client
  connect their Business Profile, instead of the developer's project.
- **(c) Both.**

## Where things stand

- `main` is at `809c0ef`. **PR #8** (`feat/l3-evals-and-fail-closed`, CI green, 183 tests) adds
  fail-closed routing (`policy-v1.1.0`), routing evals, `DecisionDeps` provider injection,
  runtime store checks (`lib/store/schema.ts`) and the B8 promotion gate. **Merge #8 first.**
  This work builds on `DecisionDeps` and the store checks.
- Draft PR #3 (`feat/assurance-contracts-v0.5`) must not be merged (see CLAUDE.md).
- **Today the app has:**
  - no authentication;
  - no model calls;
  - no secrets;
  - only the fixture provider (`lib/providers/fixtureReviewProvider.ts`).
- **The hosted demo is a browser-only sandbox:** `middleware.ts` blocks every mutation, and
  `assertLocalStore()` refuses server storage. It must stay that way.

## Why these two belong together

Both are the first time the app holds a credential that acts in the real world:

- **The Google refresh token** can publish a reply on a real listing.
- **The model key** spends the owner's money and sends review text to a third party.

They need the same controls:

- encrypted at rest and server-side only;
- never logged, never stored in audit records, never in model context;
- scoped to one tenant and location;
- revocable, with every use auditable.

Build that control layer once (Step 1e), before either credential exists.

## External constraints (checked 13 Nov 2026; re-check before relying on them)

| Constraint | Consequence for this code |
|---|---|
| **API access is gated.** A new Cloud project has 0 requests/min on the Business Profile APIs until Google approves an access request; approved projects get 300/min. Approval is manual, not guaranteed, and can take weeks. ([prereqs](https://developers.google.com/my-business/content/prereqs)) | **Apply now: it's the long pole.** Read the quota, not the "enabled" badge, to know whether you're approved. Never fall back to scraping (SINGLE_BUSINESS_DELIVERY.md). |
| **Testing mode is a trap.** On an External consent screen, refresh tokens expire 7 days after consent, and testing is capped at 100 test users. ([Google](https://support.google.com/cloud/answer/15549945)) | A daily scan would silently break every week. The pilot needs a production consent screen, so budget time for verification. A community report says `business.manage` displays as non-sensitive yet blocks external users, so verification may not be straightforward. |
| **There is no read-only scope.** `updateReply` accepts `business.manage` (or legacy `plus.business.manage`), the same scope used to read reviews. | **Read-only must be enforced in code.** The read-only pilot must have no code path to `updateReply`, not just a disabled button. |
| **Reviews API v4:** `list`, `get`, `updateReply` (PUT `…/v4/accounts/*/locations/*/reviews/*/reply`), `deleteReply`. Replies only work on verified locations. ([reviews resource](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews)) | Map onto the existing `ReviewProvider` interface. Use `get` for reconciliation. |
| **Replies are moderated.** `ReviewReply.reviewReplyState` is `PENDING`, `REJECTED` or `APPROVED`. `policyViolation` (about 44 values, documented as growing) is set only when rejected. | **A 200 from `updateReply` is not "published".** `APPROVED` = published. `REJECTED` = confirmed not published, so record the violation. `PENDING` and any unknown value = `publish_unknown`, resolved later by `reconcileReply`. This fits the existing B3 semantics; no retry on uncertainty. |
| **The reply cap is 4,096 bytes, not characters.** | **Bug today:** `lib/validation/reply.ts:13` checks `text.length > 4000` characters. A 1,400-character Chinese reply (~4,200 bytes) passes locally and fails at Google. |
| **`starRating` is an enum:** `ONE`…`FIVE` or `STAR_RATING_UNSPECIFIED`. | Map explicitly. `UNSPECIFIED` must never become a number by default: route to `needs_review` or reject at the mapping layer. |
| **`reviewer.displayName` is empty when `isAnonymous` is true.** | `displayName()` in `lib/drafter/templates.ts` assumes an author exists. Separately, the v0.4 decision contract (PROVENANCE-001) said reviewer profile data shouldn't reach drafting. Decide (Q7). |
| **An existing reply comes back on the review (`reviewReply`).** | B4: already-answered reviews must not flood the queue on the first live scan. |
| **Quota guidance:** spread calls out, cache, and prefer Pub/Sub review notifications over polling. | One location polled daily is far inside 300/min. Note Pub/Sub for scale; don't build it now. |

## Proposed order (each step its own PR, test-first, mutation-checked)

### Step 0 — owner decisions

Get answers to the open questions below. Q1–Q4 block Step 1; Q5–Q6 block Step 2; Q8 blocks Step 4.

### Step 1 — groundwork in fixture mode (no Google access needed)

- **a. Tenant key (B10).** Decide it before OAuth, as DECISIONS #8 warns. Add `tenantId` to repos,
  `lib/store/schema.ts` and audit records. It must be additive: old records stay readable.
- **b. Byte-length validation.** Validate replies in UTF-8 bytes against 4,096. Add golden cases
  for Chinese, Tamil and emoji replies near the limit.
- **c. Moderation-aware publish contract.** Extend `ProviderPublishResult` / `PublishReconciliation`
  with the reply state and the policy violation. Have `FixtureReviewProvider` simulate `PENDING`
  and `REJECTED`. Test that `PENDING` blocks retry exactly as `publish_unknown` does today.
- **d. Google → domain mapping.** A pure function, `GoogleReview → Review | MappingRefusal`,
  covering star enums, anonymous reviewers, existing replies (B4) and timestamps. Test it against
  synthetic JSON shaped like the API response. No real reviews go in fixtures.
- **e. Secret store.** A `SecretStore` interface (`put`, `use`, `revoke`; no `get` that returns
  plaintext to callers outside the provider adapter):
  - envelope-encrypted, with a local dev implementation keyed from an environment variable;
  - a redaction test: write a known canary secret, run the scan, a send and a failure path, then
    assert the canary appears in no store file, audit record, error message or log line.

### Step 2 — Google OAuth, read-only pilot

SINGLE_BUSINESS_DELIVERY.md: "Read-only provider pilot precedes live sending."

- **Two identities, kept apart:**
  - *who is logged into this app* (identity provider choice: ADR-001, still open);
  - *which Google account granted Business Profile access* (OAuth).
  Signing in with Google conveniently merges them. Decide that on purpose.
- **Authorization code flow** with `state` and PKCE, `access_type=offline` and a server-side
  callback. The refresh token goes into `SecretStore`, keyed by tenant. Access tokens live in
  memory only.
- **Location picker:** list the owner's accounts and locations; the owner picks one verified
  location. Every read and write checks the server-side tenant and location scope.
- **`GoogleReviewProvider`** implements `listSince` and `getById` only. `publishReply` doesn't
  exist in the read-only build; don't add a runtime flag that could be flipped.
- **Fail closed on auth errors:**
  - `invalid_grant`, revocation or a quota error must throw, never return `[]`. An empty list
    reads as "no new reviews" and the scan would advance `lastSuccessfulScanAt`
    (`runDailyScan.ts:126`) past reviews it never saw.
  - The location shows as disconnected, and the owner is told to reconnect.
  - Write a test for exactly this.
- **Disconnect:** revoke at Google, delete from `SecretStore`, audit the event.
- **Data residency (B5):** audit records currently embed the review text. Resolve this before
  live data arrives (Q5).

### Step 3 — live send

This needs its own explicit approval; don't start it in this task.

- `updateReply` behind a freshness check and an existing-reply check (B4);
- a moderation-aware outcome (Step 1c);
- `reconcileReply` via `get`;
- never retry an uncertain send. Read `docs/VERIFIED_SEND.md` first.

### Step 4 — BYOK (as defined in Q1; assuming a model key)

Build this only alongside an approved model stage (B11). A key with nothing to use it is
untested plumbing.

- **Entry:** a write-only field. The server checks the key with one minimal call, then stores it
  through `SecretStore`. The UI shows only the provider, the last 4 characters and the date
  added. The owner can replace or remove it; it is never echoed back.
- **Boundaries:**
  - the key is used server-side only, per tenant;
  - the model gets no tools (v0.4 contract);
  - per-case token budget (v0.4 spec proposed 20,000 per case);
  - timeouts.
- **Failure is fail-closed.** On any provider error, timeout or budget breach, fall back to the
  deterministic policy and route to `needs_review`. Never to `quick_approve`.
- **Evals:**
  - a model policy must pass `npm run eval` behind the same `TriagePolicy` interface;
  - CI must never hold an owner's key: use recorded model outputs, or skip the model eval in CI
    and run it in a gated manual job;
  - log token counts, never content.
- **Governance:** BYOK makes the owner's own provider account the processor of their customers'
  review text. The owner should confirm that account's retention terms (Q8), and the app should
  say plainly what is sent.

## Non-negotiables (from CLAUDE.md; they apply harder now)

- Nothing is sent automatically. The scan never reaches `publishReply`. Auto-send (B1) stays
  parked: the shadow rule would have sent 4 must-review holdout cases.
- **Never ask the owner to paste a key or token into a chat.** Never read `.env` files. Secrets
  enter only through the app or the hosting platform's secret settings.
- Audit schema stays additive. A tenant key is added, never repurposed.
- The hosted demo stays fixture-only: no OAuth callback, no key entry, no server storage.

## Open questions (recommended default in **bold**)

**Answered 2026-11-13, recorded as G1–G8 in `docs/DECISIONS.md`:** Q1 model key in the owner's
environment (as PR #6 builds it); Q2 each business owner's own Google project; Q3 separate app
login; Q4 tenant key deferred (Step 1a waits); Q7 drop reviewer names; Q8 the owner's Anthropic
account has zero data retention. **Still open:** Q5 (audit text) and Q6 (master key source).

1. **What does BYOK mean?** (a) model key, (b) own Google client, (c) both. **Assumed (a).**
2. **Whose Google Cloud project holds the OAuth client and the API access approval?**
   **The developer's project, applied for now, with an Organization account.** The owner's own
   project means the owner has to win API approval themselves.
3. **App login:** Google sign-in (merges the two identities) or a separate provider?
   **Separate**, so revoking Business Profile access doesn't lock the owner out of their audit
   history. (ADR-001.)
4. **Tenant key shape:** **an opaque id per business, with location as a child.** Not the Google
   account id.
5. **Review text in audit records before live data (B5):** **implement by-reference (id plus
   content hash) before Step 2's first real scan**, rather than accepting a retention exception.
6. **Hosting and secret storage:** a platform-encrypted environment variable for the master key,
   or a managed KMS? **Choose with hosting under ADR-001.** `SecretStore` keeps either swappable.
7. **Reviewer names in replies:** keep `displayName()` (warmer; breaks for anonymous reviewers;
   conflicts with PROVENANCE-001) or **drop names from replies** (simpler, no profile data in
   drafting).
8. **BYOK provider(s), and does the owner's account have zero data retention?** No default:
   that is the owner's governance call.

## Done when (this handover)

- [x] Q1–Q4 answered and recorded in `docs/DECISIONS.md` (Q4 deferred by the owner).
- [ ] Steps 1a–1e merged, each with tests that fail without the change; CI green.
- [ ] Step 2 merged, then run once read-only against a real verified location by the owner on
      their own machine or staging. A cloud sandbox cannot complete Google consent. Evidence:
      reviews ingested, no write path present, a disconnect and reconnect exercised.
- [ ] No secret in any committed file, report, artifact or log (canary test plus a secret scan).
- [ ] This file deleted; Steps 3 and 4 written up as the next handover if not done.

## Working notes for the session

- If `npm install` is blocked in the sandbox, ask the owner to allow package installs in network
  settings. A new chat picks that up. The last session had to run tests through a hand-written
  Vitest stand-in, with real CI as the confirming run.
- Reaching Google from the sandbox shell will likely be refused by the network allowlist.
  Design against the documented API, use synthetic payloads in tests, and leave live calls to the
  owner's environment.
