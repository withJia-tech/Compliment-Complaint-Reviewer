import { z } from "zod";
import type { Review } from "@/lib/types";

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

/** A second reader for a review. Implementations: Claude, a cached replay, or a test fake. */
export interface ReviewReader {
  /** Identifies the model and prompt version, recorded with every reading. */
  readonly id: string;
  read(review: Review): Promise<ReviewReading>;
}

export class ReaderError extends Error {
  constructor(message: string, readonly reason: "refused" | "truncated" | "unparsed" | "not_cached" | "api_error") {
    super(message);
    this.name = "ReaderError";
  }
}
