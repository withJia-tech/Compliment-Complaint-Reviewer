/**
 * Word-boundary keyword matching.
 *
 * The previous implementation used `text.includes(keyword)`, which matched
 * inside other words: "issue" contains "sue", so any review mentioning an
 * issue was classified as a legal threat; "slippers" matched "slip",
 * "sunburn" matched "burn", "fellow" matched "fell".
 *
 * A pattern ending in `*` matches a prefix (so "injur*" covers injury,
 * injured, injuries) but still has to start on a word boundary.
 */

const cache = new Map<string, RegExp>();

function toRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;

  const isPrefix = pattern.endsWith("*");
  const literal = isPrefix ? pattern.slice(0, -1) : pattern;
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Trailing boundary only when the pattern is a whole word; a prefix pattern
  // deliberately runs on into the rest of the word.
  const source = isPrefix ? `\\b${escaped}` : `\\b${escaped}\\b`;
  const re = new RegExp(source, "i");
  cache.set(pattern, re);
  return re;
}

/** True if `pattern` occurs in `text` as a whole word (or word prefix for `foo*`). */
export function matches(text: string, pattern: string): boolean {
  return toRegExp(pattern).test(text);
}

/** Every pattern from `patterns` that occurs in `text`, in list order. */
export function findHits(text: string, patterns: string[]): string[] {
  return patterns.filter((pattern) => matches(text, pattern));
}

/**
 * Words that flip the meaning of a complaint term right after them, so
 * "no issues at all" and "without any problems" read as praise rather than
 * as the complaints their keywords would otherwise suggest.
 *
 * Applied to complaint keywords only — never to sensitive ones. Missing a
 * real safety or legal claim because of a clumsy negation guard costs far
 * more than carrying one over-cautious flag.
 */
const NEGATORS = ["no", "not", "never", "without", "zero", "hardly", "nothing"];
const FILLERS = ["any", "really", "at all", "a", "the", "much", "too"];

const negatedCache = new Map<string, RegExp>();

function toNegatedRegExp(pattern: string): RegExp {
  const cached = negatedCache.get(pattern);
  if (cached) return cached;

  const isPrefix = pattern.endsWith("*");
  const literal = isPrefix ? pattern.slice(0, -1) : pattern;
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = isPrefix ? "\\w*" : "";
  const neg = NEGATORS.join("|");
  const fill = FILLERS.join("|");
  // e.g. "no issues", "without any problems", "not really a problem"
  const re = new RegExp(`\\b(?:${neg})\\b(?:\\s+(?:${fill})\\b)*\\s+${escaped}${tail}\\b`, "i");
  negatedCache.set(pattern, re);
  return re;
}

/**
 * Complaint hits, dropping any occurrence that is negated. A keyword that
 * appears both negated and plain ("no problems with the food, but a problem
 * with the bill") still counts — only wholly-negated mentions are dropped.
 */
export function findComplaintHits(text: string, patterns: string[]): string[] {
  return patterns.filter((pattern) => {
    if (!matches(text, pattern)) return false;
    if (!toNegatedRegExp(pattern).test(text)) return true;
    // Negated somewhere — keep it only if a non-negated mention also exists.
    const withoutNegated = text.replace(new RegExp(toNegatedRegExp(pattern).source, "gi"), " ");
    return matches(withoutNegated, pattern);
  });
}
