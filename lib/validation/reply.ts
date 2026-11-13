export const VALIDATION_VERSION = "public-reply-v1";

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
  if (text.length > 4000)
    issues.push("Keep the reply within 4,000 characters.");
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
