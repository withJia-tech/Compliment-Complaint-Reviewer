import { describe, expect, it } from "vitest";
import { consumeHandoff } from "@/lib/assurance/envelope";
import {
  draftProposalSchema,
  interpretationSchema,
  policyDecisionSchema,
  reviewSnapshotSchema,
} from "@/lib/assurance/payloadSchemas";
import {
  checkDraftProposal,
  checkInterpretation,
  checkPolicyDecision,
  checkReviewSnapshot,
  decideRoute,
} from "@/lib/assurance/handoffs";
import type { DraftProposal, InterpretationResult, PolicyDecision, ReviewSnapshot } from "@/lib/assurance/types";
import {
  EXPECT,
  REVIEW_TEXT,
  claim,
  envelope,
  evidence,
  goodDraft,
  interpretation,
  policy,
  snapshot,
  sourceRef,
} from "@/lib/__tests__/helpers/assuranceFixtures";

const H0 = { ...EXPECT, handoffType: "review_snapshot" as const };
const H1 = { ...EXPECT, handoffType: "interpretation_result" as const };
const H2 = { ...EXPECT, handoffType: "policy_decision" as const };
const H3 = { ...EXPECT, handoffType: "draft_proposal" as const };

const policyCtx = (interp: InterpretationResult) => ({
  interpretation: interp,
  catalogueRemedyIds: ["R-REVISIT-NOTE"],
  knownFactIds: ["F-PRICING"],
  now: new Date("2026-11-09T09:00:00Z"),
});

describe("handoff envelope — consumer rules", () => {
  it("accepts a well-formed H0 snapshot", () => {
    const verdict = consumeHandoff<ReviewSnapshot>(envelope("review_snapshot", snapshot()), H0, reviewSnapshotSchema, checkReviewSnapshot);
    expect(verdict.kind).toBe("accepted");
  });

  it("F-14: rejects an unknown envelope field (rule 1)", () => {
    const raw = { ...envelope("review_snapshot", snapshot()), extra: "x" };
    const verdict = consumeHandoff(raw, H0, reviewSnapshotSchema);
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") {
      expect(verdict.rule).toBe(1);
      expect(verdict.issues[0].code).toBe("unknown_field");
    }
  });

  it("F-14: rejects an unknown payload field (rule 5)", () => {
    const raw = envelope("review_snapshot", { ...snapshot(), sentiment_score: 0.2 });
    const verdict = consumeHandoff(raw, H0, reviewSnapshotSchema);
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") expect(verdict.issues.map((i) => i.code)).toContain("unknown_field");
  });

  it("F-16: rejects reviewer-profile fields at H0", () => {
    const raw = envelope("review_snapshot", { ...snapshot(), reviewer_name: "A. Guest", local_guide_level: 7 });
    const verdict = consumeHandoff(raw, H0, reviewSnapshotSchema);
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") {
      expect(verdict.issues.map((i) => i.path)).toEqual(["payload.reviewer_name", "payload.local_guide_level"]);
    }
  });

  it("rejects a missing required field without filling a default", () => {
    const { language_tag: _omitted, ...rest } = snapshot();
    const verdict = consumeHandoff(envelope("review_snapshot", rest), H0, reviewSnapshotSchema);
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") expect(verdict.issues[0].code).toBe("missing_field");
  });

  it("rejects a contract version mismatch (rule 2)", () => {
    const raw = envelope("review_snapshot", snapshot(), { contract_version: "0.4" });
    const verdict = consumeHandoff(raw, H0, reviewSnapshotSchema);
    expect(verdict.kind === "rejected" && verdict.rule).toBe(2);
  });

  it("F-15: rejects a handoff bound to another source version (rule 3)", () => {
    const raw = envelope("review_snapshot", snapshot(), { source_ref: sourceRef(REVIEW_TEXT, "v2") });
    const verdict = consumeHandoff(raw, H0, reviewSnapshotSchema);
    expect(verdict.kind === "rejected" && verdict.rule).toBe(3);
  });

  it("F-20: routes a well-formed abstain to the human queue", () => {
    const raw = envelope("interpretation_result", null, {
      status: "abstain",
      abstain: { reason_code: "model_timeout", detail: "provider timed out" },
    });
    const verdict = consumeHandoff(raw, H1, interpretationSchema);
    expect(verdict.kind).toBe("abstained");
  });

  it("rejects an abstain that still carries a payload (rule 4)", () => {
    const raw = envelope("interpretation_result", interpretation(), {
      status: "abstain",
      abstain: { reason_code: "ambiguous_interpretation", detail: "" },
    });
    const verdict = consumeHandoff(raw, H1, interpretationSchema);
    expect(verdict.kind === "rejected" && verdict.rule).toBe(4);
  });

  it("rejects an unknown abstain reason code", () => {
    const raw = envelope("interpretation_result", null, {
      status: "abstain",
      abstain: { reason_code: "felt_unsure" as never, detail: "" },
    });
    expect(consumeHandoff(raw, H1, interpretationSchema).kind).toBe("rejected");
  });
});

describe("H1 interpretation — semantic rules", () => {
  const consume = (interp: InterpretationResult) =>
    consumeHandoff<InterpretationResult>(envelope("interpretation_result", interp), H1, interpretationSchema, (p) =>
      checkInterpretation(p, snapshot()),
    );

  it("accepts evidence that matches the review text exactly", () => {
    expect(consume(interpretation()).kind).toBe("accepted");
  });

  it("F-13: rejects a quote that is not in the review at its offsets", () => {
    const interp = interpretation();
    interp.aspects[2].evidence = [{ ...interp.aspects[2].evidence[0], quote: "coffee was cold" }];
    const verdict = consume(interp);
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") expect(verdict.issues[0].code).toBe("evidence_mismatch");
  });

  it("F-09: rejects an allegation attributed to anyone but the reviewer", () => {
    const interp = interpretation({
      allegations: [{ type: "illness", attribution: "kitchen_confirmed" as never, evidence: [evidence(REVIEW_TEXT, "coffee too acidic")] }],
    });
    expect(consume(interp).kind).toBe("rejected");
  });

  it("rejects an allegation with no evidence", () => {
    const interp = interpretation({ allegations: [{ type: "illness", attribution: "reviewer_asserted", evidence: [] }] });
    expect(consume(interp).kind).toBe("rejected");
  });
});

describe("H2 policy decision — semantic rules", () => {
  const withAllegation = interpretation({
    allegations: [{ type: "illness", attribution: "reviewer_asserted", evidence: [evidence(REVIEW_TEXT, "coffee too acidic")] }],
  });
  const consume = (decision: PolicyDecision, interp = interpretation()) =>
    consumeHandoff<PolicyDecision>(envelope("policy_decision", decision), H2, policyDecisionSchema, (p) =>
      checkPolicyDecision(p, policyCtx(interp)),
    );

  it("accepts a draft route with catalogue remedies and live facts", () => {
    expect(consume(policy()).kind).toBe("accepted");
  });

  it("F-23: rejects humour while an allegation exists", () => {
    const decision = policy({ route: "escalate", tone: { humour_allowed: true, register: "warm" } });
    expect(consume(decision, withAllegation).kind).toBe("rejected");
  });

  it("F-11: rejects a draft route when an allegation exists", () => {
    expect(consume(policy({ route: "draft" }), withAllegation).kind).toBe("rejected");
  });

  it("rejects a remedy that is not in the recovery catalogue", () => {
    expect(consume(policy({ permitted_remedy_ids: ["R-FREE-MEAL"] })).kind).toBe("rejected");
  });

  it("rejects an expired fact", () => {
    const decision = policy({
      allowed_facts: [{ fact_id: "F-PRICING", facts_version: "v1", expires_at: "2026-10-01T00:00:00Z" }],
    });
    expect(consume(decision).kind).toBe("rejected");
  });
});

describe("deterministic route", () => {
  it("H-14: a lexical safety trigger escalates even when the model returned nothing", () => {
    const result = decideRoute("My child got food poisoning after the prawns.", null);
    expect(result.route).toBe("escalate");
    expect(result.reasons[0]).toMatch(/^lexical:escalation_medical/);
  });

  it("routes to abstain, never to drafting, when the model returned nothing", () => {
    expect(decideRoute(REVIEW_TEXT, null).route).toBe("abstain");
  });

  it("F-11: escalates on a model-found allegation with no lexical hit", () => {
    const interp = interpretation({
      allegations: [{ type: "contamination", attribution: "reviewer_asserted", evidence: [evidence(REVIEW_TEXT, "coffee too acidic")] }],
    });
    expect(decideRoute(REVIEW_TEXT, interp).route).toBe("escalate");
  });

  it("drafts a routine review", () => {
    expect(decideRoute(REVIEW_TEXT, interpretation()).route).toBe("draft");
  });

  it("F-03 (documented cost): the lexical net over-escalates slang praise like SICK", () => {
    // The shared keyword list matches "sick" as a substring. Over-triggering
    // is the accepted cost of a net that cannot be stalled by the model.
    expect(decideRoute("The burgers here are SICK, best in town!", interpretation()).route).toBe("escalate");
  });
});

describe("H3 draft proposal — semantic rules", () => {
  const consume = (draft: DraftProposal) =>
    consumeHandoff<DraftProposal>(envelope("draft_proposal", draft), H3, draftProposalSchema, (p) =>
      checkDraftProposal(p, { interpretation: interpretation(), policy: policy() }),
    );

  it("accepts the reference draft", () => {
    expect(consume(goodDraft()).kind).toBe("accepted");
  });

  it("H-04: rejects a model-written refund that is not permitted", () => {
    const text = "Sorry about the coffee. We will refund your meal in full.";
    const draft = goodDraft({
      author: "model",
      draft_text: text,
      claims: [claim(text, "We will refund your meal in full.", "remedy", "R-FULL-REFUND")],
      grievances_addressed: [1],
    });
    const verdict = consume(draft);
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") expect(verdict.issues[0].code).toBe("unsupported_claim");
  });

  it("lets the same owner-written promise through to assurance, where it is flagged", () => {
    const text = "Sorry about the coffee. We will refund your meal in full.";
    const draft = goodDraft({
      author: "owner",
      draft_text: text,
      claims: [claim(text, "We will refund your meal in full.", "remedy", "R-FULL-REFUND")],
      grievances_addressed: [1],
    });
    expect(consume(draft).kind).toBe("accepted");
  });

  it("F-31: rejects a Chinese draft over 4,096 bytes even though it is under 4,096 characters", () => {
    const text = "谢".repeat(1366); // 1,366 characters, 4,098 bytes
    const verdict = consume(goodDraft({ draft_text: text, claims: [], grievances_addressed: [] }));
    expect(verdict.kind).toBe("rejected");
    if (verdict.kind === "rejected") expect(verdict.issues[0].code).toBe("byte_cap_exceeded");
  });

  it("rejects a claim span outside the draft", () => {
    const draft = goodDraft();
    draft.claims[0] = { ...draft.claims[0], span: { start: 0, end: 9999 } };
    expect(consume(draft).kind).toBe("rejected");
  });

  it("rejects an acknowledgement without a stance", () => {
    const draft = goodDraft();
    draft.claims[0] = { ...draft.claims[0], stance: null };
    expect(consume(draft).kind).toBe("rejected");
  });
});
