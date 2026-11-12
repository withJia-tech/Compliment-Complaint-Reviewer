import type { Review } from "@/lib/types";

/**
 * `cite` only ever returns a value present in the approved facts file (see
 * ReplyDrafter). A template must never fall back to inventing a fact —
 * when a slot has no matching approved fact, it falls back to a generic,
 * fact-free phrase instead.
 *
 * No template may promise a refund, voucher, timeline, or remedy. Goodwill is
 * settled out of band (email/WhatsApp) and recorded internally, so it must
 * never appear in the published reply.
 */
export type Cite = (factKey: string) => string | null;

/**
 * The reviewer's name as it should sit inside a sentence. Google shows names
 * like "Elena R.", and every template adds its own punctuation straight after
 * the name, so a trailing full stop is dropped here — once, for all templates —
 * rather than producing "Elena R.. We're glad…" in a published reply. The
 * template's own punctuation then does double duty as the initial's dot.
 */
export function displayName(review: Review): string {
  return review.author.trim().replace(/\.+$/, "");
}

export interface ReplyTemplate {
  id: string;
  build(review: Review, cite: Cite): string;
}

export const POSITIVE_TEMPLATE: ReplyTemplate = {
  id: "positive_thanks",
  build: (review, cite) =>
    `Thank you for the kind words, ${displayName(review)}! We're thrilled you enjoyed your visit to ${
      cite("business_name") ?? "us"
    }. We hope to see you again soon.`,
};

export const MIXED_TEMPLATE: ReplyTemplate = {
  id: "mixed_acknowledge",
  build: (review, cite) =>
    `Thank you for your honest feedback, ${displayName(review)}. We're glad parts of your experience went well, and we take the rest seriously. Please reach us at ${
      cite("contact.phone") ?? cite("contact.email") ?? "our front desk"
    } so we can follow up directly.`,
};

export const NEGATIVE_TEMPLATE: ReplyTemplate = {
  id: "negative_acknowledge_no_promise",
  build: (review, cite) =>
    `We're sorry to hear about your experience, ${displayName(review)}. This isn't the standard we hold ourselves to, and we'd like to understand what happened. Please contact us at ${
      cite("contact.phone") ?? cite("contact.email") ?? "our front desk"
    } so our team can look into this.`,
};

export const SENSITIVE_TEMPLATE: ReplyTemplate = {
  id: "sensitive_personal_response",
  build: (review, cite) =>
    `Thank you for bringing this to our attention, ${displayName(review)}. This is a serious matter and we want to look into it properly. Please contact us at ${
      cite("contact.phone") ?? cite("contact.email") ?? "our front desk"
    } so we can follow up with you directly.`,
};
