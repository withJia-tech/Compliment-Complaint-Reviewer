# Verified approval-to-send slice

Base: main `6b8437d77af8dd6f6b26243aaf3e59aa41110c8f`. Fixture-only; no real external
publishing, Google integration, model integration, authentication or deployment added. ADR-001
remains open. This is partial enforcement of the v0.6 principle, not a production assurance claim.

## Boundaries and ownership

- The person reviews the exact reply and confirms factual support and absence of private staff
  details, blame and unverified promises. This confirmation is an attestation, not proof of truth.
- Code checks the pinned source, draft, triage and approved facts. It validates the final text and
  stores the exact submitted text and attempt ID before invoking the fixture provider.
- There is no model in this path. The classifier branch is independent and remains unmerged.
- Identity is still `STUB_OWNER_ACTOR`. A checkbox, context hash or client flag is not authentication.
  Do not expose this prototype with real review, staff or customer data. A live integration needs
  server-authenticated owner/manager identity and per-location authorisation.

## State transitions

| Input/outcome | Stored state | Next permitted action |
|---|---|---|
| Missing confirmation, stale inputs, invalid text | Existing state unchanged | Review/correct current inputs |
| Intent recorded before provider invocation | publishing | No retry; concurrent writes refused |
| Success with reply ID and timestamp | approved / edited_approved | Read only |
| Provider confirms no publication (`success:false`) | publish_failed | Human reviews and confirms retry |
| Exception, lost response or incomplete receipt | publish_unknown | Read-only reconciliation |
| Reconciliation finds exact approved text + receipt | approved / edited_approved | Read only; no second send |
| Reconciliation conclusively proves non-publication | publish_failed | Human may retry |
| Missing/different reply or uncertain reconciliation | Remains blocked | Investigate; never infer non-publication |

New audit actions are additive: `publish_requested`, `publish_failed`, `publish_unknown`,
`publish_reconciled`, `publish_not_published`. Existing `approved_published` means confirmed
provider success, not merely owner intent. All new attempts retain exact final text, context
fingerprint, validation version and confirmation time. Each event has a random UUID.

The provider contract requires `success:false` to mean definitely no publication; adapters must
throw or return an ambiguous result when they cannot know. A future live adapter must check
source freshness and existing replies, authenticate access, and provide trustworthy reconciliation.
The stateless fixture returns `unknown` for reconciliation, deliberately: it has no independent
remote evidence. Tests use injected provider responses to exercise conclusive cases.

## Validation limits

- Blank/overlong text is blocked. Blank edits never silently fall back to the old draft.
- Conservative English patterns block explicit remedies, amounts/deadlines, personnel blame and
  completed-action assertions. Unicode compatibility forms and zero-width characters are normalised
  for checking only; the submitted reply is never silently rewritten.
- These patterns do not prove semantic truth, catch every paraphrase/language, or establish PII
  absence. Human confirmation remains mandatory; full semantic evidence and privacy validation
  remain release gates. The interface must not present passing checks as proof of v0.6 compliance.
- Templates no longer infer written praise or enjoyment from a rating/risk band. A missing approved
  contact does not invent a front desk. Aspect-specific praise preservation and contextual coaching
  are still future work; generic templates are not claimed to fulfil the entire CARE contract.

## Local concurrency and recovery

Scans, send/skip/remedy and reconciliation share `.writer-lock` inside the existing store directory.
Atomic directory creation excludes other processes using these entry points. Reads can continue;
stale or partial read snapshots cannot bypass the send-time version checks. Settled and uncertain
review snapshots are not overwritten by a rescan. A subsequent source edit needs a future explicit
re-review workflow; this change does not silently reopen a settled decision.

After a crashed process, the lock intentionally remains. There is no automatic timeout, because
expiry alone cannot prove the provider did not act. An operator must first establish that the
previous writer is stopped. Only then remove the stale lock directory and inspect pending attempts;
`publishing` is treated as uncertain and still cannot be resent. Reconcile using independent provider
evidence. Do not edit an uncertain approval to pending to bypass the block. In the fixture demo,
use a new isolated synthetic store if an interrupted attempt cannot be resolved.

This guard is limited to processes sharing one local filesystem and this protocol. It is not a
transaction across JSON files, a distributed lease, or an fsync/power-loss guarantee. Direct repository
writes outside guarded workflows are unsupported. A future hosting decision must revisit these
properties without assuming the existing store is production-ready.

## Acceptance evidence

- Four regressions were observed failing against the original source before implementation:
  invented praise, rating-only praise, false-success publication and an unvalidated refund edit.
- Boundary tests cover source/draft/triage/facts changes, legacy drafts, explicit confirmation,
  exact text persistence, confirmed failure/retry, uncertain delivery, conclusive/inconclusive
  reconciliation, storage failures before/after the side effect and cross-process lock ownership.
- Existing duplicate-send, never-auto-send, audit, scan, routing and drafter regressions remain.
- Both queue and detail use the same editor and server action, so failures are visible in both.

Remaining release gates: authenticated identity/roles, live source freshness and provider evidence,
semantic claim validation, private evidence access, retention, dependency vulnerability triage,
operational monitoring/recovery drills and the unfinished classifier evaluation. No new deployment
or tenancy model is selected here.

## Verification for this change

Local typecheck and all 133 tests passed. The production build passed, and an isolated fixture
scan processed 11 reviews followed by zero on the second pass (`node --import tsx` was used because
this runtime blocks the tsx CLI IPC socket). No real publishing was attempted.

Interactive browser QA remains incomplete: the local Chromium launch failed because its Unix
socket operation was denied; the shared browser could not reach the local server. Both UI surfaces
compile and share the guarded editor, but that is not evidence of a completed browser walkthrough.
Review the draft PR and complete browser acceptance before merging/releasing.
