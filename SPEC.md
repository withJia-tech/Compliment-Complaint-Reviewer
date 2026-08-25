# Compliment Complaint Reviewer — Prototype Specification

## Product boundary

The prototype represents one business with one Google Business Profile location. It runs a daily
scan over new or updated reviews, applies deterministic triage rules, drafts a reply from approved
business facts, and routes the result to either automatic publishing or human approval.

## Prototype mode

This first slice is fixture-backed. It does not connect to Google, send email, publish replies, or
expose MCP tools. The interface is designed around the production contracts those integrations
will later implement.

## Primary workflow

1. Business owner connects one verified location through Google OAuth.
2. A daily worker fetches reviews created or updated since the previous successful scan.
3. Triage assigns a risk level, reason codes, recommended action, and confidence.
4. The drafting step uses only approved business facts and the review content.
5. Low-risk positive reviews may be auto-published only after explicit consent.
6. Mixed, negative, or sensitive reviews create an approval task.
7. Every decision records the policy version, evidence, draft, approval, and provider result.

## Default policy

Three risk levels — low, medium, high. There is no separate escalation tier: the
operator is a one-person team or an agency managing businesses, so there is nobody
to escalate to. Sensitive claims are high risk carrying a `sensitive` flag.

- 4–5 stars with no complaint: **low** — eligible for automatic publishing after consent.
- 3 stars or mixed sentiment: **medium** — approval required.
- 1–2 stars: **high** — approval required and issue classification shown.
- Safety, legal, discrimination, medical, fraud, or compensation claims: **high + sensitive**;
  never auto-published at any star rating, and answered personally.
- The model must not invent refunds, causes, timelines, promises, or operational facts.

## Goodwill remedies

Vouchers, refunds, and other goodwill are settled **outside this application** — over
email, WhatsApp, phone, or in person. The app records that a remedy was offered so
the audit trail is complete, but never sends one, and never mentions one in the
published reply.

## Feedback themes

Reviews are tagged Food / Service / Atmosphere — the same split Google Business Profile
already collects as sub-ratings — and rolled up weekly or monthly so the operator can
corroborate the queue against their existing Google metrics.

## Non-goals

- Scraping Google Maps pages.
- Storing Google passwords.
- Managing multiple locations in the first slice.
- Long-term storage of review content. Weekly and monthly rollups aggregate reviews
  already ingested; they add no new retention.
- MCP as the scheduler or system of record.
- Automatic publishing without explicit business consent.
- Issuing, sending, or tracking the fulfilment of vouchers or refunds.

## Production-shaped interfaces to preserve

- **ReviewProvider**: list new or updated reviews; retrieve a review; publish a reply.
- **TriagePolicy**: deterministic classification and routing.
- **ReplyDrafter**: evidence-bound draft generation.
- **ApprovalChannel**: email first; MCP-compatible actions later.
- **AuditRecord**: policy version, source timestamps, evidence, action, actor, and outcome.

## Success criteria for the next validation

- A reviewer can understand the daily queue in under one minute.
- The interface makes automation versus human review obvious.
- The draft is useful without inventing facts.
- The user can explain why a review was escalated.
- The prototype is suitable for a live Google integration without redesigning the core workflow.
