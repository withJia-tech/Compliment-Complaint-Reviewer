import type { RiskLevel, Review } from "@/lib/types";

/**
 * `cite` only ever returns a value present in the approved facts file (see
 * ReplyDrafter). A template must never fall back to inventing a fact —
 * when a slot has no matching approved fact, it falls back to a generic,
 * fact-free phrase instead.
 */
export type Cite = (factKey: string) => string | null;

export interface ReplyTemplate {
  id: string;
  build(review: Review, cite: Cite): string;
}

export const TEMPLATES_BY_RISK_LEVEL: Record<RiskLevel, ReplyTemplate> = {
  low: {
    id: "positive_thanks",
    build: (review, cite) =>
      `Thank you for the kind words, ${review.author}! We're thrilled you enjoyed your visit to ${
        cite("business_name") ?? "us"
      }. We hope to see you again soon.`,
  },
  medium: {
    id: "mixed_acknowledge",
    build: (review, cite) =>
      `Thank you for your honest feedback, ${review.author}. We're glad parts of your experience went well, and we take the rest seriously. Please reach us at ${
        cite("contact.phone") ?? cite("contact.email") ?? "our front desk"
      } so we can follow up directly.`,
  },
  high: {
    id: "negative_acknowledge_no_promise",
    build: (review, cite) =>
      `We're sorry to hear about your experience, ${review.author}. This isn't the standard we hold ourselves to, and we'd like to understand what happened. Please contact us at ${
        cite("contact.phone") ?? cite("contact.email") ?? "our front desk"
      } so our team can look into this.`,
  },
  escalate: {
    id: "escalation_hold",
    build: (review) =>
      `Thank you for bringing this to our attention, ${review.author}. This is a serious matter and our team is reviewing it directly — we will follow up with you as soon as possible.`,
  },
};
