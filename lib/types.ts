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

export type RiskLevel = "low" | "medium" | "high" | "escalate";

export type ReasonCode =
  | "positive_no_complaint"
  | "neutral_mixed_sentiment"
  | "negative_issue"
  | "escalation_safety"
  | "escalation_legal"
  | "escalation_discrimination"
  | "escalation_medical"
  | "escalation_fraud"
  | "escalation_compensation";

export type RecommendedAction =
  | "auto_publish_eligible"
  | "approval_required"
  | "escalate_never_auto";

export interface TriageResult {
  reviewId: string;
  policyVersion: string;
  riskLevel: RiskLevel;
  reasonCodes: ReasonCode[];
  recommendedAction: RecommendedAction;
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

export interface Approval {
  reviewId: string;
  status: ApprovalStatus;
  actor: string;
  finalText?: string;
  decidedAt?: string;
  reason?: string;
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
