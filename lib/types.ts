// Core domain types shared by every layer of the prototype: providers,
// triage, drafting, approval, and the audit trail. Kept provider-agnostic so
// a real Google Business Profile integration can produce/consume the same
// shapes without redesigning callers.

export interface Review {
  id: string;
  locationId: string;
  author: string;
  stars: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** ISO 8601 */
  createTime: string;
  /** ISO 8601 — used for "new or updated since last scan" filtering */
  updateTime: string;
  language?: string;
}

export interface ApprovedBusinessFact {
  key: string;
  category: "identity" | "hours" | "policy" | "contact" | "amenity";
  value: string;
  notes?: string;
}

export interface ApprovedBusinessFacts {
  locationId: string;
  businessName: string;
  facts: ApprovedBusinessFact[];
}

/**
 * Three levels only. A one-person team or an agency managing businesses has
 * nobody to escalate *to*, so sensitive claims are high risk flagged
 * `sensitive` rather than a separate fourth tier.
 */
export type RiskLevel = "low" | "medium" | "high";

export type ReasonCode =
  | "positive_no_complaint"
  | "neutral_mixed_sentiment"
  | "negative_issue"
  | "sensitive_safety"
  | "sensitive_legal"
  | "sensitive_discrimination"
  | "sensitive_medical"
  | "sensitive_fraud"
  | "sensitive_compensation"
  // Added in policy v1.1.0 (additive only).
  /** Instructions aimed at the system rather than the business, e.g. "ignore previous instructions". */
  | "sensitive_prompt_injection"
  /** The review contains a phone number, email, address, card or order number, or names a person. */
  | "personal_info"
  /** The review contains a link. */
  | "contains_link"
  /** Gibberish, or a script the keyword rules cannot read and no reader was available. */
  | "unreadable"
  /** The second reader found a complaint the keyword rules missed. */
  | "reader_concern"
  /** A second reader was configured but could not read this review, so it fails closed. */
  | "reader_failed";

/**
 * How much attention the owner should give a review. Nothing is ever sent
 * automatically — every reply is sent by the owner — so this only says how
 * quickly it can be cleared.
 *
 * `quick_approve`: low risk; the draft can usually be sent as-is in one click.
 * `needs_review`: read the review and the draft before deciding.
 */
export type RecommendedAction = "quick_approve" | "needs_review";

/**
 * Feedback themes, aligned with the Food / Service / Atmosphere sub-ratings
 * Google Business Profile already collects, so weekly and monthly rollups
 * line up with what the owner sees in Google.
 */
export type ReviewTheme = "food" | "service" | "atmosphere";

export interface TriageResult {
  reviewId: string;
  policyVersion: string;
  riskLevel: RiskLevel;
  reasonCodes: ReasonCode[];
  recommendedAction: RecommendedAction;
  /**
   * True for safety, legal, discrimination, medical, fraud, or compensation
   * claims. Always needs the owner's personal attention, whatever the star
   * rating, and is the class any future auto-send must exclude.
   */
  sensitive: boolean;
  themes: ReviewTheme[];
  /** 0..1 heuristic confidence, not a calibrated probability */
  confidence: number;
  /** Evidence trail: which keywords drove this classification */
  matchedKeywords: string[];
  computedAt: string;
  /**
   * What the optional second reader (a language model) concluded. Absent when
   * no reader is configured. The reader can only raise attention, never lower it.
   */
  reading?: TriageReading;
}

export interface TriageReading {
  readerId: string;
  language: string;
  concern: "none" | "complaint" | "sensitive";
  category: string;
  containsPersonalInfo: boolean;
  /** One sentence, in English, explaining the reading. */
  rationale: string;
}

export interface Draft {
  reviewId: string;
  text: string;
  /** ApprovedBusinessFact.key values actually cited in `text` */
  factsUsed: string[];
  templateId: string;
  generatedAt: string;
  /** Pinned inputs; legacy drafts must be regenerated before sending. */
  sourceVersion?: string;
  factsVersion?: string;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "edited_approved"
  | "no_response_required"
  | "rejected"
  | "publishing"
  | "publish_failed"
  | "publish_unknown";

/**
 * Channels a goodwill remedy is settled through. These are deliberately
 * OUTSIDE this application: the app records that a remedy was offered so the
 * audit trail is complete, but never sends a voucher, and never mentions one
 * in the public reply text.
 */
export type RemedyChannel = "email" | "whatsapp" | "phone" | "in_person";

export interface RemedyNote {
  /** Free-text internal note, e.g. "offered a £10 voucher". Never published. */
  note: string;
  channel: RemedyChannel;
  recordedBy: string;
  recordedAt: string;
}

export interface Approval {
  reviewId: string;
  status: ApprovalStatus;
  actor: string;
  finalText?: string;
  attemptId?: string;
  contextVersion?: string;
  validationVersion?: string;
  confirmedAt?: string;
  decidedAt?: string;
  reason?: string;
  /** Internal-only record of an out-of-band goodwill remedy. Never published. */
  remedy?: RemedyNote;
}

export interface ProviderPublishResult {
  success: boolean;
  providerReplyId?: string;
  publishedAt?: string;
  error?: string;
}

export type AuditAction =
  | "approved_published"
  | "no_response_required"
  | "rejected"
  | "pending_approval"
  | "publish_requested"
  | "publish_failed"
  | "publish_unknown"
  | "publish_reconciled"
  | "publish_not_published"
  /** An out-of-band goodwill remedy was noted. Nothing was published. */
  | "remedy_recorded";

export interface AuditRecord {
  id: string;
  reviewId: string;
  locationId: string;
  policyVersion: string;
  sourceCreateTime: string;
  sourceUpdateTime: string;
  evidence: {
    stars: number;
    text: string;
    matchedKeywords: string[];
  };
  triage: TriageResult;
  draft: Draft;
  approval: Approval;
  action: AuditAction;
  actor: string;
  outcome: ProviderPublishResult | null;
  recordedAt: string;
}

export interface LocationSettings {
  locationId: string;
  connected: boolean;
  lastSuccessfulScanAt: string | null;
}

export const DEFAULT_LOCATION_ID = "loc_001";
export const STUB_OWNER_ACTOR = "business-owner";

/** Provider must prove non-publication before permitting retry. A missing reply alone is insufficient. */
export type PublishReconciliation =
  | {
      status: "published";
      text: string;
      providerReplyId: string;
      publishedAt: string;
    }
  | { status: "not_published" }
  | { status: "unknown" };
