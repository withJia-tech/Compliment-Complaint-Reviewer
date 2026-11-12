import type { ReasonCode, ReviewTheme } from "@/lib/types";

export type SensitiveReasonCode = Exclude<
  ReasonCode,
  "positive_no_complaint" | "neutral_mixed_sentiment" | "negative_issue"
>;

/**
 * A keyword's strength decides how hard it pulls.
 *
 * `strong` terms are unambiguous in a review context ("food poisoning",
 * "lawsuit", "racist") and route straight to high risk.
 *
 * `weak` terms are real signals but carry ordinary non-complaint meanings
 * too ("sick of waiting", "burnt toast", "sue" in a figure of speech). They
 * still mark the review sensitive — so it needs the owner's personal attention — but they
 * only floor it at medium risk, so ambiguous hits don't crowd out genuine
 * claims at the top of the queue. A bad star rating can still lift them.
 */
export interface SensitiveRule {
  strong: string[];
  weak: string[];
}

/**
 * Severity order. When a review matches more than one category, the earliest
 * entry here wins — a deliberate ordering, not the accident of object key
 * order it replaces. Physical harm outranks money.
 */
export const SENSITIVE_SEVERITY_ORDER: SensitiveReasonCode[] = [
  "sensitive_safety",
  "sensitive_medical",
  "sensitive_discrimination",
  "sensitive_legal",
  "sensitive_fraud",
  "sensitive_compensation",
];

/**
 * Sensitive-claim terms. Matched on word boundaries, so "issue" no longer
 * matches "sue", "slippers" no longer matches "slip", and "sunburn" no longer
 * matches "burn". Entries ending in `*` match a prefix, for word families
 * like injury/injured/injuries.
 */
export const SENSITIVE_KEYWORDS: Record<SensitiveReasonCode, SensitiveRule> = {
  sensitive_safety: {
    strong: [
      "injur*",
      "assault*",
      "unsafe",
      "fire hazard",
      "wet floor",
      "got hurt",
      "was hurt",
      "we hurt",
      "safety hazard",
    ],
    weak: ["hurt", "slip", "slipped", "fell", "burn*", "accident", "threat*"],
  },
  sensitive_medical: {
    strong: ["food poisoning", "allergic reaction", "poisoned", "hospital", "ambulance"],
    weak: ["sick", "vomit*", "ill", "poison"],
  },
  sensitive_discrimination: {
    strong: ["racist", "racism", "discriminat*", "sexist", "homophobic", "slur", "harass*"],
    weak: [],
  },
  sensitive_legal: {
    strong: ["lawsuit", "lawyer", "attorney", "solicitor", "legal action", "small claims"],
    weak: ["sue", "sued", "suing"],
  },
  sensitive_fraud: {
    strong: ["scam*", "fraud*", "unauthorised charge", "unauthorized charge", "theft", "stole"],
    weak: ["overcharged", "double charged", "charged twice"],
  },
  sensitive_compensation: {
    strong: ["compensation", "chargeback", "money back", "dispute the charge", "disput*"],
    weak: ["refund*", "reimburse*"],
  },
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
  "issue*",
  "problem*",
  "wrong",
];

/** Hints that reinforce a positive read (used only to pick the confidence band). */
export const POSITIVE_HINTS = [
  "great",
  "love*",
  "excellent",
  "amazing",
  "best",
  "friendly",
  "recommend*",
  "lovely",
];

/**
 * Theme keywords mapped to the Food / Service / Atmosphere sub-ratings Google
 * Business Profile already collects, so the weekly and monthly rollups can be
 * read alongside the owner's existing Google metrics.
 *
 * Not every review has a theme — a billing dispute is none of the three — so
 * an empty theme list is a valid result, not a gap to force-fill.
 */
export const THEME_KEYWORDS: Record<ReviewTheme, string[]> = {
  food: [
    "food",
    "coffee",
    "latte",
    "meal",
    "dish*",
    "menu",
    "taste",
    "tasty",
    "delicious",
    "portion*",
    "drink*",
    "cake",
    "breakfast",
    "lunch",
    "order",
    "order was wrong",
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
    "treatment",
    "team",
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
    "floor",
    "toilet*",
  ],
};
