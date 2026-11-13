import { describe, expect, it } from "vitest";
import { MAX_REPLY_BYTES, VALIDATION_VERSION, replyByteLength, validateReply } from "@/lib/validation/reply";

/**
 * Google Business Profile caps a review reply at 4,096 bytes of UTF-8, not
 * 4,096 characters. Before this change the validator counted characters
 * (limit 4,000), so a 1,400-character Chinese reply (4,200 bytes) passed here
 * and would be rejected by Google. These cases sit on both sides of the limit
 * in scripts with multi-byte characters.
 */
const TOO_LONG = /4,096 bytes/;

function lengthIssues(text: string): string[] {
  return validateReply(text).filter((issue) => TOO_LONG.test(issue));
}

// [label, unit, repeat, bytes per unit]
const NEAR_LIMIT: [string, string, number, number][] = [
  ["ASCII", "a", 1, 1],
  ["Chinese (3 bytes a character)", "好", 1, 3],
  ["Tamil (3 bytes a code point)", "நன்றி", 1, 15],
  ["emoji (4 bytes, 2 UTF-16 units)", "😀", 1, 4],
  ["emoji ZWJ sequence (11 bytes)", "👩‍🍳", 1, 11],
];

describe("reply length is measured in UTF-8 bytes against Google's 4,096", () => {
  it("uses Google's documented limit and a new validation version", () => {
    expect(MAX_REPLY_BYTES).toBe(4096);
    expect(VALIDATION_VERSION).toBe("public-reply-v2");
  });

  it.each(NEAR_LIMIT)("%s: the longest reply that fits passes, one unit more fails", (_label, unit, _r, bytesPerUnit) => {
    expect(replyByteLength(unit)).toBe(bytesPerUnit);
    const fits = Math.floor(MAX_REPLY_BYTES / bytesPerUnit);
    expect(lengthIssues(unit.repeat(fits))).toEqual([]);
    expect(lengthIssues(unit.repeat(fits + 1))).toHaveLength(1);
  });

  it("blocks the 1,400-character Chinese reply that the character count let through", () => {
    const reply = "谢谢您的反馈".repeat(233) + "谢谢"; // 1,400 characters
    expect(reply.length).toBe(1400);
    expect(replyByteLength(reply)).toBe(4200);
    expect(lengthIssues(reply)).toHaveLength(1);
  });

  it("allows a long English reply under 4,096 bytes that the old 4,000-character cap refused", () => {
    expect(lengthIssues("a".repeat(4050))).toEqual([]);
  });

  it("counts the exact text that is sent: spaces and invisible characters included", () => {
    expect(replyByteLength(" ".repeat(10))).toBe(10);
    expect(replyByteLength("​")).toBe(3);
    const padded = "a".repeat(4094) + "​";
    expect(lengthIssues(padded)).toHaveLength(1);
  });

  it("tells the owner how far over the limit the reply is", () => {
    expect(lengthIssues("好".repeat(1400))[0]).toMatch(/4,200 bytes/);
  });
});
