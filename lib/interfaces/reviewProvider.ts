import type { ProviderPublishResult, Review } from "@/lib/types";

/**
 * Production contract for talking to a review source (Google Business
 * Profile in the real integration; fixture data in this prototype).
 */
export interface ReviewProvider {
  /** New or updated reviews since the given ISO 8601 timestamp. */
  listSince(since: string): Promise<Review[]>;
  getById(reviewId: string): Promise<Review | null>;
  publishReply(reviewId: string, text: string): Promise<ProviderPublishResult>;
}
