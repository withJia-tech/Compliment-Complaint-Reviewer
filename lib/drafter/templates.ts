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

function contact(cite: Cite): string {
  const value = cite("contact.phone") ?? cite("contact.email");
  return value
    ? `Please contact us at ${value} so we can follow up directly.`
    : "";
}

export interface ReplyTemplate {
  id: string;
  build(review: Review, cite: Cite): string;
}

export const POSITIVE_TEMPLATE: ReplyTemplate = {
  id: "positive_thanks",
  build: (review, cite) =>
    `Thank you for taking the time to rate ${
      cite("business_name") ?? "our business"
    }, ${displayName(review)}. We appreciate your feedback.`,
};

export const MIXED_TEMPLATE: ReplyTemplate = {
  id: "mixed_acknowledge",
  build: (review, cite) =>
    `Thank you for your honest feedback, ${displayName(review)}. We take your feedback seriously. ${contact(cite)}`,
};

export const NEGATIVE_TEMPLATE: ReplyTemplate = {
  id: "negative_acknowledge_no_promise",
  build: (review, cite) =>
    `We're sorry to hear about your experience, ${displayName(review)}. This isn't the standard we hold ourselves to, and we'd like to understand what happened. ${contact(cite)}`,
};

export const SENSITIVE_TEMPLATE: ReplyTemplate = {
  id: "sensitive_personal_response",
  build: (review, cite) =>
    `Thank you for bringing this to our attention, ${displayName(review)}. This is a serious matter and we want to look into it properly. ${contact(cite)}`,
};
