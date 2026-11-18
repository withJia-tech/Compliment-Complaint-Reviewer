# Pilot memory policy — accepted product direction

18 November 2026. Accepted after the user reviewed the trade-offs. This records requirements; runtime implementation and verification are pending.

## Agreed scope

- One owner works across phone and desktop and can resume the same saved case and draft.
- Retain both existing datasets: synthetic examples and name-masked real-review examples. Keep dataset, business and case identities distinct.
- Reuse a small set of explicitly owner-approved business facts within the applicable business/location.
- Keep incident accounts and customer-specific recovery details attached to their case, with attribution.
- Retain selected interpretation corrections as reviewable candidates. They do not automatically change prompts, routing, approved facts or future interpretations.
- Keep the owner original, current draft and final decision distinguishable. Saving a draft is not approving or sending a reply.

## Authority and lifecycle

Application code resolves the owner/business scope, validates revisions, saves state and reports success only after the required commit. The owner approves facts and final replies. A model may propose meaning or wording; it cannot author trusted identity, approve a fact, promote a correction or persist authoritative state.

Each reusable business fact needs an ID, applicable scope, source, approving owner, version and active/superseded/withdrawn status. A review date or expiry is required where the fact can become stale. An owner assertion about a particular incident remains an attributed account, not a reusable verified business fact.

A correction candidate retains its relevant excerpt, proposed interpretation, owner explanation, source/context versions, uncertainty and counterexamples. A future promotion requires explicit review and measured regression/semantic evidence. “Dope” in explicit food praise must not create a universal positive-word exemption. No cross-business reuse or reviewer/staff profiling is authorised.

Dataset selection determines test input. It does not authorise real-data model egress, automatic retention of every review or mixing fixture business facts with real examples.

## Bounded next acceptance checks — all NOT_RUN

| ID | Required behaviour | Observable result |
|---|---|---|
| PM-01 | Resume a saved phone draft on desktop | Same business/dataset/case, exact saved text and revision; original preserved |
| PM-02 | Reject a stale edit from the other device | Newer revision unchanged; stale text preserved for explicit reconciliation |
| PM-03 | Handle failed or interrupted saving | No false saved/success state; unsaved text recoverable under the documented failure model |
| PM-04 | Repeat an identical save request | One committed revision/event; conflicting request reuse rejected |
| PM-05 | Enforce owner/business/dataset boundaries | Unauthorised reads/writes denied; similarly named cases do not collide |
| PM-06 | Reuse only applicable approved facts | Withdrawn, expired, unapproved or out-of-scope facts excluded with a visible reason |
| PM-07 | Change a source, draft or relied-on fact | Dependent assurance and approval become stale; confirmation cannot silently carry over |
| PM-08 | Record a correction candidate | Future policy/examples remain unchanged until a separately reviewed promotion |
| PM-09 | Leave for the engineering companion and return | Same unsent work remains available; exercise the selected navigation and lifecycle explicitly |
| PM-10 | Keep draft and decision authority separate | Save has zero publishing calls and cannot create an approval |

Record case/run IDs, exact inputs/revisions, commands, failures and observed numerators/denominators. Passing a fake adapter test would establish orchestration only. Cross-device acceptance needs the actual authenticated shared-state path; a browser-local store cannot establish it.

## Implementation planning

1. Reinspect current main, PRs and draft/storage interfaces; preserve existing work and compare the newer policy safeguards before choosing an integration base.
2. Define the scoped save/load/conditional-update interfaces and demonstrate conflict and failure behaviour with synthetic records.
3. Present concrete identity, shared-storage and recovery options against the one-owner requirement. Hosting, provider, database, retention period and backup responsibilities remain open under ADR-001.
4. After the required architecture decisions, connect the narrow cross-device path and execute PM-01–PM-10. Keep mobile browser evidence separate from unit and contract tests.

The acceptance of controlled reuse settles the product direction. It does not select a database, authentication vendor, new integration, automatic learning or a deployment. Existing browser/recovery assertions remain visible; this documentation update does not change their expectations or claim they now pass.
