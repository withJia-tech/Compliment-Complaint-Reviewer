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
  | "sensitive_compensation";

export type RecommendedAction = "auto_publish_eligible" | "approval_required";

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
   * claims. Always blocks automatic publishing, independent of star rating.
   */
  sensitive: boolean;
  themes: ReviewTheme[];
  /** 0..1 heuristic confidence, not a calibrated probability */
  confidence: number;
  /** Evidence trail: which keywords drove this classification */
  matchedKeywords: string[];
  computedAt: string;
}

export interface Draft {
  reviewId: string;
  text: string;
  /** ApprovedBusinessFact.key values actually cited in `text` */
  factsUsed: string[];
  templateId: string;
  generatedAt: string;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "edited_approved"
  | "rejected"
  | "auto_published";

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
  | "auto_published"
  | "approved_published"
  | "rejected"
  | "pending_approval";

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
  autoPublishConsent: boolean;
  lastSuccessfulScanAt: string | null;
}

export const DEFAULT_LOCATION_ID = "loc_001";
export const STUB_OWNER_ACTOR = "business-owner";
