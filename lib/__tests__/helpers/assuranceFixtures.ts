// Shared synthetic fixtures for the assurance tests. The review is the
// COC-EV-026 example from the v0.4 evaluation package: service praised,
// value and food criticised. All data is fictional.

import { sha256 } from "@/lib/assurance/hash";
import {
  CONTRACT_VERSION,
  type Claim,
  type ClaimKind,
  type DraftProposal,
  type EvidenceSpan,
  type HandoffEnvelope,
  type HandoffType,
  type InterpretationResult,
  type PolicyDecision,
  type ReviewSnapshot,
  type SourceRef,
} from "@/lib/assurance/types";

export const REVIEW_TEXT = "Service was good, but the pancakes were overpriced and the coffee too acidic.";

export function evidence(text: string, quote: string): EvidenceSpan {
  const start = text.indexOf(quote);
  if (start < 0) throw new Error(`fixture error: "${quote}" not in text`);
  return { start, end: start + quote.length, quote };
}

export function snapshot(overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot {
  return {
    text: REVIEW_TEXT,
    overall_rating: 2,
    aspect_ratings: { food: null, service: null, atmosphere: null },
    language_tag: "en-SG",
    pii_spans: [],
    ...overrides,
  };
}

/** Aspect 0 service (positive), 1 value (negative, primary), 2 food (negative). */
export function interpretation(overrides: Partial<InterpretationResult> = {}): InterpretationResult {
  return {
    aspects: [
      { aspect: "service", polarity: "positive", evidence: [evidence(REVIEW_TEXT, "Service was good")] },
      { aspect: "value", polarity: "negative", evidence: [evidence(REVIEW_TEXT, "pancakes were overpriced")] },
      { aspect: "food", polarity: "negative", evidence: [evidence(REVIEW_TEXT, "coffee too acidic")] },
    ],
    primary_grievance: { aspect_index: 1 },
    rating_text_consistency: "consistent",
    allegations: [],
    dietary_preferences: [],
    sarcasm: "none",
    injection_text_present: false,
    ...overrides,
  };
}

export function policy(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    route: "draft",
    escalation_codes: [],
    permitted_remedy_ids: ["R-REVISIT-NOTE"],
    allowed_facts: [{ fact_id: "F-PRICING", facts_version: "approved_fixture_v1", expires_at: null }],
    tone: { humour_allowed: false, register: "warm" },
    policy_version: "policy_fixture_v1",
    brand_version: "brand_fixture_v1",
    ...overrides,
  };
}

export function claim(
  draftText: string,
  phrase: string,
  kind: ClaimKind,
  ref: string | null,
  stance: Claim["stance"] = null,
): Claim {
  const start = draftText.indexOf(phrase);
  if (start < 0) throw new Error(`fixture error: "${phrase}" not in draft`);
  return { span: { start, end: start + phrase.length }, kind, ref, stance };
}

/** A draft that passes every code-decided check. */
export const GOOD_DRAFT_TEXT =
  "Thank you for the kind words about our service team. We're sorry the pancakes felt poor value for the price, " +
  "and that the coffee was too acidic for you. Our menu prices are set seasonally and listed at the counter. " +
  "We'd welcome the chance to hear more if you visit again.";

/** Claims for the reference draft; also valid for any text that starts with it. */
function referenceClaims(text: string): Claim[] {
  return [
    claim(text, "Thank you for the kind words about our service team.", "acknowledgement", "0", "praise"),
    claim(text, "We're sorry the pancakes felt poor value for the price,", "apology", "1"),
    claim(text, "and that the coffee was too acidic for you.", "acknowledgement", "2", "concern"),
    claim(text, "Our menu prices are set seasonally and listed at the counter.", "fact", "F-PRICING"),
    claim(text, "We'd welcome the chance to hear more if you visit again.", "acknowledgement", "1", "concern"),
  ];
}

export function goodDraft(overrides: Partial<DraftProposal> = {}): DraftProposal {
  const text = overrides.draft_text ?? GOOD_DRAFT_TEXT;
  return {
    author: "owner",
    draft_text: text,
    // Only build the reference claims when the test did not supply its own.
    claims: overrides.claims ?? referenceClaims(text),
    grievances_addressed: [1, 2],
    pii_in_draft: [],
    ...overrides,
  };
}

export function sourceRef(text: string = REVIEW_TEXT, version = "v3"): SourceRef {
  return { review_id: "r_fixture_026", source_version: version, text_sha256: sha256(text) };
}

export function envelope<P>(
  handoffType: HandoffType,
  payload: P | null,
  overrides: Partial<HandoffEnvelope<P>> = {},
): HandoffEnvelope<P> {
  return {
    handoff_type: handoffType,
    contract_version: CONTRACT_VERSION,
    run_id: "run_fixture_0001",
    stage_id: handoffType,
    producer: { kind: "code", id: "fixture", model_version: null },
    produced_at: "2026-11-09T09:00:00Z",
    source_ref: sourceRef(),
    input_hashes: [],
    status: "ok",
    abstain: null,
    payload,
    ...overrides,
  };
}

export const EXPECT = {
  contractVersion: CONTRACT_VERSION,
  sourceRef: sourceRef(),
};
