// Contract types for the response-assurance pipeline
// (Failure Modes, Tool Contracts and Validation — spec v0.5, §4).
//
// Every stage hands the next a typed, versioned envelope. Consumers reject
// anything malformed instead of repairing it. Field names are snake_case to
// match the published contract documents, not the app's camelCase types.

export const CONTRACT_VERSION = "0.5";

export type HandoffType =
  | "review_snapshot" // H0
  | "interpretation_result" // H1
  | "policy_decision" // H2
  | "draft_proposal" // H3
  | "assurance_report" // H4
  | "approval_record"; // H5

export type ProducerKind = "model" | "code" | "human";

export type AbstainReasonCode =
  | "model_timeout"
  | "invalid_schema"
  | "evidence_mismatch"
  | "stale_source"
  | "facts_unavailable"
  | "ambiguous_interpretation"
  | "unsupported_language"
  | "budget_exceeded";

export const ABSTAIN_REASON_CODES: readonly AbstainReasonCode[] = [
  "model_timeout",
  "invalid_schema",
  "evidence_mismatch",
  "stale_source",
  "facts_unavailable",
  "ambiguous_interpretation",
  "unsupported_language",
  "budget_exceeded",
];

export interface SourceRef {
  review_id: string;
  source_version: string;
  text_sha256: string;
}

export interface Producer {
  kind: ProducerKind;
  id: string;
  model_version: string | null;
}

export interface Abstain {
  reason_code: AbstainReasonCode;
  detail: string;
}

export interface HandoffEnvelope<P> {
  handoff_type: HandoffType;
  contract_version: string;
  run_id: string;
  stage_id: string;
  producer: Producer;
  produced_at: string;
  source_ref: SourceRef;
  input_hashes: string[];
  status: "ok" | "abstain";
  abstain: Abstain | null;
  payload: P | null;
}

export interface Span {
  start: number;
  end: number;
}

export interface EvidenceSpan extends Span {
  quote: string;
}

export type PiiKind = "person_name" | "phone" | "email" | "booking_ref" | "other";

export interface PiiSpan extends Span {
  kind: PiiKind;
}

// ---------------------------------------------------------------- H0
/** Source adapter → Interpretation. Carries no reviewer-profile fields by design. */
export interface ReviewSnapshot {
  text: string;
  overall_rating: 1 | 2 | 3 | 4 | 5;
  aspect_ratings: {
    food: number | null;
    service: number | null;
    atmosphere: number | null;
  };
  /** BCP-47, set by code. Used for evaluation slices and abstain only — never route or tone. */
  language_tag: string;
  pii_spans: PiiSpan[];
}

// ---------------------------------------------------------------- H1
export type Aspect =
  | "food"
  | "service"
  | "atmosphere"
  | "value"
  | "cleanliness"
  | "wait_time"
  | "other";

export type Polarity = "positive" | "negative" | "mixed" | "neutral";

export type AllegationType =
  | "allergen_exposure"
  | "illness"
  | "contamination"
  | "injury"
  | "discrimination"
  | "other_safety";

export interface AspectFinding {
  aspect: Aspect;
  polarity: Polarity;
  evidence: EvidenceSpan[];
}

export interface Allegation {
  type: AllegationType;
  attribution: "reviewer_asserted";
  evidence: EvidenceSpan[];
}

/** Interpretation → Policy. */
export interface InterpretationResult {
  aspects: AspectFinding[];
  primary_grievance: { aspect_index: number } | null;
  rating_text_consistency: "consistent" | "contradicts" | "unclear";
  allegations: Allegation[];
  dietary_preferences: string[];
  sarcasm: "none" | "suspected";
  injection_text_present: boolean;
}

// ---------------------------------------------------------------- H2
export interface AllowedFact {
  fact_id: string;
  facts_version: string;
  expires_at: string | null;
}

/** Policy (code) → Drafting. */
export interface PolicyDecision {
  route: "draft" | "escalate" | "abstain";
  escalation_codes: string[];
  permitted_remedy_ids: string[];
  allowed_facts: AllowedFact[];
  tone: { humour_allowed: boolean; register: "formal" | "warm" | "brisk" };
  policy_version: string;
  brand_version: string;
}

// ---------------------------------------------------------------- H3
export type ClaimKind = "fact" | "remedy" | "acknowledgement" | "apology" | "dispute" | "action";

export interface Claim {
  span: Span;
  kind: ClaimKind;
  /**
   * fact / dispute → fact_id; remedy → remedy_id; action → incident action id;
   * acknowledgement / apology → H1 aspect index as a decimal string.
   */
  ref: string | null;
  /** Required for acknowledgement claims: is the draft praising or recognising a concern? */
  stance: "praise" | "concern" | null;
}

/** Drafting (model) or owner → Response assurance. */
export interface DraftProposal {
  author: "model" | "owner";
  draft_text: string;
  claims: Claim[];
  /** H1 aspect indexes the draft addresses. */
  grievances_addressed: number[];
  pii_in_draft: Span[];
}

// ---------------------------------------------------------------- H4
export type CheckResult = "pass" | "fail" | "warn";

export interface AssuranceCheck {
  check_id: string;
  /** Failure-matrix test this check enforces, e.g. "F-06". */
  test_ref: string;
  result: CheckResult;
  detail: string;
  /** H1 aspect index the finding concerns, when there is one (post-it tie-break). */
  aspect_index: number | null;
}

export type LibertyType =
  | "added_detail"
  | "inferred_cause"
  | "soft_commitment"
  | "stance_shift"
  | "omission"
  | "tone_shift"
  | "inferred_emotion"
  | "template_phrase"
  | "reorder"
  /** Detected by code as unsupported; type not yet assigned by a classifier. */
  | "unclassified";

export interface Liberty {
  type: LibertyType;
  span: Span;
  source_gap: "no_fact" | "no_evidence" | "no_remedy" | "not_in_owner_draft";
  severity: "benign" | "review" | "hard_fail";
  declared_by_model: boolean;
}

export interface PostIt {
  id: string;
  check_id: string;
  severity: number;
  text: string;
}

/** Response assurance → Human approver. */
export interface AssuranceReport {
  checks: AssuranceCheck[];
  overall: "ready_for_review" | "blocked";
  blockers: string[];
  draft_sha256: string;
  /** Share of draft characters covered by a claim span, 0..1. */
  claim_coverage: number;
  liberties: Liberty[];
  post_its: PostIt[];
}

// ---------------------------------------------------------------- H5
/** Human approver → audit log. Publishing is future scope. */
export interface ApprovalRecord {
  approver_id: string;
  decision: "approve" | "edit_and_approve" | "reject";
  final_draft_sha256: string;
  source_version: string;
  approved_at: string;
}
