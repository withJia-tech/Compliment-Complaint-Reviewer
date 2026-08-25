import type { ReviewProvider } from "@/lib/interfaces/reviewProvider";
import type { ProviderPublishResult, Review } from "@/lib/types";
import fixtureReviews from "@/data/fixtures/reviews.json";

const ALL_FIXTURE_REVIEWS = fixtureReviews as Review[];

/**
 * Fixture-backed ReviewProvider. Simulates a Google Business Profile source
 * over a static JSON file — no network calls, no real publishing.
 */
export class FixtureReviewProvider implements ReviewProvider {
  async listSince(since: string): Promise<Review[]> {
    const sinceTime = new Date(since).getTime();
    return ALL_FIXTURE_REVIEWS.filter((review) => new Date(review.updateTime).getTime() > sinceTime);
  }

  async getById(reviewId: string): Promise<Review | null> {
    return ALL_FIXTURE_REVIEWS.find((review) => review.id === reviewId) ?? null;
  }

  async publishReply(reviewId: string, _text: string): Promise<ProviderPublishResult> {
    return {
      success: true,
      providerReplyId: `fixture-reply-${reviewId}-${Date.now()}`,
      publishedAt: new Date().toISOString(),
    };
  }
}
