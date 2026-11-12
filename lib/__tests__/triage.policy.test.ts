import { describe, expect, it } from "vitest";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";
import type { Review } from "@/lib/types";

const policy = new DefaultTriagePolicy();

function review(overrides: Partial<Review>): Review {
  return {
    id: "rev_test",
    locationId: "loc_001",
    author: "Test Author",
    stars: 5,
    text: "",
    createTime: "2026-08-20T00:00:00Z",
    updateTime: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

describe("DefaultTriagePolicy", () => {
  it("stamps the current policy version on every result", () => {
    const result = policy.classify(review({ stars: 5, text: "Great!" }));
    expect(result.policyVersion).toBe(POLICY_VERSION);
  });

  it("classifies a clean 5-star review as low risk, auto-publish eligible", () => {
    const result = policy.classify(
      review({ stars: 5, text: "Loved the coffee, staff were so friendly!" }),
    );
    expect(result.riskLevel).toBe("low");
    expect(result.recommendedAction).toBe("auto_publish_eligible");
    expect(result.reasonCodes).toEqual(["positive_no_complaint"]);
  });

  it("classifies a clean 4-star review as low risk, auto-publish eligible", () => {
    const result = policy.classify(review({ stars: 4, text: "Great food and fast service." }));
    expect(result.riskLevel).toBe("low");
    expect(result.recommendedAction).toBe("auto_publish_eligible");
  });

  it("downgrades a 4-star review containing a complaint keyword to medium/approval_required", () => {
    const result = policy.classify(
      review({ stars: 4, text: "Nice place but the table was dirty when we sat down." }),
    );
    expect(result.riskLevel).toBe("medium");
    expect(result.recommendedAction).toBe("approval_required");
    expect(result.reasonCodes).toEqual(["neutral_mixed_sentiment"]);
  });

  it("classifies a 3-star review as medium risk, approval required", () => {
    const result = policy.classify(
      review({ stars: 3, text: "Food was good but service was really slow today." }),
    );
    expect(result.riskLevel).toBe("medium");
    expect(result.recommendedAction).toBe("approval_required");
  });

  it("classifies a 1-2 star review as high risk, approval required", () => {
    const twoStar = policy.classify(
      review({ stars: 2, text: "Waited 40 minutes and the order was wrong, very disappointed." }),
    );
    expect(twoStar.riskLevel).toBe("high");
    expect(twoStar.recommendedAction).toBe("approval_required");
    expect(twoStar.reasonCodes).toEqual(["negative_issue"]);

    const oneStar = policy.classify(review({ stars: 1, text: "Rude staff, worst experience, never again." }));
    expect(oneStar.riskLevel).toBe("high");
    expect(oneStar.recommendedAction).toBe("approval_required");
  });

  it("only ever uses three risk levels", () => {
    const seen = new Set(
      [1, 2, 3, 4, 5].flatMap((stars) =>
        ["lovely visit", "slow service", "I got hurt here"].map(
          (text) => policy.classify(review({ stars: stars as Review["stars"], text })).riskLevel,
        ),
      ),
    );
    expect([...seen].sort()).toEqual(["high", "low", "medium"]);
  });

  // Per-case routing expectations live in data/fixtures/golden.json and are
  // checked by golden.routing.test.ts. These cover the mechanics instead:
  // that a strong hit goes straight to high, that a weak, ambiguous hit is
  // softened to medium but still blocks auto-publish, and that a bad rating
  // can lift a weak hit back up.
  const strongCases: Array<{ text: string; stars: Review["stars"]; reasonCode: string }> = [
    { text: "I slipped on a wet floor with no warning sign and got hurt.", stars: 1, reasonCode: "sensitive_safety" },
    { text: "My lawyer will be in touch, considering legal action.", stars: 1, reasonCode: "sensitive_legal" },
    { text: "One of the staff members made a racist comment to me.", stars: 2, reasonCode: "sensitive_discrimination" },
    { text: "Got food poisoning after eating here.", stars: 2, reasonCode: "sensitive_medical" },
    { text: "This place is a total scam, I think they stole from me.", stars: 1, reasonCode: "sensitive_fraud" },
    { text: "I want compensation for this.", stars: 3, reasonCode: "sensitive_compensation" },
  ];

  it.each(strongCases)(
    "sends an unambiguous $reasonCode claim straight to high risk",
    ({ text, stars, reasonCode }) => {
      const result = policy.classify(review({ stars, text }));
      expect(result.riskLevel).toBe("high");
      expect(result.sensitive).toBe(true);
      expect(result.recommendedAction).toBe("approval_required");
      expect(result.reasonCodes).toEqual([reasonCode]);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    },
  );

  it("softens an ambiguous hit on a happy review to medium, but still blocks auto-publish", () => {
    const result = policy.classify(
      review({ stars: 5, text: "Amazing food, though I did slip near the entrance." }),
    );
    expect(result.riskLevel).toBe("medium");
    expect(result.sensitive).toBe(true);
    expect(result.recommendedAction).toBe("approval_required");
  });

  it("lets a bad star rating lift an ambiguous hit back to high", () => {
    const result = policy.classify(review({ stars: 1, text: "Awful, and I felt sick after." }));
    expect(result.riskLevel).toBe("high");
    expect(result.sensitive).toBe(true);
  });

  it("prefers a strong hit over a weak one in a more severe category", () => {
    // "sick" is a weak medical hit; "chargeback" is a strong compensation hit.
    const result = policy.classify(
      review({ stars: 2, text: "Felt a bit sick, but the real issue was the chargeback." }),
    );
    expect(result.reasonCodes).toEqual(["sensitive_compensation"]);
    expect(result.riskLevel).toBe("high");
  });

  it("picks the most severe category when several match", () => {
    const result = policy.classify(
      review({ stars: 1, text: "Got food poisoning and I demand compensation." }),
    );
    expect(result.reasonCodes).toEqual(["sensitive_medical"]);
  });

  describe("false positives from substring matching", () => {
    // "issue" contains "sue", "slippers" contains "slip", "sunburn" contains
    // "burn", "fellow" contains "fell". All of these used to escalate.
    it.each([
      ["There was an issue with my order.", 4],
      ["They sell lovely slippers in the gift shop.", 5],
      ["Great sunburn cream on sale here.", 5],
      ["A fellow diner recommended the tart.", 4],
      ["I will pursue the tasting menu next time.", 5],
    ] as const)("does not flag %s as sensitive", (text, stars) => {
      const result = policy.classify(review({ stars: stars as Review["stars"], text }));
      expect(result.sensitive).toBe(false);
    });

    it("reads a negated complaint on a happy review as praise", () => {
      const result = policy.classify(review({ stars: 5, text: "No issues at all, lovely visit." }));
      expect(result.riskLevel).toBe("low");
      expect(result.recommendedAction).toBe("auto_publish_eligible");
    });

    it("still counts a complaint that appears both negated and plain", () => {
      const result = policy.classify(
        review({ stars: 4, text: "No problems with the food, but a problem with the bill." }),
      );
      expect(result.riskLevel).toBe("medium");
    });
  });

  it("never marks an ordinary bad review as sensitive", () => {
    const result = policy.classify(review({ stars: 1, text: "Rude staff, worst experience." }));
    expect(result.riskLevel).toBe("high");
    expect(result.sensitive).toBe(false);
  });

  describe("themes", () => {
    it("tags food, service, and atmosphere against Google's sub-rating split", () => {
      expect(policy.classify(review({ stars: 5, text: "The coffee was delicious" })).themes).toContain("food");
      expect(policy.classify(review({ stars: 5, text: "The staff were lovely" })).themes).toContain("service");
      expect(policy.classify(review({ stars: 5, text: "Such a cosy atmosphere" })).themes).toContain("atmosphere");
    });

    it("can tag more than one theme on a single review", () => {
      const result = policy.classify(
        review({ stars: 3, text: "The food was great but the staff were slow and it was very loud." }),
      );
      expect(result.themes).toEqual(expect.arrayContaining(["food", "service", "atmosphere"]));
    });

    it("returns no themes when nothing recognisable is mentioned", () => {
      expect(policy.classify(review({ stars: 5, text: "Came here yesterday." })).themes).toEqual([]);
    });
  });
});
