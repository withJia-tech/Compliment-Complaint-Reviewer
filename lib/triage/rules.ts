import type { ReasonCode, ReviewTheme } from "@/lib/types";

export type SensitiveReasonCode = Extract<ReasonCode, `sensitive_${string}`>;

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
  "sensitive_prompt_injection",
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
      "stitches",
      "cut my",
      "piece of metal",
      "metal wire",
      "foreign object",
    ],
    weak: ["hurt", "slip", "slipped", "fell", "burn*", "accident", "threat*"],
  },
  sensitive_medical: {
    strong: [
      "food poisoning",
      "allergic reaction",
      "poisoned",
      "hospital",
      "ambulance",
      "threw up",
      "throw up",
      "throwing up",
      "undercooked chicken",
      "raw chicken",
    ],
    weak: ["sick", "vomit*", "ill", "poison", "rash", "swell*", "swollen"],
  },
  sensitive_discrimination: {
    strong: [
      "racist",
      "racism",
      "discriminat*",
      "sexist",
      "homophobic",
      "slur",
      "harass*",
      "my accent",
      "go back to where",
    ],
    weak: [],
  },
  sensitive_legal: {
    strong: [
      "lawsuit",
      "lawyer",
      "attorney",
      "solicitor",
      "legal action",
      "legal team",
      "small claims",
      "in court",
    ],
    weak: ["sue", "sued", "suing"],
  },
  sensitive_fraud: {
    strong: ["scam*", "fraud*", "unauthorised charge", "unauthorized charge", "theft", "stole"],
    weak: ["overcharged", "double charged", "charged twice", "billed for"],
  },
  sensitive_prompt_injection: {
    strong: [
      "ignore previous instructions",
      "ignore all previous instructions",
      "ignore your instructions",
      "disregard previous instructions",
      "disregard all previous instructions",
      "system prompt",
    ],
    weak: [],
  },
  sensitive_compensation: {
    strong: ["compensation", "chargeback", "money back", "dispute the charge", "disput*"],
    weak: ["refund*", "reimburse*"],
  },
};

/**
 * Fixed figures of speech that contain a sensitive keyword but are praise
 * ("stole my heart", "fell in love"). Only these exact phrases are blanked
 * before sensitive matching, so "fell in love with the cake, then fell on the
 * wet floor" still matches the second "fell". Keep this list short and exact:
 * every entry is a way to hide a real claim.
 */
export const IDIOM_EXEMPTIONS = [
  "stole my heart",
  "fell in love",
  "sick beats",
  "burnt cheesecake",
];

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
  "waited",
  "minute wait*",
  "hour wait*",
  "queue*",
  "cold",
  "lukewarm",
  "stale",
  "sticky",
  "ignored",
  "ran out",
  "running out",
  "not good",
  "not great",
  "not worth",
  "rolled his eyes",
  "rolled her eyes",
  "rolled their eyes",
];

/**
 * Discourse markers that introduce a reservation ("great food, but…").
 * A closed class of English words, not tuned to any review: when one appears
 * in a 4-5 star review, a person reads it before replying.
 */
export const CONTRAST_MARKERS = [
  "but",
  "however",
  "although",
  "though",
  "unfortunately",
  "sadly",
  "shame",
  "pity",
  "except",
  "yet",
  "gripe",
  "if only",
  "would have been",
  "could have been",
  "could be better",
];

/**
 * Function words and particles from Malay and Singlish. One hit means the
 * English keyword lists cannot be trusted to have read the review, so it goes
 * to a person instead of the quick-approve lane. Non-Latin scripts (Chinese,
 * Tamil, Japanese, …) are detected separately by script, not by this list.
 */
export const NON_ENGLISH_MARKERS = [
  "tapi",
  "dan",
  "yang",
  "tak",
  "tidak",
  "sudah",
  "sangat",
  "pun",
  "lagi",
  "mesti",
  "boleh",
  "kurang",
  "lah",
  "leh",
  "lor",
  "sia",
  "aiyo",
  "aiyah",
  "walao",
  "somemore",
  "liao",
];

/**
 * Praise words. A 4-5 star review with text must contain at least one of
 * these to be offered as a quick approve: praise has to be present, not just
 * complaint absent.
 */
export const POSITIVE_HINTS = [
  "great",
  "love*",
  "excellent",
  "amazing",
  "best",
  "friendly",
  "recommend*",
  "lovely",
  "good",
  "nice",
  "wonderful",
  "superb",
  "fantastic",
  "delicious",
  "tasty",
  "perfect",
  "yummy",
  "enjoy*",
  "thank*",
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
