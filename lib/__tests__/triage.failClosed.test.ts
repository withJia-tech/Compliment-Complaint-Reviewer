import { describe, expect, it } from "vitest";
import dev from "@/evals/routing/dev.json";
import holdout from "@/evals/routing/holdout.json";
import goldenCases from "@/data/fixtures/golden.json";
import { DefaultTriagePolicy, SHADOW_AUTO_SEND_RULE } from "@/lib/triage/policy";
import type { Review } from "@/lib/types";

const fixedClock = () => new Date("2026-11-13T00:00:00.000Z");
const policy = new DefaultTriagePolicy(fixedClock);
const review = (stars: number, text: string) => ({ id: "r", stars: stars as Review["stars"], text });

const everyText = [
  ...(goldenCases as { stars: number; text: string }[]),
  ...(dev as { stars: number; text: string }[]),
  ...(holdout as { stars: number; text: string }[]),
];

describe("fail-closed quick approve", () => {
  it("is deterministic under an injected clock", () => {
    const a = policy.classify(review(5, "Lovely cafe."));
    const b = policy.classify(review(5, "Lovely cafe."));
    expect(a).toEqual(b);
    expect(a.computedAt).toBe("2026-11-13T00:00:00.000Z");
  });

  it("only quick-approves 4-5 star reviews", () => {
    for (const { stars, text } of everyText) {
      const result = policy.classify(review(stars, text));
      if (result.recommendedAction === "quick_approve") expect(stars).toBeGreaterThan(3);
    }
  });

  it("never quick-approves text with a non-Latin script", () => {
    for (const text of ["服务很好", "சாப்பாடு நல்லது", "とても美味しい", "ممتاز"]) {
      expect(policy.classify(review(5, text)).recommendedAction).toBe("needs_review");
    }
  });

  it("requires praise to be present, not just complaints to be absent", () => {
    expect(policy.classify(review(5, "Wow. Just wow.")).reasonCodes).toEqual(["unconfirmed_praise"]);
    expect(policy.classify(review(5, "Wow, lovely.")).recommendedAction).toBe("quick_approve");
  });

  it("idiom exemptions never suppress a second, literal mention", () => {
    const result = policy.classify(review(5, "Fell in love with the cake. My mum fell outside."));
    expect(result.sensitive).toBe(true);
  });
});

describe("B1 shadow auto-send (recorded, never acted on)", () => {
  it("tags every result with the shadow rule id", () => {
    expect(policy.classify(review(1, "Awful.")).shadow?.rule).toBe(SHADOW_AUTO_SEND_RULE);
  });

  it("would only ever auto-send a 5-star quick approve with praise", () => {
    for (const { stars, text } of everyText) {
      const result = policy.classify(review(stars, text));
      if (!result.shadow?.wouldAutoSend) continue;
      expect(stars).toBe(5);
      expect(result.recommendedAction).toBe("quick_approve");
      expect(result.sensitive).toBe(false);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    }
  });

  it("excludes bare ratings: there is no praise to point to", () => {
    expect(policy.classify(review(5, "")).shadow?.wouldAutoSend).toBe(false);
  });
});
