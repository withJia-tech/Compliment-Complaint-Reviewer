import type { ReasonCode } from "@/lib/types";

/** Plain-language "why" text for each reason code, shown alongside the draft. */
export const REASON_CODE_EXPLANATIONS: Record<ReasonCode, string> = {
  positive_no_complaint:
    "4-5 stars with no complaint language detected — eligible for automatic publishing once consent is on.",
  neutral_mixed_sentiment:
    "3 stars, or a higher rating that still contains complaint language — needs your approval.",
  negative_issue: "1-2 star rating — needs your approval, with the issue classified below.",
  sensitive_safety:
    "Mentions possible injury or a safety hazard — answer this one personally; it is never auto-published.",
  sensitive_legal:
    "Mentions legal action or a lawyer — answer this one personally; it is never auto-published.",
  sensitive_discrimination:
    "Mentions discrimination — answer this one personally; it is never auto-published.",
  sensitive_medical:
    "Mentions a possible medical or food-safety issue — answer this one personally; it is never auto-published.",
  sensitive_fraud:
    "Mentions possible fraud — answer this one personally; it is never auto-published.",
  sensitive_compensation:
    "Asks for a refund or compensation — answer this one personally; it is never auto-published. Settle any goodwill offer outside the app and record it below.",
};
