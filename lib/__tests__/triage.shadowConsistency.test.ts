import { describe, expect, it } from "vitest";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { ReaderError, type ReviewReading } from "@/lib/triage/reader/types";
import { triageReview } from "@/lib/triage/triageReview";
import type { Review } from "@/lib/types";

/**
 * The B1 shadow flag records whether the auto-send rule *would* have sent a
 * review. It is evidence for a future decision, so it must never claim a
 * review would be auto-sent while triage holds that review for the owner.
 * Found when PR #6 (guards, second reader) met PR #8 (shadow flag): the flag
 * was set by the keyword step and left untouched when a later step raised
 * the review.
 */
const policy = new DefaultTriagePolicy();
const PRAISE = "Amazing coffee and lovely staff!";

function review(text: string, stars: Review["stars"] = 5): Review {
  return { id: "r", locationId: "loc_001", author: "T", stars, text, createTime: "", updateTime: "" };
}

const reading = (overrides: Partial<ReviewReading> = {}): ReviewReading => ({
  language: "en",
  concern: "none",
  category: "none",
  contains_personal_info: false,
  rationale: "t",
  ...overrides,
});

describe("shadow wouldAutoSend agrees with the final routing", () => {
  it("is true for plain 5-star praise that quick-approves (the baseline)", async () => {
    const result = await triageReview(review(PRAISE), policy, null);
    expect(result.recommendedAction).toBe("quick_approve");
    expect(result.shadow?.wouldAutoSend).toBe(true);
  });

  it.each([
    ["a link", `${PRAISE} More at www.example.xyz`],
    ["a phone number", `${PRAISE} Call me on 9123 4567`],
  ])("is false when a guard raises the review for %s", (_label, text) => {
    const result = policy.classify(review(text));
    expect(result.recommendedAction).toBe("needs_review");
    expect(result.shadow?.wouldAutoSend).toBe(false);
  });

  it("is false when the second reader raises the review", async () => {
    const reader = { id: "fake", read: async () => reading({ concern: "complaint" }) };
    const result = await triageReview(review(PRAISE), policy, reader);
    expect(result.recommendedAction).toBe("needs_review");
    expect(result.shadow?.wouldAutoSend).toBe(false);
  });

  it("is false when the second reader fails and the review is held", async () => {
    const reader = {
      id: "fake",
      read: async () => {
        throw new ReaderError("down", "api_error");
      },
    };
    const result = await triageReview(review(PRAISE), policy, reader);
    expect(result.reasonCodes).toContain("reader_failed");
    expect(result.shadow?.wouldAutoSend).toBe(false);
  });

  it("stays true when the reader agrees it is praise", async () => {
    const reader = { id: "fake", read: async () => reading() };
    const result = await triageReview(review(PRAISE), policy, reader);
    expect(result.recommendedAction).toBe("quick_approve");
    expect(result.shadow?.wouldAutoSend).toBe(true);
  });
});
