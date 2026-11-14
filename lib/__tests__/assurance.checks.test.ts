import { describe, expect, it } from "vitest";
import { runAssurance, type AssuranceInput } from "@/lib/assurance/checks";
import { MAX_POST_ITS } from "@/lib/assurance/postits";
import type { AssuranceReport, DraftProposal } from "@/lib/assurance/types";
import {
  GOOD_DRAFT_TEXT,
  REVIEW_TEXT,
  claim,
  evidence,
  goodDraft,
  interpretation,
  policy,
  snapshot,
} from "@/lib/__tests__/helpers/assuranceFixtures";

function run(overrides: Partial<AssuranceInput> = {}): AssuranceReport {
  return runAssurance({
    snapshot: snapshot(),
    interpretation: interpretation(),
    policy: policy(),
    draft: goodDraft(),
    recordedActionIds: [],
    ...overrides,
  });
}

const result = (report: AssuranceReport, checkId: string) =>
  report.checks.filter((c) => c.check_id === checkId).map((c) => c.result);

describe("response assurance — code-decided checks", () => {
  it("passes the reference draft for review (warnings allowed, nothing blocks)", () => {
    const report = run();
    expect(report.overall).toBe("ready_for_review");
    expect(report.blockers).toEqual([]);
    expect(report.draft_sha256).toHaveLength(64);
  });

  it("F-06 / H-01 (RA-006): blocks praise for food the review criticised", () => {
    const text = "We're delighted you enjoyed our food, and thank you for praising the service.";
    const draft: DraftProposal = goodDraft({
      draft_text: text,
      claims: [
        claim(text, "We're delighted you enjoyed our food,", "acknowledgement", "2", "praise"),
        claim(text, "thank you for praising the service.", "acknowledgement", "0", "praise"),
      ],
      grievances_addressed: [],
    });
    const report = run({ draft });
    expect(result(report, "C-FALSE-PRAISE")).toEqual(["fail"]);
    expect(report.overall).toBe("blocked");
    expect(report.post_its.map((p) => p.text).join(" ")).toContain("criticises the food");
  });

  it("F-05: blocks a draft that skips the primary grievance", () => {
    const report = run({ draft: goodDraft({ grievances_addressed: [2] }) });
    expect(result(report, "C-COVERAGE")).toEqual(["fail"]);
    expect(report.blockers).toContain("C-COVERAGE");
  });

  it("F-04: warns, without blocking, when a positive aspect is dropped", () => {
    const draft = goodDraft();
    draft.claims = draft.claims.filter((c) => c.ref !== "0");
    const report = run({ draft });
    expect(result(report, "C-ASPECTS")).toContain("warn");
    expect(report.overall).toBe("ready_for_review");
  });

  it("F-08: blocks an owner's remedy promise that is not in the catalogue", () => {
    const text = `${GOOD_DRAFT_TEXT} Your next coffee is on us.`;
    const draft = goodDraft({ draft_text: text });
    draft.claims = [...draft.claims, claim(text, "Your next coffee is on us.", "remedy", "R-FREE-COFFEE")];
    const report = run({ draft });
    expect(result(report, "C-REMEDY")).toEqual(["fail"]);
  });

  it("F-09 / F-24: blocks a factual statement with no approved fact", () => {
    const text = `${GOOD_DRAFT_TEXT} Our beans are roasted in-house every morning.`;
    const draft = goodDraft({ draft_text: text });
    draft.claims = [...draft.claims, claim(text, "Our beans are roasted in-house every morning.", "fact", null)];
    expect(result(run({ draft }), "C-FACT-SUPPORT")).toEqual(["fail"]);
  });

  it("H-03: blocks 'we investigated' with no recorded action, passes once recorded", () => {
    const text = `${GOOD_DRAFT_TEXT} We have investigated with the kitchen team.`;
    const draft = goodDraft({ draft_text: text });
    draft.claims = [...draft.claims, claim(text, "We have investigated with the kitchen team.", "action", "ACT-9")];
    expect(result(run({ draft }), "C-ACTION")).toEqual(["fail"]);
    expect(result(run({ draft, recordedActionIds: ["ACT-9"] }), "C-ACTION")).toEqual(["pass"]);
  });

  it("warns when promise wording was not extracted as a claim (second net)", () => {
    const text = `${GOOD_DRAFT_TEXT} We will make it right.`;
    const report = run({ draft: goodDraft({ draft_text: text }) });
    expect(result(report, "C-PROMISE-NET")).toEqual(["warn"]);
  });

  it("F-30: blocks a staff name from the review appearing in the draft, unless an approver decided", () => {
    const reviewText = "Ravi at the counter was rude and the coffee too acidic.";
    const snap = snapshot({ text: reviewText, pii_spans: [{ ...evidence(reviewText, "Ravi"), kind: "person_name" }] });
    const text = `${GOOD_DRAFT_TEXT} We've spoken to Ravi about this.`;
    const draft = goodDraft({ draft_text: text });
    expect(result(run({ snapshot: snap, draft }), "C-PII")).toEqual(["fail"]);
    expect(result(run({ snapshot: snap, draft, piiDecisionRecorded: true }), "C-PII")).toEqual(["warn"]);
  });

  it("F-23: blocks humour on a case with allegations", () => {
    const interp = interpretation({
      allegations: [{ type: "illness", attribution: "reviewer_asserted", evidence: [evidence(REVIEW_TEXT, "coffee too acidic")] }],
    });
    const report = run({ interpretation: interp, policy: policy({ route: "escalate", tone: { humour_allowed: true, register: "warm" } }) });
    expect(result(report, "C-HUMOUR")).toEqual(["fail"]);
  });

  it("F-33: a reply far longer than the band warns but does not block", () => {
    const longText = `${GOOD_DRAFT_TEXT} ${"We truly value every guest and every visit. ".repeat(20)}`;
    const report = run({ draft: goodDraft({ draft_text: longText }) });
    expect(result(report, "C-LENGTH")).toEqual(["warn"]);
    expect(report.blockers).not.toContain("C-LENGTH");
  });

  it("finding: with the proposed band, any full reply to a short review warns", () => {
    // 13-word review → max = max(1.0 × 13, floor 15) = 15 words. The reference
    // draft addresses three aspects in ~50 words, so it warns. The band needs
    // calibration before use (spec §6.5); this test records the current state.
    expect(result(run(), "C-LENGTH")).toEqual(["warn"]);
  });
});

describe("post-its and creativity log", () => {
  it("shows at most three post-its, most severe first", () => {
    const text = "We're delighted you enjoyed our food. Your next coffee is on us. We spoke to the barista.";
    const draft = goodDraft({
      draft_text: text,
      claims: [
        claim(text, "We're delighted you enjoyed our food.", "acknowledgement", "2", "praise"),
        claim(text, "Your next coffee is on us.", "remedy", "R-FREE-COFFEE"),
        claim(text, "We spoke to the barista.", "action", "ACT-1"),
      ],
      grievances_addressed: [],
    });
    const report = run({ draft });
    expect(report.post_its).toHaveLength(MAX_POST_ITS);
    const severities = report.post_its.map((p) => p.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
    expect(report.post_its[0].check_id).toBe("C-REMEDY");
  });

  it("logs uncovered draft text as unclassified liberties and reports coverage", () => {
    const text = `${GOOD_DRAFT_TEXT} We know how disappointing this must have been.`;
    const report = run({ draft: goodDraft({ draft_text: text }) });
    expect(report.liberties).toHaveLength(1);
    expect(report.liberties[0].type).toBe("unclassified");
    expect(text.slice(report.liberties[0].span.start, report.liberties[0].span.end)).toContain("disappointing");
    expect(report.claim_coverage).toBeLessThan(1);
    expect(report.claim_coverage).toBeGreaterThan(0.7);
  });

  it("reports full coverage when every sentence maps to a claim", () => {
    expect(run().claim_coverage).toBe(1);
    expect(run().liberties).toEqual([]);
  });
});
