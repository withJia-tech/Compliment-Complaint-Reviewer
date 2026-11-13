import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { READER_FINGERPRINT, READER_PROMPT_VERSION, READER_SYSTEM_PROMPT, readerUserMessage } from "@/lib/triage/reader/prompt";
import {
  type ModelReader,
  type ReadAttempt,
  ReaderError,
  type ReviewReader,
  type ReviewReading,
  ReviewReadingSchema,
  type TokenUsage,
} from "@/lib/triage/reader/types";
import type { Review } from "@/lib/types";

/** Reads every review. Cheap enough to read all of them (B13). */
export const DEFAULT_READER_MODEL = "claude-haiku-5-5";
/** Reads only the reviews the routing rules escalate. */
export const DEFAULT_ESCALATION_MODEL = "claude-sonnet-5-5";

/**
 * Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
 * Haiku 5.5 has none: a Haiku refusal comes back as a failed attempt, and the
 * cascade escalates it to the stronger model.
 */
function supportsServerFallback(model: string): boolean {
  return /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
}

const NO_TOKENS: TokenUsage = { inputTokens: 0, outputTokens: 0 };

/**
 * Reads a review with one Claude model and returns a structured reading.
 *
 * Bring your own key: the client takes credentials from the environment
 * (ANTHROPIC_API_KEY), never from code or the store.
 */
export class ClaudeReviewReader implements ModelReader, ReviewReader {
  readonly model: string;
  /** Running total for this instance, for the read scripts' summaries. */
  readonly usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private readonly client: Anthropic;

  constructor(options: { client?: Anthropic; model?: string } = {}) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? DEFAULT_READER_MODEL;
  }

  get id(): string {
    return `${this.model}:${READER_PROMPT_VERSION}@${READER_FINGERPRINT}`;
  }

  /** Never throws: an API error, refusal or bad output is a failed attempt. */
  async attempt(review: Review): Promise<ReadAttempt> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 4096,
        ...(supportsServerFallback(this.model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
        output_config: { effort: "low", format: betaZodOutputFormat(ReviewReadingSchema) },
        system: READER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: readerUserMessage(review.stars, review.text) }],
      });
    } catch {
      // The error detail is not logged: it can echo request content.
      return { model: this.model, ok: false, reason: "api_error", usage: { ...NO_TOKENS } };
    }

    const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;

    if (response.stop_reason === "refusal") return { model: this.model, ok: false, reason: "refused", usage };
    if (response.stop_reason === "max_tokens") return { model: this.model, ok: false, reason: "truncated", usage };
    if (!response.parsed_output) return { model: this.model, ok: false, reason: "unparsed", usage };
    return { model: this.model, ok: true, reading: response.parsed_output, usage };
  }

  async read(review: Review): Promise<ReviewReading> {
    const result = await this.attempt(review);
    if (!result.ok) throw new ReaderError(`Claude could not read this review (${result.reason})`, result.reason);
    return result.reading;
  }
}
