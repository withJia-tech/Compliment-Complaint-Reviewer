# Client demo to single-business pilot

Status: proposed delivery scope, 13 November 2026. This supersedes the ordering in
CONTROLLED_LEARNING_PLAN.md; that plan remains the later improvement track.
Inspected branch: codex/verified-approval-send at 6903ba22f1b367072a6fe5447fbbae6848d2eee4.
No live deployment or production readiness is claimed.

## Outcome

Give a restaurant owner a credible demonstration of their daily review workflow, then deliver
that same workflow as a controlled live service for one business/location. Do not require a
learning platform, retrieval index or autonomous agent to make the first pilot useful.

Product promise: the owner can see which reviews need attention, inspect the supporting facts,
prepare an appropriate reply, approve the exact text and know whether it was published.

## Stage A — repeatable client demonstration

Use a fictional restaurant and clearly marked synthetic reviews until the client supplies and
authorises business facts and data. Show the business's approved contact route and policies;
never invent them. The existing fixture provider remains labelled simulated throughout.

Prepare a five-minute walkthrough:

1. **Prioritise:** open a populated queue, explain why a serious allegation needs attention
   regardless of stars, then show a straightforward positive review.
2. **Review and respond:** inspect the review and approved facts, edit a draft, confirm the
   exact version and simulate sending. Show the resulting audit entry.
3. **Recover safely:** demonstrate a stale source or unsupported refund being blocked, then
   an uncertain send remaining blocked until reconciliation. Show what the owner does next.

Keep technical controls in an optional evidence view. Client-facing text should explain the
consequence and next action. Do not describe a keyword classifier as an LLM or imply that the
simulated send reached Google. Insights are descriptive review themes, not verified root causes.

Demo deliverables:

- One named fictional business, consistent facts, and scenarios covering praise, mixed feedback,
  a serious allegation, unsupported remedy, changed source and uncertain publication.
- A deterministic setup/reset command restricted to fixture mode; never a reset route exposed
  to live users. Repeat the walkthrough twice with identical starting conditions.
- Visible mode and build identity, useful empty/error states, responsive owner workflow and a
  short presenter script with a backup recording or screenshots.
- A reviewable delivery link after hosting/access is selected, plus a reproducible local run.
  Do not expose the current unauthenticated mutation routes on a publicly accessible server.
- Evidence pack: exact commit, test report, actual browser walkthrough results and known limits.

Acceptance: a presenter completes the walkthrough without shell repair; each rejection has a
clear next action; all external effects are simulated; client can distinguish current capabilities
from proposed work. Record browser/device coverage rather than claiming untested compatibility.

## Stage B — one-business live pilot

Initial scope: one location, named owner, review intake, deterministic triage, approved facts,
editable replies, explicit human send, provider reconciliation and audit history. Start with the
existing rules/templates; add model interpretation only if measured results justify it.

| Release requirement | Required evidence |
|---|---|
| Identity and authorisation | Authenticated owner; server-side scope checks on every read/write, settings and scan endpoint; revoked access denied; session/request protections tested |
| Real source and publishing | Approved provider access and business ownership; separate read/write permissions; freshness and existing-reply checks; real provider receipt/reconciliation semantics tested |
| Business configuration | Owner-approved facts, contact route and policies, versioned changes and pending-draft invalidation; no sample facts in live mode |
| State and recovery | Selected durable storage, concurrency and idempotency tests, restart recovery, backup/restore exercise; no assumption that local filesystem locks cover multiple hosts |
| Safe replies | Existing versioned confirmation plus reviewed factual-support rules and privacy checks; unsupported languages/cases held for human handling; no unsupported remedies or staff blame |
| Operations | Named operator; observable ingestion failures, queue ageing and unknown sends; alert acknowledgement, rollback procedure and agreed support hours |
| Data handling | Permitted source use, minimised retention, secrets management, authorised staff-only evidence, access/removal procedures and sanitised logs |
| Release evidence | Pinned build/config, relevant tests and adversarial cases, resolved blocking security findings, staging rehearsal and explicit owner acceptance |

Read-only provider pilot precedes live sending. Production enablement is a separate explicit
approval after these checks. A production build command or polished interface does not satisfy
them. Keep the last known-good release available; rollback must not replay external writes.

Do not choose hosting, database, identity provider or deployment topology solely because the
pilot has one client. ADR-001 remains open; document options and choose the minimum supported
configuration once operator, access and retention requirements are known.

## Stage C — measured improvement

Once the live workflow is dependable, add the controlled learning plan in small increments:
allowlisted operational events, permissioned feedback, adjudicated offline evaluation, then
read-only shadow comparisons and explicit bundle promotion. Retrieval stays disabled until
its value and data permissions are established. No feedback event changes live behaviour.

## Immediate implementation order

1. Reconcile the current branch/open PRs and establish a reproducible test baseline.
2. Build the fixture-only demo setup/reset and controlled failure scenarios; validate a complete
   owner walkthrough and record the evidence. Keep the existing human-only send contract.
3. Package the presenter script and delivery instructions; select an authorised access/hosting
   arrangement before publishing a demo URL.
4. Resolve the live pilot inputs below, then implement authentication and read-only intake.
5. Complete storage/recovery, live send/reconciliation and operational acceptance before enabling
   the first real business. Add learning-loop work only after that baseline is useful and stable.

## Client inputs needed for live delivery

- Business/location, authorised owner and approved business facts/contact policies.
- Whether Google Business Profile is the initial source, who owns the profile and whether API
  access is available. Do not substitute scraping when access is absent.
- Who operates/supports the pilot, where it may run and what retention/access requirements apply.

These inputs do not block the fictional demo. They do determine the live-service implementation.

## Honest client positioning

“This demo shows the owner workflow and its safeguards using sample reviews. The first live
release is scoped to one business, with every reply approved by its owner. Live account access,
security and recovery checks are the remaining release gates.”
