import type {
  ProviderPublishResult,
  PublishReconciliation,
  Review,
} from "@/lib/types";

/**
 * Production contract for talking to a review source (Google Business
 * Profile in the real integration; fixture data in this prototype).
 */
export interface ReviewProvider {
  /** New or updated reviews since the given ISO 8601 timestamp. */
  listSince(since: string): Promise<Review[]>;
  getById(reviewId: string): Promise<Review | null>;
  /** Optional until a real provider can establish a conclusive outcome. Never retries a write. */
  reconcileReply?(
    reviewId: string,
    attemptId: string,
  ): Promise<PublishReconciliation>;
  /** success:false means confirmed not published; exceptions/ambiguous responses mean unknown. */
  publishReply(reviewId: string, text: string): Promise<ProviderPublishResult>;
}
