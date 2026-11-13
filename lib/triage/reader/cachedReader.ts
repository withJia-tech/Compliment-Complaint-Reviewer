import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ReaderError, type ReviewReader, type ReviewReading } from "@/lib/triage/reader/types";
import type { Review } from "@/lib/types";

/**
 * Saved readings, keyed by a hash of the star rating and text, so a demo or
 * an evaluation can replay real model readings without a key or any cost.
 */
export interface ReadingCacheFile {
  readerId: string;
  createdAt: string;
  readings: Record<string, ReviewReading>;
}

export function readingKey(review: Pick<Review, "stars" | "text">): string {
  return createHash("sha256").update(`${review.stars}\n${review.text}`).digest("hex");
}

export function loadReadingCache(file: string): ReadingCacheFile | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as ReadingCacheFile;
}

/** Replays readings from a cache file. A review not in the cache fails closed. */
export class CachedReviewReader implements ReviewReader {
  readonly id: string;
  private readonly readings: Record<string, ReviewReading>;

  constructor(cache: ReadingCacheFile) {
    this.id = `${cache.readerId} (cached)`;
    this.readings = cache.readings;
  }

  static fromFile(file: string): CachedReviewReader {
    const cache = loadReadingCache(file);
    if (!cache) throw new Error(`No reading cache at ${file}. Run "npm run read:demo" with your key first.`);
    return new CachedReviewReader(cache);
  }

  async read(review: Review): Promise<ReviewReading> {
    const reading = this.readings[readingKey(review)];
    if (!reading) throw new ReaderError("No saved reading for this review", "not_cached");
    return reading;
  }
}

/** Wraps a live reader and saves every successful reading to a cache file. */
export class RecordingReviewReader implements ReviewReader {
  private readonly cache: ReadingCacheFile;

  constructor(private readonly inner: ReviewReader, private readonly file: string) {
    this.cache = { readerId: inner.id, createdAt: new Date().toISOString(), readings: {} };
  }

  get id(): string {
    return this.inner.id;
  }

  async read(review: Review): Promise<ReviewReading> {
    const reading = await this.inner.read(review);
    this.cache.readings[readingKey(review)] = reading;
    return reading;
  }

  save(): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify(this.cache, null, 2)}\n`);
  }
}
