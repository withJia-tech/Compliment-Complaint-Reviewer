import type { ReasonCode } from "@/lib/types";

type EscalationReasonCode = Exclude<
  ReasonCode,
  "positive_no_complaint" | "neutral_mixed_sentiment" | "negative_issue"
>;

/**
 * Escalation keyword lists, deterministic and lowercase-matched. Any hit
 * here takes precedence over star rating: the spec requires these
 * categories to escalate and never auto-publish, regardless of rating.
 */
export const ESCALATION_KEYWORDS: Record<EscalationReasonCode, string[]> = {
  escalation_safety: [
    "injur",
    "hurt",
    "unsafe",
    "accident",
    "fire hazard",
    "fell",
    "slipped",
    "slip",
    "burn",
    "assault",
    "threat",
  ],
  escalation_legal: ["lawsuit", "sue", "lawyer", "attorney", "legal action", "small claims"],
  escalation_discrimination: [
    "racist",
    "racism",
    "discriminat",
    "sexist",
    "homophobic",
    "slur",
  ],
  escalation_medical: [
    "allergic reaction",
    "food poisoning",
    "sick",
    "vomit",
    "hospital",
    "poison",
  ],
  escalation_fraud: ["scam", "fraud", "stole", "theft", "overcharged", "unauthorized charge"],
  escalation_compensation: ["refund", "compensation", "reimburse", "money back", "chargeback"],
};

/** Keywords that mark a complaint even inside an otherwise high-star review. */
export const COMPLAINT_KEYWORDS = [
  "disappointed",
  "terrible",
  "worst",
  "rude",
  "dirty",
  "slow",
  "cold food",
  "never again",
  "waste of money",
  "poor service",
  "broken",
  "issue",
  "problem",
];

/** Hints that reinforce a positive read (used only to boost confidence). */
export const POSITIVE_HINTS = ["great", "love", "excellent", "amazing", "best", "friendly", "recommend"];
