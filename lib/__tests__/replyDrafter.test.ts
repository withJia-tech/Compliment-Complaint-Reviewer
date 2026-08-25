import { describe, expect, it } from "vitest";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { ApprovedBusinessFacts, Review } from "@/lib/types";

const drafter = new TemplateReplyDrafter();
const policy = new DefaultTriagePolicy();

const facts: ApprovedBusinessFacts = {
  locationId: "loc_001",
  businessName: "Maple & Vine Cafe",
  facts: [
    { key: "business_name", category: "identity", value: "Maple & Vine Cafe" },
    { key: "contact.phone", category: "contact", value: "(555) 012-3456" },
    { key: "contact.email", category: "contact", value: "hello@mapleandvine.example" },
    {
      key: "policy.refund",
      category: "policy",
      value: "We offer store-credit exchanges within 7 days with a receipt.",
    },
  ],
};

const approvedFactKeys = new Set(facts.facts.map((fact) => fact.key));

// Words that would signal an invented, unapproved promise if they ever
// appeared in generated text without being sourced from `facts` above.
const FORBIDDEN_UNSOURCED_WORDS = ["tomorrow", "$", "guarantee", "promise you", "will refund"];

function review(overrides: Partial<Review>): Review {
  return {
    id: "rev_test",
    locationId: "loc_001",
    author: "Jamie",
    stars: 5,
    text: "",
    createTime: "2026-08-20T00:00:00Z",
    updateTime: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

describe("TemplateReplyDrafter", () => {
  it("only records fact keys that exist in the approved facts file", () => {
    for (const stars of [1, 2, 3, 4, 5] as const) {
      const r = review({ stars, text: "some review text" });
      const triage = policy.classify(r);
      const draft = drafter.draft(r, triage, facts);
      for (const key of draft.factsUsed) {
        expect(approvedFactKeys.has(key)).toBe(true);
      }
    }
  });

  it("never invents a promise, timeline, or dollar amount in negative/escalation replies", () => {
    const negative = review({ stars: 1, text: "Rude staff, worst experience, never again." });
    const escalation = review({ stars: 1, text: "I slipped and got hurt, no warning sign." });

    for (const r of [negative, escalation]) {
      const triage = policy.classify(r);
      const draft = drafter.draft(r, triage, facts);
      for (const forbidden of FORBIDDEN_UNSOURCED_WORDS) {
        expect(draft.text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });

  it("does not cite the refund policy fact for a compensation escalation (no promised remedy)", () => {
    const r = review({ stars: 3, text: "Charged twice on my card, need a refund immediately." });
    const triage = policy.classify(r);
    const draft = drafter.draft(r, triage, facts);
    expect(triage.riskLevel).toBe("escalate");
    expect(draft.factsUsed).not.toContain("policy.refund");
  });

  it("falls back to generic phrasing instead of inventing contact info when no fact is approved", () => {
    const noContactFacts: ApprovedBusinessFacts = { locationId: "loc_001", businessName: "Test Biz", facts: [] };
    const r = review({ stars: 2, text: "Very disappointed with the service." });
    const triage = policy.classify(r);
    const draft = drafter.draft(r, triage, noContactFacts);
    expect(draft.factsUsed).toEqual([]);
    expect(draft.text).toContain("our front desk");
  });

  it("cites the business name fact for a positive review", () => {
    const r = review({ stars: 5, text: "Loved it, staff were so friendly!" });
    const triage = policy.classify(r);
    const draft = drafter.draft(r, triage, facts);
    expect(draft.factsUsed).toContain("business_name");
    expect(draft.text).toContain(facts.businessName);
  });
});
