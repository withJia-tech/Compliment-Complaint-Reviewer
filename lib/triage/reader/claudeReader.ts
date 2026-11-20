import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { READER_FINGERPRINT, READER_PROMPT_VERSION, READER_SYSTEM_PROMPT, readerUserMessage } from "./prompt";
import { REQUEST_CONTRACT } from "./requestContract";
import type { RunBudget } from "./runBudget";
import { type ModelReader, type ReadAttempt, ReaderError, type ReviewReader, type ReviewReading, ReviewReadingSchema, type TokenUsage } from "./types";
import type { Review } from "@/lib/types";

export const DEFAULT_READER_MODEL = "claude-haiku-5-5";
export const DEFAULT_ESCALATION_MODEL = "claude-sonnet-5-5";

/** Explicit credentials/endpoint/logging: ambient SDK overrides cannot redirect or log reviews. */
export function readerClient(apiKey = process.env.ANTHROPIC_API_KEY): Anthropic {
  return new Anthropic({ apiKey: apiKey ?? "", authToken: null, baseURL: REQUEST_CONTRACT.endpoint,
    maxRetries: 0, timeout: REQUEST_CONTRACT.timeoutMs, logLevel: "off" });
}

export class ClaudeReviewReader implements ModelReader, ReviewReader {
  readonly model: string;
  readonly usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private readonly client: Anthropic;
  private readonly budget?: RunBudget;
  constructor(options: { client?: Anthropic; model?: string; budget?: RunBudget } = {}) {
    this.client = options.client ?? readerClient();
    this.model = options.model ?? DEFAULT_READER_MODEL;
    this.budget = options.budget;
  }
  get id(): string { return `${this.model}:${READER_PROMPT_VERSION}@${READER_FINGERPRINT}`; }

  async attempt(review: Review): Promise<ReadAttempt> {
    const params = {
      model: this.model,
      betas: [REQUEST_CONTRACT.structuredOutputBeta],
      output_config: { effort: REQUEST_CONTRACT.effort, format: betaZodOutputFormat(ReviewReadingSchema) },
      system: READER_SYSTEM_PROMPT,
      messages: [{ role: "user" as const, content: readerUserMessage(review.stars, review.text) }],
    };
    const options = { maxRetries: 0, timeout: REQUEST_CONTRACT.timeoutMs, signal: this.budget?.signal };
    if (this.budget) {
      this.budget.preflight(this.model);
      let inputTokens: number;
      try { inputTokens = (await this.client.beta.messages.countTokens(params, options)).input_tokens; }
      catch { return this.budget.stop("Token-count preflight failed; generation not dispatched"); }
      this.budget.reserve(this.model, inputTokens);
    }

    // Use create, then validate locally: SDK parse exceptions would discard known response usage.
    let response;
    try { response = await this.client.beta.messages.create({ ...params, max_tokens: REQUEST_CONTRACT.maxOutputTokens, service_tier: REQUEST_CONTRACT.serviceTier }, options); }
    catch { return { model: this.model, ok: false, reason: "api_error", usageKnown: false, usage: { inputTokens: 0, outputTokens: 0 } }; }

    const usage = { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens };
    const identityOk = response.model === this.model && typeof response.id === "string" && response.id.length > 0;
    const iterations = response.usage?.iterations ?? [];
    const singleAttempt = iterations.length === 0 || (iterations.length === 1 && iterations[0].type === "message" &&
      iterations[0].model === this.model && iterations[0].input_tokens === usage.inputTokens &&
      iterations[0].output_tokens === usage.outputTokens && !iterations[0].cache_creation_input_tokens && !iterations[0].cache_read_input_tokens);
    const plainUsage = response.usage && singleAttempt && !response.usage.cache_creation_input_tokens && !response.usage.cache_read_input_tokens &&
      (!response.usage.service_tier || response.usage.service_tier === "standard");
    const known = identityOk && plainUsage && Number.isSafeInteger(usage.inputTokens) && usage.inputTokens > 0 && Number.isSafeInteger(usage.outputTokens) && usage.outputTokens >= 0;
    if (!known) return { model: this.model, ok: false, reason: "invalid_response", usageKnown: false, usage: { inputTokens: 0, outputTokens: 0 } };
    const base = { model: this.model, observedModel: response.model, responseId: response.id, usageKnown: true, usage };
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
    if (response.stop_reason === "refusal") return { ...base, ok: false, reason: "refused" };
    if (response.stop_reason === "max_tokens") return { ...base, ok: false, reason: "truncated" };
    if (response.stop_reason !== "end_turn") return { ...base, ok: false, reason: "invalid_response" };
    try {
      const textBlocks = response.content.filter((block) => block.type === "text");
      if (textBlocks.length !== 1 || response.content.some((block) => !["text", "thinking", "redacted_thinking"].includes(block.type))) {
        return { ...base, ok: false, reason: "unparsed" };
      }
      const parsed = ReviewReadingSchema.safeParse(JSON.parse(textBlocks[0].text));
      if (!parsed.success || usage.outputTokens <= 0) return { ...base, ok: false, reason: "unparsed" };
      return { ...base, ok: true, reading: parsed.data };
    } catch { return { ...base, ok: false, reason: "unparsed" }; }
  }
  async read(review: Review): Promise<ReviewReading> {
    const result = await this.attempt(review);
    if (!result.ok) throw new ReaderError(`Reader attempt failed (${result.reason})`, result.reason);
    return result.reading;
  }
}
