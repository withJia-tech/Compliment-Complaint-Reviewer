import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CascadeReviewReader } from "@/lib/triage/reader/cascade";
import { type ModelReader, type ReadAttempt, ReviewReadingSchema } from "@/lib/triage/reader/types";
import type { Review } from "@/lib/types";

/**
 * Saved model attempts, so the demo and the evaluation gate can replay real
 * readings without a key or any cost. Each model's attempts are kept apart and
 * the routing is re-run on replay, so a change in routing, prompt or models
 * cannot silently reuse readings it did not produce.
 */
const UsageSchema = z.object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) });

const RecordedAttemptSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), reading: ReviewReadingSchema, usage: UsageSchema }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["refused", "truncated", "unparsed", "not_cached", "api_error"]),
    usage: UsageSchema,
  }),
]);
export type RecordedAttempt = z.infer<typeof RecordedAttemptSchema>;

export const ReadingCacheFileSchema = z.object({
  format: z.literal(2),
  readerId: z.string().min(1),
  createdAt: z.string(),
  models: z.object({ primary: z.string().min(1), escalation: z.string().min(1).nullable() }),
  /** model -> review key -> attempt */
  attempts: z.record(z.string(), z.record(z.string(), RecordedAttemptSchema)),
});
export type ReadingCacheFile = z.infer<typeof ReadingCacheFileSchema>;

/** Keyed by a hash of the star rating and text, so the file holds no review text. */
export function readingKey(review: Pick<Review, "stars" | "text">): string {
  return createHash("sha256").update(`${review.stars}\n${review.text}`).digest("hex");
}

/** Null when there is no file; throws when the file is not a valid readings file (never replayed). */
export function loadReadingCache(file: string): ReadingCacheFile | null {
  if (!existsSync(file)) return null;
  const parsed = ReadingCacheFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new Error(`${file} is not a valid readings file (format 2). Re-record it with npm run read:golden / read:demo.`);
  }
  return parsed.data;
}

/** Replays one model's recorded attempts. A review it never saw is a failed attempt, not a guess. */
export class CachedModelReader implements ModelReader {
  constructor(
    readonly model: string,
    private readonly attempts: Record<string, RecordedAttempt>,
  ) {}

  async attempt(review: Review): Promise<ReadAttempt> {
    const recorded = this.attempts[readingKey(review)];
    if (!recorded) return { model: this.model, ok: false, reason: "not_cached", usage: { inputTokens: 0, outputTokens: 0 } };
    return { ...recorded, model: this.model };
  }
}

/** Rebuilds the cascade a file was recorded with, reading from the file instead of the API. */
export function cascadeFromCache(cache: ReadingCacheFile): CascadeReviewReader {
  const { primary, escalation } = cache.models;
  return new CascadeReviewReader(
    new CachedModelReader(primary, cache.attempts[primary] ?? {}),
    escalation ? new CachedModelReader(escalation, cache.attempts[escalation] ?? {}) : null,
  );
}

export function cascadeFromFile(file: string): CascadeReviewReader {
  const cache = loadReadingCache(file);
  if (!cache) throw new Error(`No reading cache at ${file}. Run "npm run read:demo -- --yes" with your key first.`);
  return cascadeFromCache(cache);
}

/** Wraps live model readers and records every attempt they make, for saving as a readings file. */
export class ReadingRecorder {
  private readonly attempts: Record<string, Record<string, RecordedAttempt>> = {};
  private readonly models: string[] = [];

  wrap(inner: ModelReader): ModelReader {
    this.models.push(inner.model);
    return {
      model: inner.model,
      attempt: async (review: Review) => {
        const attempt = await inner.attempt(review);
        const { model: _model, ...recorded } = attempt;
        (this.attempts[inner.model] ??= {})[readingKey(review)] = recorded;
        return attempt;
      },
    };
  }

  /** `reader` must be the cascade built from this recorder's wrapped readers. */
  save(file: string, reader: CascadeReviewReader): void {
    const [primary, escalation] = this.models;
    const cache: ReadingCacheFile = {
      format: 2,
      readerId: reader.id,
      createdAt: new Date().toISOString(),
      models: { primary, escalation: escalation ?? null },
      attempts: this.attempts,
    };
    ReadingCacheFileSchema.parse(cache);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(cache, null, 2)}\n`);
  }
}
