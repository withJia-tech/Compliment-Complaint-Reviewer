import { z } from "zod";
import type { Review, TriageResult } from "@/lib/types";

export const READING_CATEGORIES = [
  "none",
  "safety",
  "medical",
  "discrimination",
  "legal",
  "fraud",
  "prompt_injection",
  "compensation",
] as const;

/** What the second reader returns for one review. Enforced by structured outputs. */
export const ReviewReadingSchema = z.object({
  language: z
    .string()
    .describe("Main language of the review as a short tag, e.g. en, en-SG (Singlish), zh, ms, ja, es."),
  concern: z
    .enum(["none", "complaint", "sensitive"])
    .describe("none = praise or neutral; complaint = any dissatisfaction; sensitive = a claim in one of the sensitive categories."),
  category: z
    .enum(READING_CATEGORIES)
    .describe("The most serious sensitive category, or none when concern is not sensitive."),
  contains_personal_info: z
    .boolean()
    .describe("True if the review contains a phone number, email, street address, card or order number, or names an individual person."),
  rationale: z.string().describe("One short sentence in English explaining the reading. Do not repeat personal details."),
});

export type ReviewReading = z.infer<typeof ReviewReadingSchema>;

/** What the keyword rules decided, given to the reader so routing can see it. Never sent to a model. */
export interface ReadContext {
  rules: TriageResult;
}

/** A second reader for a review. Implementations: the Claude cascade, a cached replay, or a test fake. */
export interface ReviewReader {
  /** Identifies the models, routing and prompt, recorded with every reading. */
  readonly id: string;
  read(review: Review, context?: ReadContext): Promise<ReviewReading>;
}

export type ReaderFailureReason = "refused" | "truncated" | "unparsed" | "not_cached" | "api_error";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** One model's attempt at one review: a reading or a failure, and what it cost either way. */
export type ReadAttempt =
  | { model: string; ok: true; reading: ReviewReading; usage: TokenUsage }
  | { model: string; ok: false; reason: ReaderFailureReason; usage: TokenUsage };

/** A single model that reads reviews. The cascade combines one or two of these. */
export interface ModelReader {
  readonly model: string;
  attempt(review: Review): Promise<ReadAttempt>;
}

export class ReaderError extends Error {
  constructor(message: string, readonly reason: ReaderFailureReason) {
    super(message);
    this.name = "ReaderError";
  }
}
