import type { ReasonCode } from "@/lib/types";

/** Plain-language "why" text for each reason code, shown on the review detail page. */
export const REASON_CODE_EXPLANATIONS: Record<ReasonCode, string> = {
  positive_no_complaint:
    "4-5 stars with no complaint language detected — eligible for automatic publishing once consent is on.",
  neutral_mixed_sentiment:
    "3 stars, or a higher rating that still contains complaint language — routed for human approval.",
  negative_issue:
    "1-2 star rating — routed for human approval with issue classification shown below.",
  escalation_safety:
    "Mentions possible injury or a safety hazard — escalated per policy and never auto-published.",
  escalation_legal:
    "Mentions legal action or a lawyer — escalated per policy and never auto-published.",
  escalation_discrimination:
    "Mentions discrimination — escalated per policy and never auto-published.",
  escalation_medical:
    "Mentions a possible medical or food-safety issue — escalated per policy and never auto-published.",
  escalation_fraud: "Mentions possible fraud — escalated per policy and never auto-published.",
  escalation_compensation:
    "Requests a refund or compensation — escalated per policy and never auto-published.",
};
