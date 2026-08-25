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

  const sensitiveCases: Array<{ text: string; stars: Review["stars"]; reasonCode: string }> = [
    { text: "I slipped on a wet floor with no warning sign and got hurt.", stars: 1, reasonCode: "sensitive_safety" },
    { text: "My lawyer will be in touch, considering legal action.", stars: 1, reasonCode: "sensitive_legal" },
    { text: "One of the staff members made a racist comment to me.", stars: 2, reasonCode: "sensitive_discrimination" },
    { text: "Got food poisoning after eating here, felt sick all night.", stars: 2, reasonCode: "sensitive_medical" },
    { text: "This place is a total scam, I think they stole from me.", stars: 1, reasonCode: "sensitive_fraud" },
    { text: "Charged twice on my card, need a refund immediately.", stars: 3, reasonCode: "sensitive_compensation" },
  ];

  it.each(sensitiveCases)(
    "flags $reasonCode as sensitive high risk and never recommends auto-publish",
    ({ text, stars, reasonCode }) => {
      const result = policy.classify(review({ stars, text }));
      expect(result.riskLevel).toBe("high");
      expect(result.sensitive).toBe(true);
      expect(result.recommendedAction).toBe("approval_required");
      expect(result.reasonCodes).toEqual([reasonCode]);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    },
  );

  it("flags even a 5-star review that mentions a safety issue", () => {
    const result = policy.classify(
      review({ stars: 5, text: "Amazing food, though I did slip and fall near the entrance." }),
    );
    expect(result.riskLevel).toBe("high");
    expect(result.sensitive).toBe(true);
    expect(result.recommendedAction).toBe("approval_required");
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
