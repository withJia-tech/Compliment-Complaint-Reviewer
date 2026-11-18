# Pilot memory API contract — proposal v0.1

19 November 2026. No routes, migrations or provider integrations are implemented here.
Parent design: [authentication, storage and recovery](PILOT_AUTH_STORAGE_RECOVERY_DESIGN.md).

## Authority and scope

The browser may request a case ID and submit draft text. It cannot supply an authorised
owner, tenant, role, approval status, audit actor or publishing instruction. The server
resolves identity and permissions first. Query/body/route IDs are untrusted selectors.
Model output cannot create this trusted envelope.

```typescript
type CaseScope = {
  workspaceId: string;
  businessId: string;
  datasetId: string;
  caseId: string;
};
// Produced by server identity and membership checks, never accepted from JSON.
type AuthorisedCaseContext = {
  ownerId: string;
  appSessionId: string;
  scope: CaseScope;
  permissionVersion: string;
};
type DraftDependencySnapshot = {
  sourceVersion: string;
  sourceHash: string;
  datasetVersion: string;
  ownerOriginalVersion: string | null;
  selectedPolicyVersion: string;
  applicableFacts: Array<{ id: string; version: string; digest: string }>;
  interpretationVersion: string | null;
  brandVersion: string | null;
  contractVersion: "pilot-memory-v0.1";
};
```

Use explicit null for stages not implemented. Hash a canonical server-generated
serialization, with tests for field order, missing versus null, text normalization and
fact order. Model/prompt/configuration identifiers and assurance versions join the full
H5 approval snapshot if those stages are later introduced. A provider's unrelated model
release does not invalidate an existing run automatically; selection of new required
policy/assurance dependencies does. Checksums establish consistency, not claim truth.

## Proposed endpoints

| Endpoint | Permission and result |
|---|---|
| `POST /api/pilot/auth/request-code` | Allowlisted enrolment only, throttled, generic response; no case data |
| `POST /api/pilot/auth/verify-code` | Verify with managed auth, map subject to membership, establish app session |
| `POST /api/pilot/auth/sign-out` | Revoke this app session and explicit provider local scope; CSRF required |
| `POST /api/pilot/auth/sign-out-all` | Explicit action; revoke all owner's app sessions and provider sessions |
| `GET /api/pilot/cases/{caseId}/draft` | Authorised exact scope; return committed head + original/provenance + dependency snapshot |
| `PUT /api/pilot/cases/{caseId}/draft` | Authorised conditional save; one revision/event/receipt transaction |
| `GET /api/pilot/cases/{caseId}/saves/{requestId}` | Authorised receipt lookup; return original outcome and current head, or not-found |
| `POST /api/pilot/cases/{caseId}/corrections` | Authorised candidate record only; idempotent, source-pinned, cannot change active interpretation/policy |

Business/dataset scope is resolved from the server-authorised case, with explicit
scope selection when case IDs are not globally unique. An immutable globally unique
case UUID is recommended for URLs, while composite scope remains enforced in storage.
ID guessing returns no private data. No `/publish` endpoint or provider write adapter is
part of this slice. Fact approval and local H5 approval require separate contracts and
validation before implementation; saving draft text cannot call either.

## Load and save example

```http
GET /api/pilot/cases/case-uuid/draft
Cookie: __Host-ccr_session=<opaque>

200 OK
Cache-Control: private, no-store
ETag: "epoch-uuid:version-uuid"
```

```json
{
  "caseId": "case-uuid",
  "epoch": "epoch-uuid",
  "version": "version-uuid",
  "revision": 7,
  "text": "Thank you for recognising the team's care.",
  "contextVersion": "server-computed-context-hash",
  "approvalCurrent": false
}
```

```http
PUT /api/pilot/cases/case-uuid/draft
If-Match: "epoch-uuid:version-uuid"
Idempotency-Key: request-uuid
X-CSRF-Token: <bound token>
Content-Type: application/json
```

```json
{
  "text": "Thank you for recognising our team's care during your visit.",
  "contextVersion": "server-computed-context-hash"
}
```

```json
{
  "outcome": "saved",
  "epoch": "epoch-uuid",
  "committedVersion": "new-version-uuid",
  "currentVersion": "new-version-uuid",
  "revision": 8,
  "replayed": false,
  "externalAction": "none"
}
```

In the executable design model, the server-validated scope and parsed headers are
passed as request fields. That is not permission to accept them unverified over HTTP.
The model does not implement the complete HTTP schema, CSRF or canonical serializer.

Strict body schema rejects unknown fields, wrong types, oversized payloads and
malformed identifiers. Empty text is a valid saved draft; it is not approvable as a
public reply. Text is stored exactly as submitted, not silently trimmed, normalised or
rewritten. Hashing and comparison must use documented consistent byte conventions.
Apply request limits before parsing deeply; proposed text and body limits are in the
parent design. IDs and lists have explicit bounded schemas at implementation.

## Errors and retry rules

| HTTP / code | Store outcome | Client action |
|---|---|---|
| 401 `reauth_required` | No write | Keep local text; reauthenticate, reload head, then explicitly retry |
| 403 `csrf_invalid` | No write | Stop request; do not silently remove protection |
| 404 `case_not_found` | No private existence disclosure | Keep local buffer scoped to its original owner; no cross-account display |
| 428 `precondition_required` | No write | Fetch head; supply version/epoch |
| 412 `version_conflict` | No write | Compare latest head with local text; reconcile and use a new request key |
| 409 `context_changed` | No write | Retain text, refresh evidence/facts/policy, invalidate confirmation |
| 409 `idempotency_key_reused` | No write | Investigate changed payload; never reuse key for a different save |
| 409 `restore_epoch_changed` | No write/replay | Stop old queue; reauthenticate/reload and explicitly reconcile |
| 413 / 422 `invalid_request` | No write | Preserve text and explain the structural issue |
| 429 `rate_limited` | No write for a rejected request | Respect Retry-After; preserve original request/key |
| 503 / transport timeout | May be unknown whether commit occurred | Query receipt or retry the identical request; keep “checking save” status |

Only a committed receipt or authoritative read establishes success. A missing receipt
does not prove a timed-out request failed: it may still be in flight. A retry under the
same key is safe only because the database serialises it with the original request.
The receipt key is unique by owner, workspace/business/dataset and operation key; its
hash includes operation type, full case scope, expected epoch/version/context and text.
Authentication/authorisation and epoch checks precede returning a historical receipt.

After a receipt expires, an old expected immutable version cannot overwrite a newer
head. A conflict is not permission to retry unconditionally. Restores change the epoch
so rolled-back receipts/version numbers cannot enable old requests. The actual
implementation must cover retries arriving simultaneously and after retention cleanup.

## Atomic storage handoff

Suggested records: `draft_heads`, `draft_versions`, `case_events`, `save_receipts`.
All use composite foreign keys to the same scoped case; versions are immutable UUIDs.
One transaction serialises the scoped request key and case head, then validates the
expected version and current dependencies. Unique constraints prevent duplicate
versions, receipts and events. It writes all four records or none. No provider/model
call occurs inside it. Only after commit may the HTTP handler return `saved`.

Concurrent fact/source/policy mutation must participate in the same dependency locking
or serializable protocol. Time-dependent fact expiry is re-evaluated at approval/use,
even without a database update. Do not mark an old approval current merely because its
draft text is unchanged. Historical approvals remain historical; no rewrite of old
triage, audit or owner decisions.

The store adapter receives an authorised server context and a validated command. It
does not accept a model-created principal. The reference model uses synthetic fixture
sessions and an atomic object replacement; it cannot prove SQL/RLS/auth correctness.

## Output and observability contract

Record operation ID, server trace ID, scope-safe case ID, policy/contract version,
previous/committed version, actor ID, outcome, latency and retry/conflict category.
Keep full draft content, review text, email codes, cookies and tokens out of operational
logs. An audit event references the protected revision record rather than duplicating
its text. Delivery metrics count logical operations separately from retry attempts.

For future model interpretation: provide only the approved, minimised case context;
accept a schema-bound proposal with source/evidence references; validate it in code;
record uncertainty and ask for owner context when needed. No proposal may approve a
fact, save an authoritative owner draft, modify the routing policy or promote a
correction. Approved facts and interpretation examples are different data contracts.
