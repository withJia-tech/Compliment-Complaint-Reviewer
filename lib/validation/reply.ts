/** v2: length is measured in UTF-8 bytes against Google's limit (v1 counted characters). */
export const VALIDATION_VERSION = "public-reply-v2";

/** Google Business Profile's limit for a review reply, in UTF-8 bytes (not characters). */
export const MAX_REPLY_BYTES = 4096;

/** Bytes of the exact text that would be sent, as Google counts them. Works in the browser too. */
export function replyByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Conservative English guardrails, not a semantic proof. Human factual review is mandatory. */
export function validateReply(text: string): string[] {
  const issues: string[] = [];
  const normalized = text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (!text.trim())
    issues.push(
      "Write a reply before sending; a blank edit will not send the old draft.",
    );
  const bytes = replyByteLength(text);
  if (bytes > MAX_REPLY_BYTES)
    issues.push(
      `Shorten the reply: Google allows ${MAX_REPLY_BYTES.toLocaleString("en-US")} bytes and this one is ${bytes.toLocaleString("en-US")} bytes. Chinese, Tamil and many other characters take 3 bytes each, emoji 4.`,
    );
  if (
    /\b(refund\w*|voucher\w*|reimburse\w*|compensat\w*|discount\w*)\b|\bgift\s+card\b|\bfree\s+(meal|drink|coffee|item)\b|\bmoney\s+back\b/i.test(
      normalized,
    )
  ) {
    issues.push(
      "Keep recovery offers and remedies in the private conversation.",
    );
  }
  if (
    /[$£€]\s*\d|\b(tomorrow|guarantee[ds]?|within\s+\d+\s+(hours?|days?))\b/i.test(
      normalized,
    )
  ) {
    issues.push("Remove unverified amounts, deadlines or guarantees.");
  }
  if (
    /\b(fired|dismissed|disciplined|misconduct)\b|\b(staff|employee|waiter|waitress|server|chef|guest|customer)\b.{0,50}\b(blame|fault|lied|lying|incompetent)\b/i.test(
      normalized,
    )
  ) {
    issues.push("Remove personnel judgments or blame from the public reply.");
  }
  if (
    /\b(we(?:'ve| have)?|our team)\s+(?:already\s+)?(investigated|fixed|resolved|retrained|spoken|changed|implemented)\b/i.test(
      normalized,
    )
  ) {
    issues.push(
      "Do not claim completed investigations or changes without a verified evidence workflow.",
    );
  }
  return issues;
}
