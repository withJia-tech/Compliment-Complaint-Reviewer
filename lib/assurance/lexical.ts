// Deterministic lexical nets. These are signals, never sentiment verdicts.

import { ESCALATION_KEYWORDS } from "@/lib/triage/rules";
import type { Span } from "@/lib/assurance/types";

/**
 * Safety trigger (H-14). Runs on the raw review text, independent of any
 * model, so a confused or unavailable model can never stall an escalation.
 * Over-triggering is the accepted cost. Reuses the existing triage keyword
 * lists so there is one source of truth for escalation terms.
 */
const SAFETY_CODES = [
  "escalation_safety",
  "escalation_medical",
  "escalation_discrimination",
] as const satisfies readonly (keyof typeof ESCALATION_KEYWORDS)[];

export interface SafetyTrigger {
  code: (typeof SAFETY_CODES)[number];
  keyword: string;
}

export function safetyTriggers(reviewText: string): SafetyTrigger[] {
  const lower = reviewText.toLowerCase();
  const hits: SafetyTrigger[] = [];
  for (const code of SAFETY_CODES) {
    for (const keyword of ESCALATION_KEYWORDS[code]) {
      if (lower.includes(keyword)) hits.push({ code, keyword });
    }
  }
  return hits;
}

/**
 * Second net for promises and action claims in a draft (Deterministic vs
 * reasoning tab, §4). If this fires where claim extraction found no remedy
 * or action claim, the miss is logged and shown as a warning.
 */
const PROMISE_PATTERNS: RegExp[] = [
  /\brefund\w*/gi,
  /\bvoucher\w*/gi,
  /\bcompensat\w*/gi,
  /\bdiscount\w*/gi,
  /\bfree of charge\b/gi,
  /\bon (?:us|the house)\b/gi,
  /\bwe(?:'ll| will)\b/gi,
  /\bwe(?:'ve| have) (?:checked|investigated|reviewed|looked into|spoken)\b/gi,
  /\bwe investigated\b/gi,
];

export interface PromiseMatch extends Span {
  text: string;
}

export function promiseMatches(draftText: string): PromiseMatch[] {
  const matches: PromiseMatch[] = [];
  for (const pattern of PROMISE_PATTERNS) {
    for (const match of draftText.matchAll(pattern)) {
      const start = match.index ?? 0;
      matches.push({ start, end: start + match[0].length, text: match[0] });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}
