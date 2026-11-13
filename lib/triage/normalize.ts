/**
 * Text normalisation for keyword matching only. The original review text is
 * never changed or stored in this form.
 *
 * It undoes the cheap ways a claim slips past word-boundary matching:
 * - zero-width and soft-hyphen characters inside a word ("l​aw​suit")
 * - letters spaced or dotted apart ("l a w y e r", "s.u.e")
 * - digits standing in for letters inside a word ("f00d p0isoning", "reacti0n")
 */
const INVISIBLE = /[​-‍⁠﻿­]/g;
const SPACED_LETTERS = /\b(?:[A-Za-z][ .\-_*]){2,}[A-Za-z]\b/g;
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

export function normalizeForMatching(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(SPACED_LETTERS, (run) => run.replace(/[ .\-_*]/g, ""))
    // Only digits sitting between letters ("f00d", "reacti0n"), so "5pm" or "2nd" stay as they are.
    .replace(/(?<=[A-Za-z])[013457@$]+(?=[A-Za-z])/g, (run) => run.replace(/./g, (ch) => LEET[ch]));
}

/** The text to match against: the original plus its normalised form when they differ. */
export function matchableText(text: string): string {
  const normalized = normalizeForMatching(text);
  return normalized === text ? text : `${text}\n${normalized}`;
}
