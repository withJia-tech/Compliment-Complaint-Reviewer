import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { READER_PROMPT_VERSION, READER_SYSTEM_PROMPT, readerUserMessage } from "@/lib/triage/reader/prompt";
import { ReaderError, type ReviewReader, type ReviewReading, ReviewReadingSchema } from "@/lib/triage/reader/types";
import type { Review } from "@/lib/types";

export const DEFAULT_READER_MODEL = "claude-opus-5-5";

/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`). */
function supportsServerFallback(model: string): boolean {
  return /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
}

export interface ReaderUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Reads a review with Claude and returns a structured reading.
 *
 * Bring your own key: the client takes credentials from the environment
 * (ANTHROPIC_API_KEY), never from code or the store. The model defaults to
 * Claude Opus 5.5 and can be changed with CCR_READER_MODEL.
 */
export class ClaudeReviewReader implements ReviewReader {
  readonly model: string;
  readonly usage: ReaderUsage = { inputTokens: 0, outputTokens: 0 };
  private readonly client: Anthropic;

  constructor(options: { client?: Anthropic; model?: string } = {}) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? process.env.CCR_READER_MODEL ?? DEFAULT_READER_MODEL;
  }

  get id(): string {
    return `${this.model}:${READER_PROMPT_VERSION}`;
  }

  async read(review: Review): Promise<ReviewReading> {
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
    } catch (error) {
      const detail = error instanceof Anthropic.APIError ? `${error.status ?? "network"}` : "unknown";
      throw new ReaderError(`Claude request failed (${detail})`, "api_error");
    }

    this.usage.inputTokens += response.usage.input_tokens;
    this.usage.outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") throw new ReaderError("Claude declined to read this review", "refused");
    if (response.stop_reason === "max_tokens") throw new ReaderError("Reading was cut off", "truncated");
    if (!response.parsed_output) throw new ReaderError("Reading did not match the schema", "unparsed");
    return response.parsed_output;
  }
}
