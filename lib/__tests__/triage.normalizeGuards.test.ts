import { describe, expect, it } from "vitest";
import { hasLink, hasPersonalInfo, isGibberish, isNonLatinScript } from "@/lib/triage/guards";
import { normalizeForMatching } from "@/lib/triage/normalize";

describe("normalizeForMatching", () => {
  it.each([
    ["f00d p0isoning", "food poisoning"],
    ["allergic reacti0n", "allergic reaction"],
    ["my l a w y e r", "my lawyer"],
    ["I will s.u.e", "I will sue"],
    ["the ​l​a​w​s​u​i​t", "the lawsuit"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeForMatching(input)).toBe(expected);
  });

  it("leaves ordinary text alone", () => {
    const text = "Waited 40 minutes for 2 coffees at 5pm, a bit slow.";
    expect(normalizeForMatching(text)).toBe(text);
  });
});

describe("deterministic guards", () => {
  it("spots personal details", () => {
    expect(hasPersonalInfo("call me on 9123 4567")).toBe(true);
    expect(hasPersonalInfo("reach me at jane.doe@example.com")).toBe(true);
    expect(hasPersonalInfo("my card ending 4482 was charged")).toBe(true);
    expect(hasPersonalInfo("he lives at 12 Example Street")).toBe(true);
    expect(hasPersonalInfo("waited 40 minutes for table 12")).toBe(false);
  });

  it("spots links but not email addresses alone", () => {
    expect(hasLink("visit https://example-promo.example/redeem")).toBe(true);
    expect(hasLink("see www.deals.com")).toBe(true);
    expect(hasLink("email jane.doe@example.com")).toBe(false);
  });

  it("spots gibberish and non-Latin scripts, but not emoji or short text", () => {
    expect(isGibberish("a".repeat(500))).toBe(true);
    expect(isGibberish("😍😍😍")).toBe(false);
    expect(isNonLatinScript("味道不错，但是吃完之后全家人都拉肚子")).toBe(true);
    expect(isNonLatinScript("Makanan sedap, layanan pantas")).toBe(false);
    expect(isNonLatinScript("😍😍😍")).toBe(false);
  });
});
