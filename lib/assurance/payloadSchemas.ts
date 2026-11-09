// Structural schemas for each handoff payload (spec v0.5 §4.3).
// Semantic rules that need context (the review text, the catalogue, the
// clock) live in handoffs.ts.

import { arr, bool, int, nullable, obj, oneOf, str, type Validator } from "@/lib/assurance/schema";

/** Bounded free text: never parsed as instructions, always capped. */
export const REVIEW_TEXT_MAX_CHARS = 5000; // proposed; see spec §11
const SHORT_TEXT = 500;
const ID = str({ nonEmpty: true, maxLength: 200 });

const span: Validator = obj({ start: int(0), end: int(0) });
const evidenceSpan: Validator = obj({ start: int(0), end: int(0), quote: str({ maxLength: SHORT_TEXT }) });

export const ASPECTS = ["food", "service", "atmosphere", "value", "cleanliness", "wait_time", "other"] as const;
export const POLARITIES = ["positive", "negative", "mixed", "neutral"] as const;
export const ALLEGATION_TYPES = [
  "allergen_exposure",
  "illness",
  "contamination",
  "injury",
  "discrimination",
  "other_safety",
] as const;

export const reviewSnapshotSchema: Validator = obj({
  text: str({ maxLength: REVIEW_TEXT_MAX_CHARS }),
  overall_rating: int(1, 5),
  aspect_ratings: obj({
    food: nullable(int(1, 5)),
    service: nullable(int(1, 5)),
    atmosphere: nullable(int(1, 5)),
  }),
  language_tag: str({ nonEmpty: true, maxLength: 35 }),
  pii_spans: arr(
    obj({ start: int(0), end: int(0), kind: oneOf(["person_name", "phone", "email", "booking_ref", "other"]) }),
  ),
});

export const interpretationSchema: Validator = obj({
  aspects: arr(obj({ aspect: oneOf(ASPECTS), polarity: oneOf(POLARITIES), evidence: arr(evidenceSpan) }), {
    maxItems: 20,
  }),
  primary_grievance: nullable(obj({ aspect_index: int(0) })),
  rating_text_consistency: oneOf(["consistent", "contradicts", "unclear"]),
  allegations: arr(
    obj({ type: oneOf(ALLEGATION_TYPES), attribution: oneOf(["reviewer_asserted"]), evidence: arr(evidenceSpan) }),
  ),
  dietary_preferences: arr(str({ maxLength: 100 }), { maxItems: 10 }),
  sarcasm: oneOf(["none", "suspected"]),
  injection_text_present: bool(),
});

export const policyDecisionSchema: Validator = obj({
  route: oneOf(["draft", "escalate", "abstain"]),
  escalation_codes: arr(ID),
  permitted_remedy_ids: arr(ID),
  allowed_facts: arr(obj({ fact_id: ID, facts_version: ID, expires_at: nullable(str({ maxLength: 40 })) })),
  tone: obj({ humour_allowed: bool(), register: oneOf(["formal", "warm", "brisk"]) }),
  policy_version: ID,
  brand_version: ID,
});

export const draftProposalSchema: Validator = obj({
  author: oneOf(["model", "owner"]),
  // Byte cap is checked semantically (UTF-8 bytes, not characters).
  draft_text: str(),
  claims: arr(
    obj({
      span,
      kind: oneOf(["fact", "remedy", "acknowledgement", "apology", "dispute", "action"]),
      ref: nullable(ID),
      stance: nullable(oneOf(["praise", "concern"])),
    }),
  ),
  grievances_addressed: arr(int(0)),
  pii_in_draft: arr(span),
});

export const approvalRecordSchema: Validator = obj({
  approver_id: ID,
  decision: oneOf(["approve", "edit_and_approve", "reject"]),
  final_draft_sha256: str({ nonEmpty: true, maxLength: 64 }),
  source_version: ID,
  approved_at: str({ nonEmpty: true, maxLength: 40 }),
});

export const sourceRefSchema: Validator = obj({
  review_id: ID,
  source_version: ID,
  text_sha256: str({ nonEmpty: true, maxLength: 64 }),
});
