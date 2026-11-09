// Context-dependent "hard reject" rules for each handoff (spec v0.5 §4.3).
// Each function returns issues; an empty list means the payload may pass.
// Pass these as the `semantic` argument of consumeHandoff().

import type {
  DraftProposal,
  EvidenceSpan,
  InterpretationResult,
  PolicyDecision,
  ReviewSnapshot,
  Span,
} from "@/lib/assurance/types";
import type { Issue } from "@/lib/assurance/schema";
import { GOOGLE_REPLY_MAX_BYTES, utf8Bytes } from "@/lib/assurance/length";
import { safetyTriggers } from "@/lib/assurance/lexical";

function spanIssue(span: Span, length: number, path: string): Issue | null {
  if (span.start >= span.end || span.end > length) {
    return {
      path,
      code: "span_out_of_bounds",
      message: `[${span.start}, ${span.end}) not inside text of length ${length}`,
    };
  }
  return null;
}

/** F-13: every quote must equal the review text at its offsets. */
function evidenceIssues(evidence: EvidenceSpan[], text: string, path: string): Issue[] {
  const issues: Issue[] = [];
  evidence.forEach((item, index) => {
    const at = `${path}[${index}]`;
    const bounds = spanIssue(item, text.length, at);
    if (bounds) {
      issues.push(bounds);
      return;
    }
    if (text.slice(item.start, item.end) !== item.quote) {
      issues.push({ path: `${at}.quote`, code: "evidence_mismatch", message: "quote is not the review text at these offsets" });
    }
  });
  return issues;
}

// ---------------------------------------------------------------- H0
export function checkReviewSnapshot(snapshot: ReviewSnapshot): Issue[] {
  const issues: Issue[] = [];
  snapshot.pii_spans.forEach((span, index) => {
    const bounds = spanIssue(span, snapshot.text.length, `payload.pii_spans[${index}]`);
    if (bounds) issues.push(bounds);
  });
  // Reviewer-profile fields (F-16) never get this far: the exact-key schema rejects them.
  return issues;
}

// ---------------------------------------------------------------- H1
export function checkInterpretation(result: InterpretationResult, snapshot: ReviewSnapshot): Issue[] {
  const issues: Issue[] = [];
  result.aspects.forEach((finding, index) => {
    const path = `payload.aspects[${index}].evidence`;
    if (finding.evidence.length === 0) {
      issues.push({ path, code: "unsupported_claim", message: "aspect finding without evidence" });
    }
    issues.push(...evidenceIssues(finding.evidence, snapshot.text, path));
  });
  result.allegations.forEach((allegation, index) => {
    const path = `payload.allegations[${index}].evidence`;
    if (allegation.evidence.length === 0) {
      issues.push({ path, code: "unsupported_claim", message: "allegation without evidence" });
    }
    issues.push(...evidenceIssues(allegation.evidence, snapshot.text, path));
  });
  if (result.primary_grievance && result.primary_grievance.aspect_index >= result.aspects.length) {
    issues.push({
      path: "payload.primary_grievance.aspect_index",
      code: "span_out_of_bounds",
      message: "points at an aspect that does not exist",
    });
  }
  return issues;
}

// ---------------------------------------------------------------- H2
export interface PolicyContext {
  interpretation: InterpretationResult;
  /** Remedy IDs in the recovery catalogue version the decision cites. */
  catalogueRemedyIds: string[];
  /** Fact IDs that exist in the approved facts store. */
  knownFactIds: string[];
  now: Date;
}

export function checkPolicyDecision(decision: PolicyDecision, ctx: PolicyContext): Issue[] {
  const issues: Issue[] = [];
  const hasAllegations = ctx.interpretation.allegations.length > 0;

  // F-23 / H-15: no humour while any allegation exists.
  if (hasAllegations && decision.tone.humour_allowed) {
    issues.push({ path: "payload.tone.humour_allowed", code: "policy_violation", message: "humour allowed while allegations exist" });
  }
  // F-11: an allegation always escalates.
  if (hasAllegations && decision.route === "draft") {
    issues.push({ path: "payload.route", code: "policy_violation", message: "allegations present but route is draft" });
  }
  decision.permitted_remedy_ids.forEach((id, index) => {
    if (!ctx.catalogueRemedyIds.includes(id)) {
      issues.push({
        path: `payload.permitted_remedy_ids[${index}]`,
        code: "unsupported_claim",
        message: `remedy ${id} not in the recovery catalogue`,
      });
    }
  });
  decision.allowed_facts.forEach((fact, index) => {
    const path = `payload.allowed_facts[${index}]`;
    if (!ctx.knownFactIds.includes(fact.fact_id)) {
      issues.push({ path, code: "unsupported_claim", message: `fact ${fact.fact_id} not in approved facts` });
    }
    if (fact.expires_at !== null && Date.parse(fact.expires_at) <= ctx.now.getTime()) {
      issues.push({ path: `${path}.expires_at`, code: "policy_violation", message: `fact ${fact.fact_id} has expired` });
    }
  });
  return issues;
}

/**
 * Deterministic route (Deterministic vs reasoning tab, §2 row 6).
 * The lexical safety trigger escalates on its own, so escalation never waits
 * on the model (H-14). A missing interpretation (model abstained) goes to the
 * human queue, never to drafting.
 */
export function decideRoute(
  reviewText: string,
  interpretation: InterpretationResult | null,
): { route: PolicyDecision["route"]; reasons: string[] } {
  const triggers = safetyTriggers(reviewText);
  const reasons = triggers.map((trigger) => `lexical:${trigger.code}:${trigger.keyword}`);
  if (interpretation) {
    reasons.push(...interpretation.allegations.map((allegation) => `allegation:${allegation.type}`));
  }
  if (reasons.length > 0) return { route: "escalate", reasons };
  if (!interpretation) return { route: "abstain", reasons: ["interpretation_unavailable"] };
  return { route: "draft", reasons: [] };
}

// ---------------------------------------------------------------- H3
export interface DraftContext {
  interpretation: InterpretationResult;
  policy: PolicyDecision;
}

/**
 * Structural rejects apply to every draft. Support rejects apply only to
 * model-written drafts (H-04): an owner's words are never bounced at the
 * handoff; their unsupported claims fail in assurance and get a post-it.
 */
export function checkDraftProposal(draft: DraftProposal, ctx: DraftContext): Issue[] {
  const issues: Issue[] = [];
  const bytes = utf8Bytes(draft.draft_text);
  if (bytes > GOOGLE_REPLY_MAX_BYTES) {
    issues.push({
      path: "payload.draft_text",
      code: "byte_cap_exceeded",
      message: `${bytes} UTF-8 bytes > ${GOOGLE_REPLY_MAX_BYTES}`,
    });
  }

  const aspectCount = ctx.interpretation.aspects.length;
  draft.claims.forEach((claim, index) => {
    const path = `payload.claims[${index}]`;
    const bounds = spanIssue(claim.span, draft.draft_text.length, `${path}.span`);
    if (bounds) issues.push(bounds);

    if (claim.kind === "acknowledgement" || claim.kind === "apology") {
      const aspectIndex = Number(claim.ref);
      if (claim.ref === null || !Number.isInteger(aspectIndex) || aspectIndex < 0 || aspectIndex >= aspectCount) {
        issues.push({ path: `${path}.ref`, code: "span_out_of_bounds", message: "must reference an H1 aspect index" });
      }
    }
    if (claim.kind === "acknowledgement" && claim.stance === null) {
      issues.push({ path: `${path}.stance`, code: "missing_field", message: "acknowledgement needs a stance" });
    }

    if (draft.author === "model") {
      const factIds = ctx.policy.allowed_facts.map((fact) => fact.fact_id);
      if ((claim.kind === "fact" || claim.kind === "dispute") && (claim.ref === null || !factIds.includes(claim.ref))) {
        issues.push({ path, code: "unsupported_claim", message: "model fact claim without an allowed fact_id" });
      }
      if (claim.kind === "remedy" && (claim.ref === null || !ctx.policy.permitted_remedy_ids.includes(claim.ref))) {
        issues.push({ path, code: "unsupported_claim", message: "model remedy claim without a permitted remedy_id" });
      }
    }
  });

  draft.grievances_addressed.forEach((aspectIndex, index) => {
    if (aspectIndex >= aspectCount) {
      issues.push({
        path: `payload.grievances_addressed[${index}]`,
        code: "span_out_of_bounds",
        message: "points at an aspect that does not exist",
      });
    }
  });
  draft.pii_in_draft.forEach((span, index) => {
    const bounds = spanIssue(span, draft.draft_text.length, `payload.pii_in_draft[${index}]`);
    if (bounds) issues.push(bounds);
  });
  return issues;
}
