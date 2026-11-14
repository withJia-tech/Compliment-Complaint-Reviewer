// Response assurance (spec v0.5 §7–8; H4). Runs the code-decided checks over
// a draft that already passed the H3 handoff, then builds the report the
// human approver sees. Model-scored rubric dimensions are out of scope here:
// this file only decides what code can decide.

import type {
  AssuranceCheck,
  AssuranceReport,
  CheckResult,
  DraftProposal,
  InterpretationResult,
  Liberty,
  PolicyDecision,
  ReviewSnapshot,
  Span,
} from "@/lib/assurance/types";
import { sha256 } from "@/lib/assurance/hash";
import { checkLengthBand, PROPOSED_LENGTH_BAND, type LengthBandParams } from "@/lib/assurance/length";
import { promiseMatches } from "@/lib/assurance/lexical";
import { selectPostIts } from "@/lib/assurance/postits";

export interface AssuranceInput {
  snapshot: ReviewSnapshot;
  interpretation: InterpretationResult;
  policy: PolicyDecision;
  draft: DraftProposal;
  /** Corrective-action IDs actually recorded on the linked incident (H-03). */
  recordedActionIds: string[];
  /** The approver has recorded an explicit decision to keep flagged personal data (F-30). */
  piiDecisionRecorded?: boolean;
  lengthParams?: LengthBandParams;
}

const check = (
  check_id: string,
  test_ref: string,
  result: CheckResult,
  detail: string,
  aspect_index: number | null = null,
): AssuranceCheck => ({ check_id, test_ref, result, detail, aspect_index });

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

function claimAspect(ref: string | null): number | null {
  if (ref === null) return null;
  const index = Number(ref);
  return Number.isInteger(index) ? index : null;
}

export function runAssurance(input: AssuranceInput): AssuranceReport {
  const { snapshot, interpretation, policy, draft } = input;
  const checks: AssuranceCheck[] = [];
  const aspects = interpretation.aspects;
  const addressed = new Set(draft.grievances_addressed);
  const acknowledgements = draft.claims.filter((claim) => claim.kind === "acknowledgement");

  // F-05: the primary grievance must be addressed.
  const primary = interpretation.primary_grievance?.aspect_index ?? null;
  if (primary === null) {
    checks.push(check("C-COVERAGE", "F-05", "pass", "no primary grievance identified"));
  } else if (addressed.has(primary)) {
    checks.push(check("C-COVERAGE", "F-05", "pass", "primary grievance addressed", primary));
  } else {
    checks.push(check("C-COVERAGE", "F-05", "fail", "primary grievance not addressed", primary));
  }

  // F-04: other material aspects preserved (warn, not block).
  let aspectFindings = 0;
  aspects.forEach((finding, index) => {
    if (index === primary) return;
    const acknowledged = (stance: "praise" | "concern") =>
      acknowledgements.some((claim) => claimAspect(claim.ref) === index && claim.stance === stance);
    if ((finding.polarity === "negative" || finding.polarity === "mixed") && !addressed.has(index) && !acknowledged("concern")) {
      checks.push(check("C-ASPECTS", "F-04", "warn", `${finding.aspect} concern not acknowledged`, index));
      aspectFindings++;
    }
    if (finding.polarity === "positive" && !acknowledged("praise")) {
      checks.push(check("C-ASPECTS", "F-04", "warn", `${finding.aspect} praise not preserved`, index));
      aspectFindings++;
    }
  });
  if (aspectFindings === 0) checks.push(check("C-ASPECTS", "F-04", "pass", "material aspects preserved"));

  // F-06 / H-01: praise acknowledged on an aspect the review criticised.
  let falsePraise = 0;
  for (const claim of acknowledgements) {
    const index = claimAspect(claim.ref);
    if (index === null || claim.stance !== "praise") continue;
    const polarity = aspects[index]?.polarity;
    if (polarity === "negative") {
      checks.push(check("C-FALSE-PRAISE", "F-06", "fail", `praises ${aspects[index].aspect}, which the review criticised`, index));
      falsePraise++;
    } else if (polarity === "mixed") {
      checks.push(check("C-FALSE-PRAISE", "F-06", "warn", `praises ${aspects[index].aspect}, which the review was mixed on`, index));
      falsePraise++;
    }
  }
  if (falsePraise === 0) checks.push(check("C-FALSE-PRAISE", "F-06", "pass", "no praise contradicts the review"));

  // F-09 / F-24: factual and dispute statements need an allowed fact.
  const allowedFacts = new Set(policy.allowed_facts.map((fact) => fact.fact_id));
  const unsupportedFacts = draft.claims.filter(
    (claim) => (claim.kind === "fact" || claim.kind === "dispute") && (claim.ref === null || !allowedFacts.has(claim.ref)),
  );
  checks.push(
    unsupportedFacts.length > 0
      ? check("C-FACT-SUPPORT", "F-09", "fail", `${unsupportedFacts.length} statement(s) without an approved fact`)
      : check("C-FACT-SUPPORT", "F-09", "pass", "every factual statement is supported"),
  );

  // F-08 / H-04: remedies only from the permitted catalogue entries.
  const permitted = new Set(policy.permitted_remedy_ids);
  const unauthorised = draft.claims.filter(
    (claim) => claim.kind === "remedy" && (claim.ref === null || !permitted.has(claim.ref)),
  );
  checks.push(
    unauthorised.length > 0
      ? check("C-REMEDY", "F-08", "fail", `${unauthorised.length} remedy promise(s) not authorised`)
      : check("C-REMEDY", "F-08", "pass", "no unauthorised remedy"),
  );

  // H-03: "we investigated" needs a recorded action.
  const recorded = new Set(input.recordedActionIds);
  const unrecorded = draft.claims.filter(
    (claim) => claim.kind === "action" && (claim.ref === null || !recorded.has(claim.ref)),
  );
  checks.push(
    unrecorded.length > 0
      ? check("C-ACTION", "H-03", "fail", `${unrecorded.length} action claim(s) with no recorded action`)
      : check("C-ACTION", "H-03", "pass", "every action claim is recorded"),
  );

  // Lexical second net: promise wording that extraction did not tag.
  const tagged = draft.claims.filter((claim) => claim.kind === "remedy" || claim.kind === "action").map((claim) => claim.span);
  const untagged = promiseMatches(draft.draft_text).filter((match) => !tagged.some((span) => overlaps(span, match)));
  checks.push(
    untagged.length > 0
      ? check("C-PROMISE-NET", "F-08", "warn", `possible promise not extracted: ${untagged.map((m) => `"${m.text}"`).join(", ")}`)
      : check("C-PROMISE-NET", "F-08", "pass", "no untagged promise wording"),
  );

  // F-30: personal data from the review, or flagged in the draft.
  const draftLower = draft.draft_text.toLowerCase();
  const leaked = snapshot.pii_spans.filter((span) => {
    const value = snapshot.text.slice(span.start, span.end).trim().toLowerCase();
    return value.length > 0 && draftLower.includes(value);
  });
  const piiCount = leaked.length + draft.pii_in_draft.length;
  if (piiCount === 0) {
    checks.push(check("C-PII", "F-30", "pass", "no personal data in draft"));
  } else {
    checks.push(
      check(
        "C-PII",
        "F-30",
        input.piiDecisionRecorded ? "warn" : "fail",
        input.piiDecisionRecorded
          ? `${piiCount} personal detail(s) kept by recorded approver decision`
          : `${piiCount} personal detail(s) in draft`,
      ),
    );
  }

  // F-23: no humour while allegations exist (also enforced at H2).
  checks.push(
    interpretation.allegations.length > 0 && policy.tone.humour_allowed
      ? check("C-HUMOUR", "F-23", "fail", "humour allowed on a case with allegations")
      : check("C-HUMOUR", "F-23", "pass", "tone rule respected"),
  );

  // F-31 / F-33: byte cap blocks; the length band only coaches.
  const band = checkLengthBand(
    snapshot.text,
    draft.draft_text,
    snapshot.language_tag,
    policy.route === "escalate",
    input.lengthParams ?? PROPOSED_LENGTH_BAND,
  );
  if (band.hardCapExceeded) {
    checks.push(check("C-LENGTH", "F-31", "fail", `${band.bytes} bytes exceeds the platform cap`));
  } else if (band.status !== "within") {
    checks.push(
      check("C-LENGTH", "F-33", "warn", `${band.replyUnits} ${band.unit}; expected ${band.minUnits}–${band.maxUnits}`),
    );
  } else {
    checks.push(check("C-LENGTH", "F-33", "pass", `${band.replyUnits} ${band.unit} within band`));
  }

  const { coverage, liberties } = findLiberties(draft);
  const blockers = [...new Set(checks.filter((c) => c.result === "fail").map((c) => c.check_id))];

  return {
    checks,
    overall: blockers.length > 0 ? "blocked" : "ready_for_review",
    blockers,
    draft_sha256: sha256(draft.draft_text),
    claim_coverage: coverage,
    liberties,
    post_its: selectPostIts(checks, interpretation),
  };
}

/**
 * Creativity log, deterministic pass (spec §8.2 step 1): any stretch of the
 * draft not covered by a claim span is a candidate liberty. A classifier may
 * assign its type later; until then it is "unclassified" and shown for review.
 */
export function findLiberties(draft: DraftProposal): { coverage: number; liberties: Liberty[] } {
  const text = draft.draft_text;
  const covered = new Array<boolean>(text.length).fill(false);
  for (const claim of draft.claims) {
    for (let i = Math.max(0, claim.span.start); i < Math.min(text.length, claim.span.end); i++) covered[i] = true;
  }

  let meaningful = 0;
  let meaningfulCovered = 0;
  const liberties: Liberty[] = [];
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart < 0) return;
    const segment = text.slice(runStart, end);
    // Ignore runs that are only whitespace, punctuation or a stray word.
    if ((segment.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3) {
      liberties.push({
        type: "unclassified",
        span: { start: runStart, end },
        source_gap: "no_evidence",
        severity: "review",
        declared_by_model: false,
      });
    }
    runStart = -1;
  };

  for (let i = 0; i < text.length; i++) {
    const isContent = /[\p{L}\p{N}]/u.test(text[i]);
    if (isContent) {
      meaningful++;
      if (covered[i]) meaningfulCovered++;
    }
    if (!covered[i]) {
      if (runStart < 0 && isContent) runStart = i;
    } else {
      flush(i);
    }
  }
  flush(text.length);

  return { coverage: meaningful === 0 ? 1 : meaningfulCovered / meaningful, liberties };
}
