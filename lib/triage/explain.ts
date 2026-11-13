import type { ReasonCode } from "@/lib/types";

/** Plain-language "why" text for each reason code, shown alongside the draft. */
export const REASON_CODE_EXPLANATIONS: Record<ReasonCode, string> = {
  positive_no_complaint:
    "4-5 stars with praise and no complaint or reservation detected (or a rating with no text) — low risk; the draft can usually be approved as-is.",
  neutral_mixed_sentiment:
    "3 stars, or a higher rating that still contains complaint language — needs your approval.",
  negative_issue: "1-2 star rating — needs your approval, with the issue classified below.",
  unreadable_language:
    "Written in a language or style the rules can't read reliably — read it yourself before replying.",
  unconfirmed_praise:
    "High rating, but the text doesn't clearly read as praise — it may be sarcasm or a complaint. Read it before replying.",
  sensitive_safety:
    "Mentions possible injury or a safety hazard — answer this one personally.",
  sensitive_legal:
    "Mentions legal action or a lawyer — answer this one personally.",
  sensitive_discrimination:
    "Mentions discrimination — answer this one personally.",
  sensitive_medical:
    "Mentions a possible medical or food-safety issue — answer this one personally.",
  sensitive_fraud:
    "Mentions possible fraud — answer this one personally.",
  sensitive_compensation:
    "Asks for a refund or compensation — answer this one personally. Settle any goodwill offer outside the app and record it below.",
};
