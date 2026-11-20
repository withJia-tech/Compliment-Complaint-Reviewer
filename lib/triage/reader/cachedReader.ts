import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, linkSync, unlinkSync, openSync, fsyncSync, closeSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CascadeReviewReader, cascadeReaderId } from "./cascade";
import { type ModelReader, type ReadAttempt, ReviewReadingSchema } from "./types";
import type { Review } from "@/lib/types";

export const OMITTED_RATIONALE = "Rationale omitted from recording.";
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const usage = z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }).strict();
const metadata = { observedModel: z.string().min(1).optional(), responseId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/).optional(), usageKnown: z.boolean() };
const RecordedAttemptSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), reading: ReviewReadingSchema, usage, ...metadata }).strict(),
  z.object({ ok: z.literal(false), reason: z.enum(["refused", "truncated", "unparsed", "not_cached", "api_error", "invalid_response"]), usage, ...metadata }).strict(),
]).superRefine((attempt, ctx) => {
  if (attempt.ok && (!attempt.usageKnown || !attempt.observedModel || !attempt.responseId || attempt.usage.inputTokens <= 0 || attempt.usage.outputTokens <= 0 || attempt.reading.rationale !== OMITTED_RATIONALE)) {
    ctx.addIssue({ code: "custom", message: "Successful recording lacks validated identity/usage or retains prose" });
  }
});
export type RecordedAttempt = z.infer<typeof RecordedAttemptSchema>;

export const ExecutionEvidenceSchema = z.object({
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  implementationSha256: hash,
  datasetSha256: hash,
  reviewSetSha256: hash,
  requestSha256: hash,
  maxCostUsd: z.number().finite().positive(),
  maxCalls: z.number().int().positive(),
  tokenCountCalls: z.number().int().nonnegative(),
  generationCalls: z.number().int().nonnegative(),
  completed: z.boolean(),
}).strict();
export type ExecutionEvidence = z.infer<typeof ExecutionEvidenceSchema>;

export const ReadingCacheFileSchema = z.object({
  format: z.literal(3),
  readerId: z.string().min(1),
  createdAt: z.iso.datetime(),
  models: z.object({ primary: z.string().min(1), escalation: z.string().min(1).nullable() }).strict(),
  evidence: ExecutionEvidenceSchema.optional(), // Required for golden gate; synthetic unit caches have none.
  attempts: z.record(z.string(), z.record(hash, RecordedAttemptSchema)),
}).strict().superRefine((cache, ctx) => {
  const { primary, escalation } = cache.models;
  if (primary === escalation || cache.readerId !== cascadeReaderId(primary, escalation)) ctx.addIssue({ code: "custom", message: "Declared and reconstructed reader identities disagree" });
  for (const [model, attempts] of Object.entries(cache.attempts)) {
    if (![primary, escalation].includes(model)) ctx.addIssue({ code: "custom", message: "Unexpected model in recording" });
    for (const attempt of Object.values(attempts)) {
      if (attempt.ok && attempt.observedModel !== model) ctx.addIssue({ code: "custom", message: "Observed model differs from recorded model" });
    }
  }
});
export type ReadingCacheFile = z.infer<typeof ReadingCacheFileSchema>;

export function readingKey(review: Pick<Review, "stars" | "text">): string {
  return createHash("sha256").update(`${review.stars}\n${review.text}`).digest("hex");
}
export function loadReadingCache(file: string): ReadingCacheFile | null {
  if (!existsSync(file)) return null;
  let parsed;
  try { parsed = ReadingCacheFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8"))); }
  catch { throw new Error("Invalid readings file; JSON could not be validated"); }
  if (!parsed.success) throw new Error("Not a valid readings file (format 3): identity, usage or schema validation failed");
  return parsed.data;
}
export class CachedModelReader implements ModelReader {
  constructor(readonly model: string, private readonly attempts: Record<string, RecordedAttempt>) {}
  async attempt(review: Review): Promise<ReadAttempt> {
    const recorded = this.attempts[readingKey(review)];
    if (!recorded) return { model: this.model, ok: false, reason: "not_cached", usageKnown: true, usage: { inputTokens: 0, outputTokens: 0 } };
    return { ...recorded, model: this.model };
  }
}
export function cascadeFromCache(input: ReadingCacheFile): CascadeReviewReader {
  const result = ReadingCacheFileSchema.safeParse(input);
  if (!result.success) throw new Error("Invalid cache identity or attempts");
  const cache = result.data, { primary, escalation } = cache.models;
  return new CascadeReviewReader(new CachedModelReader(primary, cache.attempts[primary] ?? {}), escalation ? new CachedModelReader(escalation, cache.attempts[escalation] ?? {}) : null);
}
export function cascadeFromFile(file: string): CascadeReviewReader {
  const cache = loadReadingCache(file);
  if (!cache) throw new Error("No reading cache. A separately approved recording run is required.");
  return cascadeFromCache(cache);
}

/** Atomic visibility and no clobber, including a destination created after the preflight. */
export function writeNewRecording(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = path.join(path.dirname(file), `.recording-${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, content, { flag: "wx", mode: 0o600 });
    const fd = openSync(temp, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    linkSync(temp, file); // Unlike rename, link refuses to replace an existing destination.
  } finally { if (existsSync(temp)) unlinkSync(temp); }
}

export class ReadingRecorder {
  private readonly attempts: Record<string, Record<string, RecordedAttempt>> = {};
  private readonly models: string[] = [];
  wrap(inner: ModelReader): ModelReader {
    this.models.push(inner.model);
    return { model: inner.model, attempt: async (review) => {
      const key = readingKey(review);
      if (this.attempts[inner.model]?.[key]) throw new Error("Duplicate recording key; refusing to overwrite an attempt");
      const attempt = await inner.attempt(review);
      const { model: _model, ...recorded } = attempt;
      // Never persist model prose. The scored labels and provider identity/usage are sufficient for replay.
      const sanitized = { ...recorded, usageKnown: recorded.usageKnown ?? false,
        ...(recorded.ok ? { reading: { ...recorded.reading, rationale: OMITTED_RATIONALE } } : {}) };
      const parsed = RecordedAttemptSchema.safeParse(sanitized);
      if (!parsed.success) throw new Error("Attempt cannot be recorded safely");
      (this.attempts[inner.model] ??= {})[key] = parsed.data;
      return attempt;
    } };
  }
  snapshot(reader: CascadeReviewReader, evidence?: ExecutionEvidence): ReadingCacheFile {
    const [primary, escalation] = this.models;
    const candidate = { format: 3, readerId: reader.id, createdAt: new Date().toISOString(), models: { primary, escalation: escalation ?? null }, ...(evidence ? { evidence } : {}), attempts: this.attempts };
    const parsed = ReadingCacheFileSchema.safeParse(candidate);
    if (!parsed.success) throw new Error("Recording identity or metadata invalid");
    return parsed.data;
  }
  save(file: string, reader: CascadeReviewReader, evidence?: ExecutionEvidence): void {
    writeNewRecording(file, `${JSON.stringify(this.snapshot(reader, evidence), null, 2)}\n`);
  }
}
