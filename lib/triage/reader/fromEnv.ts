import path from "node:path";
import { CachedReviewReader } from "@/lib/triage/reader/cachedReader";
import { ClaudeReviewReader } from "@/lib/triage/reader/claudeReader";
import type { ReviewReader } from "@/lib/triage/reader/types";

export const DEFAULT_DEMO_CACHE = path.join("data", "readings", "demo.json");

/**
 * Chooses the second reader from the environment:
 * - CCR_READER=claude: read live with your own ANTHROPIC_API_KEY
 * - CCR_READER=cache:  replay saved readings (the public demo; no key, no cost)
 * - CCR_READER=off:    keyword rules only
 * Unset: claude if ANTHROPIC_API_KEY is set, otherwise off.
 */
export function readerFromEnv(env: Record<string, string | undefined> = process.env): ReviewReader | null {
  const mode = env.CCR_READER ?? (env.ANTHROPIC_API_KEY ? "claude" : "off");
  switch (mode) {
    case "off":
      return null;
    case "claude":
      return new ClaudeReviewReader();
    case "cache":
      return CachedReviewReader.fromFile(env.CCR_READER_CACHE ?? DEFAULT_DEMO_CACHE);
    default:
      throw new Error(`Unknown CCR_READER "${mode}". Use claude, cache or off.`);
  }
}
