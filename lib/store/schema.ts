import type {
  ApprovalStatus,
  AuditAction,
  ReasonCode,
  RecommendedAction,
  RemedyChannel,
  ReviewTheme,
  RiskLevel,
} from "@/lib/types";

/**
 * Runtime shape checks for the JSON store. A check returns null when the
 * value is valid, or a message naming the first bad path.
 *
 * Dependency-free on purpose (no zod): the checks are small, and this stage
 * avoids adding packages. Objects may carry extra keys, because the audit
 * schema grows additively and an older reader must still accept newer
 * records. Missing or mistyped known keys are rejected.
 */
export type Check = (value: unknown, at: string) => string | null;

const describe = (value: unknown) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

export const str: Check = (v, at) => (typeof v === "string" ? null : `${at}: expected string, got ${describe(v)}`);
export const num: Check = (v, at) =>
  typeof v === "number" && Number.isFinite(v) ? null : `${at}: expected number, got ${describe(v)}`;
export const bool: Check = (v, at) => (typeof v === "boolean" ? null : `${at}: expected boolean, got ${describe(v)}`);

/** Values from a `Record<Union, true>`, so a new union member that isn't listed fails the typecheck. */
export function oneOf<K extends string | number>(allowed: Record<K, true>): Check {
  const values = new Set(Object.keys(allowed));
  return (v, at) =>
    (typeof v === "string" || typeof v === "number") && values.has(String(v))
      ? null
      : `${at}: expected one of ${[...values].join(" | ")}, got ${JSON.stringify(v)}`;
}

export const optional = (check: Check): Check => (v, at) => (v === undefined ? null : check(v, at));
export const nullable = (check: Check): Check => (v, at) => (v === null ? null : check(v, at));

export function arrayOf(check: Check): Check {
  return (v, at) => {
    if (!Array.isArray(v)) return `${at}: expected array, got ${describe(v)}`;
    for (let i = 0; i < v.length; i++) {
      const problem = check(v[i], `${at}[${i}]`);
      if (problem) return problem;
    }
    return null;
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function recordOf(check: Check): Check {
  return (v, at) => {
    if (!isPlainObject(v)) return `${at}: expected object, got ${describe(v)}`;
    for (const [key, value] of Object.entries(v)) {
      const problem = check(value, `${at}.${key}`);
      if (problem) return problem;
    }
    return null;
  };
}

export function object(shape: Record<string, Check>): Check {
  return (v, at) => {
    if (!isPlainObject(v)) return `${at}: expected object, got ${describe(v)}`;
    for (const [key, check] of Object.entries(shape)) {
      const problem = check(v[key], `${at}.${key}`);
      if (problem) return problem;
    }
    return null;
  };
}

/** A keyed map whose keys must match an id field on each value ({ [review.id]: review }). */
function keyedBy(field: string, check: Check): Check {
  const values = recordOf(check);
  return (v, at) => {
    const problem = values(v, at);
    if (problem) return problem;
    for (const [key, value] of Object.entries(v as Record<string, Record<string, unknown>>)) {
      if (value[field] !== key) return `${at}.${key}.${field}: does not match its key`;
    }
    return null;
  };
}

// Exhaustive value lists. Adding a member to a union in lib/types.ts without
// adding it here is a compile error, not a runtime surprise.
const STARS: Record<1 | 2 | 3 | 4 | 5, true> = { 1: true, 2: true, 3: true, 4: true, 5: true };
const RISK: Record<RiskLevel, true> = { low: true, medium: true, high: true };
const ACTION: Record<RecommendedAction, true> = { quick_approve: true, needs_review: true };
const THEME: Record<ReviewTheme, true> = { food: true, service: true, atmosphere: true };
const REASON: Record<ReasonCode, true> = {
  positive_no_complaint: true,
  neutral_mixed_sentiment: true,
  negative_issue: true,
  unreadable_language: true,
  unconfirmed_praise: true,
  sensitive_safety: true,
  sensitive_legal: true,
  sensitive_discrimination: true,
  sensitive_medical: true,
  sensitive_fraud: true,
  sensitive_compensation: true,
};
const STATUS: Record<ApprovalStatus, true> = {
  pending: true,
  approved: true,
  edited_approved: true,
  no_response_required: true,
  rejected: true,
  publishing: true,
  publish_failed: true,
  publish_unknown: true,
};
const AUDIT_ACTION: Record<AuditAction, true> = {
  approved_published: true,
  no_response_required: true,
  rejected: true,
  pending_approval: true,
  publish_requested: true,
  publish_failed: true,
  publish_unknown: true,
  publish_reconciled: true,
  publish_not_published: true,
  remedy_recorded: true,
};
const CHANNEL: Record<RemedyChannel, true> = { email: true, whatsapp: true, phone: true, in_person: true };

export const reviewCheck = object({
  id: str,
  locationId: str,
  author: str,
  stars: oneOf(STARS),
  text: str,
  createTime: str,
  updateTime: str,
  language: optional(str),
});

export const triageCheck = object({
  reviewId: str,
  policyVersion: str,
  riskLevel: oneOf(RISK),
  reasonCodes: arrayOf(oneOf(REASON)),
  recommendedAction: oneOf(ACTION),
  sensitive: bool,
  themes: arrayOf(oneOf(THEME)),
  confidence: num,
  matchedKeywords: arrayOf(str),
  computedAt: str,
  shadow: optional(object({ rule: str, wouldAutoSend: bool })),
});

export const draftCheck = object({
  reviewId: str,
  text: str,
  factsUsed: arrayOf(str),
  templateId: str,
  generatedAt: str,
  sourceVersion: optional(str),
  factsVersion: optional(str),
});

export const approvalCheck = object({
  reviewId: str,
  status: oneOf(STATUS),
  actor: str,
  finalText: optional(str),
  attemptId: optional(str),
  contextVersion: optional(str),
  validationVersion: optional(str),
  confirmedAt: optional(str),
  decidedAt: optional(str),
  reason: optional(str),
  remedy: optional(object({ note: str, channel: oneOf(CHANNEL), recordedBy: str, recordedAt: str })),
});

const outcomeCheck = object({
  success: bool,
  providerReplyId: optional(str),
  publishedAt: optional(str),
  error: optional(str),
});

export const auditRecordCheck = object({
  id: str,
  reviewId: str,
  locationId: str,
  policyVersion: str,
  sourceCreateTime: str,
  sourceUpdateTime: str,
  evidence: object({ stars: num, text: str, matchedKeywords: arrayOf(str) }),
  triage: triageCheck,
  draft: draftCheck,
  approval: approvalCheck,
  action: oneOf(AUDIT_ACTION),
  actor: str,
  outcome: nullable(outcomeCheck),
  recordedAt: str,
});

export const locationCheck = nullable(
  object({ locationId: str, connected: bool, lastSuccessfulScanAt: nullable(str) }),
);

export const reviewMapCheck = keyedBy("id", reviewCheck);
export const triageMapCheck = keyedBy("reviewId", triageCheck);
export const draftMapCheck = keyedBy("reviewId", draftCheck);
export const approvalMapCheck = keyedBy("reviewId", approvalCheck);
export const auditLogCheck = arrayOf(auditRecordCheck);
