import type { ReasonCode, ReviewTheme } from "@/lib/types";

type SensitiveReasonCode = Exclude<
  ReasonCode,
  "positive_no_complaint" | "neutral_mixed_sentiment" | "negative_issue"
>;

/**
 * Sensitive-claim keyword lists, deterministic and lowercase-matched. Any hit
 * here forces high risk and blocks automatic publishing regardless of star
 * rating. These are claims a human must answer personally — not a separate
 * escalation tier, since a one-person team has nobody to escalate to.
 */
export const SENSITIVE_KEYWORDS: Record<SensitiveReasonCode, string[]> = {
  sensitive_safety: [
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
  sensitive_legal: ["lawsuit", "sue", "lawyer", "attorney", "legal action", "small claims"],
  sensitive_discrimination: ["racist", "racism", "discriminat", "sexist", "homophobic", "slur"],
  sensitive_medical: [
    "allergic reaction",
    "food poisoning",
    "sick",
    "vomit",
    "hospital",
    "poison",
  ],
  sensitive_fraud: ["scam", "fraud", "stole", "theft", "overcharged", "unauthorized charge"],
  sensitive_compensation: ["refund", "compensation", "reimburse", "money back", "chargeback"],
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
export const POSITIVE_HINTS = [
  "great",
  "love",
  "excellent",
  "amazing",
  "best",
  "friendly",
  "recommend",
];

/**
 * Theme keywords mapped to the Food / Service / Atmosphere sub-ratings Google
 * Business Profile already collects, so the weekly and monthly rollups can be
 * read alongside the owner's existing Google metrics.
 */
export const THEME_KEYWORDS: Record<ReviewTheme, string[]> = {
  food: [
    "food",
    "coffee",
    "latte",
    "meal",
    "dish",
    "menu",
    "taste",
    "tasty",
    "delicious",
    "portion",
    "cold food",
    "order was wrong",
    "drink",
    "cake",
    "breakfast",
    "lunch",
  ],
  service: [
    "service",
    "staff",
    "waiter",
    "waitress",
    "server",
    "barista",
    "rude",
    "friendly",
    "slow",
    "waited",
    "wait",
    "manager",
    "attentive",
    "helpful",
  ],
  atmosphere: [
    "atmosphere",
    "ambience",
    "ambiance",
    "vibe",
    "music",
    "noisy",
    "loud",
    "quiet",
    "decor",
    "seating",
    "table",
    "clean",
    "dirty",
    "cosy",
    "cozy",
    "crowded",
  ],
};
