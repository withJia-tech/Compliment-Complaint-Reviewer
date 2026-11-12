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

### Routing rubric

Evaluated in order; the first rule that matches decides. Implemented in
`lib/triage/policy.ts`, and checked case by case against `data/fixtures/golden.json`.

| # | Condition | Risk | Sensitive | Action |
|---|---|---|---|---|
| 1 | Matches a **strong** sensitive term | high | yes | approval required |
| 2 | Matches only a **weak** sensitive term | max(medium, star band) | yes | approval required |
| 3 | 1–2 stars | high | no | approval required |
| 4 | 3 stars, or 4–5 stars with a complaint term | medium | no | approval required |
| 5 | 4–5 stars, no complaint term | low | no | auto-publish eligible |

Star band alone (used by rule 2): 1–2 stars → high, 3 stars → medium, 4–5 → low.

**Nothing sensitive is ever auto-published**, at any star rating, under any consent
setting. Rule 1 and rule 2 both end in approval required, and that invariant is
asserted directly in the golden test.

### Sensitive categories, by severity

When a review matches several categories, the highest in this list is reported — a
deliberate ordering, not the accident of source order it replaces. A strong match in
any category outranks a weak match in every category.

1. `sensitive_safety` — physical harm
2. `sensitive_medical`
3. `sensitive_discrimination`
4. `sensitive_legal`
5. `sensitive_fraud`
6. `sensitive_compensation` — money

**Strong** terms are unambiguous in a review ("food poisoning", "lawsuit", "racist").
**Weak** terms are real signals that also carry ordinary meanings ("sick of waiting",
"burnt toast"). Weak terms still mark the review sensitive — so it is never
auto-published — but only floor it at medium, so ambiguous hits don't crowd genuine
claims out of the top of the queue.

### Matching rules

Terms match on **word boundaries**, never as substrings. A term ending in `*` matches
a word prefix (`injur*` covers injury, injured, injuries). This matters: substring
matching made "issue" match "sue", so every review mentioning an issue was classified
as a legal threat. The golden set carries a guard case for each known collision.

Complaint terms — and only complaint terms — are dropped when negated ("no issues at
all"), unless the same term also appears un-negated. Sensitive terms are never
negation-filtered: missing a real safety claim costs more than carrying one
over-cautious flag.

### Grounding rubric

The drafter may use exactly two inputs: the review itself, and the approved business
facts. It selects a template by risk level and sensitivity, then fills named slots
only from `ApprovedBusinessFacts`, recording each key used in `Draft.factsUsed`. A
slot with no matching approved fact falls back to generic wording — never an invented
one. No template may contain a refund, voucher, timeline, cause, or promise of any
remedy.

A draft is **grounded** if every factual claim in it traces to a cited fact key or to
the review text. A draft is **useful** if it: addresses the reviewer by name,
acknowledges the specific sentiment triage found, and — for anything above low risk —
offers a route to continue the conversation off the public page. These are the
criteria the next round of human validation should score against; they are not
machine-checked today, and `factsUsed` is what makes the grounding half auditable.

### Theme rubric

Reviews are tagged Food / Service / Atmosphere — the sub-ratings Google Business
Profile already collects — so weekly and monthly rollups can be read against the
owner's existing Google metrics. Themes are additive: a review can carry several, or
none. **An empty theme list is a valid result**, not a gap: a billing dispute belongs
to none of the three.

## Goodwill remedies

Vouchers, refunds, and other goodwill are settled **outside this application** — over
email, WhatsApp, phone, or in person. The app records that a remedy was offered so
the audit trail is complete, but never sends one, and never mentions one in the
published reply. Recording a remedy writes a `remedy_recorded` audit entry and
changes no approval status.

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
- The draft is useful without inventing facts, by the grounding rubric above.
- The user can explain why a review was flagged sensitive, and which category.
- The prototype is suitable for a live Google integration without redesigning the core workflow.
