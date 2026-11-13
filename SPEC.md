# Compliment Complaint Reviewer — Prototype Specification

## Product boundary

The prototype represents one business with one Google Business Profile location. It runs a daily
scan over new or updated reviews, applies deterministic triage rules, drafts a reply from approved
business facts, and queues the result for the owner, who sends every reply themselves.

## Stage: prove the logic for one person first

The first goal is to prove the triage, drafting and approval logic for a single owner running a
single business. Scaling to many locations or agencies is deliberately deferred, and each
decision is made so it can be changed cheaply later — a two-way door. Decisions that cannot be
undone cheaply are called out as one-way doors, with the reasoning, in
[docs/DECISIONS.md](docs/DECISIONS.md), which also holds the backlog.

## Prototype mode

This first slice is fixture-backed. It does not connect to Google, send email, publish replies, or
expose MCP tools. The interface is designed around the production contracts those integrations
will later implement.

## Sending

**Nothing is ever sent automatically.** Every reply — including a clean five-star thank-you — waits
in the queue until the owner sends it. Low-risk reviews are marked **quick approve**, so clearing
one takes a single click, but a person still clicks.

Auto-send is in the backlog as a much narrower rule than the consent toggle it replaces: only a
5-star review that is *deterministically* positive. See docs/DECISIONS.md for the conditions it
would have to meet before being built.

## Data residency

This design assumes live Google reviews, where the owner's data stays in the owner's Google
account:

- **Google is the system of record** for review text and for published replies. This app holds
  only its own working state: how each review was triaged, the draft, the owner's decision, any
  remedy note, and the audit trail.
- **"Has this review been answered?" is ultimately a question for Google**, not for the local
  store. The local approval status is a cache of that fact plus the owner's intent.
- **Prior cases are read from Google at the moment they are needed.** There is no local archive of
  review history, which keeps the "no long-term review-content storage" non-goal intact.
- **Known gap:** audit records still embed a snapshot of the review text as evidence. That is
  fine while the provider is a fixture; with a live provider the audit should reference the
  review id and a content hash, and fetch the text from Google when it is displayed.

## Primary workflow

1. Business owner connects one verified location through Google OAuth.
2. A daily worker fetches reviews created or updated since the previous successful scan.
3. Triage assigns a risk level, reason codes, recommended action, and confidence.
4. The drafting step uses only approved business facts and the review content.
5. Every review waits for the owner. Low-risk ones are marked quick approve.
6. The owner sends, edits-and-sends, or skips each reply; mixed, negative and sensitive reviews
   are flagged for a closer read.
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
| 1 | Matches a **strong** sensitive term | high | yes | needs review |
| 2 | Matches only a **weak** sensitive term | max(medium, star band) | yes | needs review |
| 3 | 1–2 stars | high | no | needs review |
| 4 | 3 stars, or 4–5 stars with a complaint term | medium | no | needs review |
| 5 | 4–5 stars, no complaint term | low | no | quick approve |

Star band alone (used by rule 2): 1–2 stars → high, 3 stars → medium, 4–5 → low.

**Nothing sensitive is ever offered as quick approve**, at any star rating. Rules 1 and 2 both
end in needs review, and that invariant is asserted directly in the golden test. Because nothing
is auto-sent, this decides how much attention a review gets, not whether a human sees it — a
human sees all of them.

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
offered as a quick approve — but only floor it at medium, so ambiguous hits don't crowd genuine
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

Terms are also matched against a **normalised copy** of the text with zero-width
characters removed, spaced or dotted letters joined ("l a w y e r", "s.u.e") and digits
between letters read as letters ("f00d p0isoning"). The stored text is never changed.

### Deterministic guards

Without any keyword list or model, a review is never quick approve when it contains:
a phone number, email, street address, or card or order number (`personal_info`); a link
(`contains_link`); gibberish (`unreadable`). Instructions aimed at software ("ignore previous
instructions") are a sensitive category of their own (`sensitive_prompt_injection`).

### Second reader (optional, bring your own key)

A language model reads each review in any language, including Singlish, Malay, Chinese and
slang, and returns a structured reading: concern (none, complaint, sensitive), the sensitive
category, whether it contains personal details, and a one-sentence rationale.

- **It can only raise attention.** It never lowers a risk level, clears a sensitive flag, or turns
  needs review into quick approve. A reading of sensitive sets high risk.
- **It fails closed.** A refusal, an API error or a missing cached reading puts the review in
  needs review (`reader_failed`).
- **Without a reader**, a review mostly in a non-Latin script is never quick approve
  (`unreadable`): nothing could read it.
- The review text is passed as data inside tags; instructions inside it are reported, never followed.
- Each owner uses their own Anthropic key (`ANTHROPIC_API_KEY`). The app never stores a key.

### Golden dataset

`tests/fixtures/golden/risk_classifier_v<N>.jsonl` states what triage should decide for each
review, in families: baseline, routine complaint, sensitive, mixed signal, PII, adversarial,
multilingual and edge case. A version is pinned by checksum in `MANIFEST.json` and never edited
once approved; a change means a new version and a new evaluation run. An evaluation run
(`npm run read:golden`) saves the model's readings so the test replays them for free. The test
also checks the no-key mode never quick-approves a review the dataset says needs a read, apart
from a short, named list that only a reader can catch.

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
- Automatic sending of any reply. (Backlog: a narrow rule for deterministic 5-star positives —
  see docs/DECISIONS.md.)
- Issuing, sending, or tracking the fulfilment of vouchers or refunds.

## Production-shaped interfaces to preserve

- **ReviewProvider**: list new or updated reviews; retrieve a review; publish a reply.
- **TriagePolicy**: deterministic classification and routing.
- **ReplyDrafter**: evidence-bound draft generation.
- **ApprovalChannel**: email first; MCP-compatible actions later.
- **AuditRecord**: policy version, source timestamps, evidence, action, actor, and outcome.

## Success criteria for the next validation

- A reviewer can understand the daily queue in under one minute.
- The interface makes it obvious how much attention each review needs, and that the owner sends every reply.
- The draft is useful without inventing facts, by the grounding rubric above.
- The user can explain why a review was flagged sensitive, and which category.
- The prototype is suitable for a live Google integration without redesigning the core workflow.
