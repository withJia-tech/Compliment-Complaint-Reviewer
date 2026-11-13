import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { cascadeFromFile } from "@/lib/triage/reader/cachedReader";
import { CascadeReviewReader, cascadeReaderId } from "@/lib/triage/reader/cascade";
import { ClaudeReviewReader, DEFAULT_ESCALATION_MODEL, DEFAULT_READER_MODEL } from "@/lib/triage/reader/claudeReader";
import type { ModelReader, ReviewReader } from "@/lib/triage/reader/types";

export const DEFAULT_DEMO_CACHE = path.join("data", "readings", "demo.json");

type Env = Record<string, string | undefined>;

/** The reader the committed evaluation run must come from: the defaults, never local overrides. */
export function defaultReaderId(): string {
  return cascadeReaderId(DEFAULT_READER_MODEL, DEFAULT_ESCALATION_MODEL);
}

/**
 * The live cascade, from the environment:
 * - CCR_READER_MODEL: the model that reads every review (default Claude Haiku 5.5)
 * - CCR_READER_ESCALATION_MODEL: the model for escalated reviews (default
 *   Claude Sonnet 5.5), or "off" to read with one model only
 * `wrap` lets the read scripts record every attempt.
 */
export function liveReaderFromEnv(
  env: Env = process.env,
  options: { client?: Anthropic; wrap?: (reader: ModelReader) => ModelReader } = {},
): CascadeReviewReader {
  const client = options.client ?? new Anthropic();
  const wrap = options.wrap ?? ((reader: ModelReader) => reader);
  const primary = wrap(new ClaudeReviewReader({ client, model: env.CCR_READER_MODEL || DEFAULT_READER_MODEL }));
  const escalationModel = env.CCR_READER_ESCALATION_MODEL || DEFAULT_ESCALATION_MODEL;
  const escalation = escalationModel === "off" ? null : wrap(new ClaudeReviewReader({ client, model: escalationModel }));
  return new CascadeReviewReader(primary, escalation);
}

/**
 * Chooses the second reader from the environment:
 * - CCR_READER=claude: read live with your own ANTHROPIC_API_KEY
 * - CCR_READER=cache:  replay saved readings (the public demo; no key, no cost)
 * - CCR_READER=off:    keyword rules only
 * Unset: claude if ANTHROPIC_API_KEY is set, otherwise off.
 */
export function readerFromEnv(env: Env = process.env): ReviewReader | null {
  const mode = env.CCR_READER ?? (env.ANTHROPIC_API_KEY ? "claude" : "off");
  switch (mode) {
    case "off":
      return null;
    case "claude":
      return liveReaderFromEnv(env);
    case "cache":
      return cascadeFromFile(env.CCR_READER_CACHE ?? DEFAULT_DEMO_CACHE);
    default:
      throw new Error(`Unknown CCR_READER "${mode}". Use claude, cache or off.`);
  }
}
