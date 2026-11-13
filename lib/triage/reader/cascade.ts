import { hasLink, isNonLatinScript } from "@/lib/triage/guards";
import type { ReaderStats } from "@/lib/triage/reader/pricing";
import { READER_FINGERPRINT, READER_PROMPT_VERSION } from "@/lib/triage/reader/prompt";
import {
  type ModelReader,
  type ReadAttempt,
  type ReadContext,
  READING_CATEGORIES,
  ReaderError,
  type ReviewReader,
  type ReviewReading,
} from "@/lib/triage/reader/types";
import type { Review } from "@/lib/types";

/**
 * Bump when the escalation rules below change: a saved evaluation run then
 * goes stale, because a replay could route reviews differently.
 */
export const ROUTING_VERSION = "routing-v1";

export type EscalationReason =
  | "primary_failed"
  | "primary_concern"
  | "personal_info"
  | "rules_raised"
  | "no_rules_context"
  | "low_stars"
  | "not_english"
  | "non_latin_script"
  | "link";

/**
 * Deterministic routing (routing-v1). Code decides, not a model: the decision
 * is replayable, auditable and costs nothing.
 *
 * The cheap reading is final only when it cannot be raised further (sensitive,
 * with a category) or when the review is plainly easy: the cheap model saw no
 * concern and no personal info, the keyword rules would quick-approve it, it
 * has four or five stars, it is in English, it has no link and is mostly
 * Latin script. Anything else is read again by the stronger model.
 */
export function escalationReasons(review: Review, first: ReadAttempt, context?: ReadContext): EscalationReason[] {
  if (first.ok && first.reading.concern === "sensitive" && first.reading.category !== "none") return [];

  const reasons: EscalationReason[] = [];
  if (!first.ok) reasons.push("primary_failed");
  if (first.ok && first.reading.concern !== "none") reasons.push("primary_concern");
  if (first.ok && first.reading.contains_personal_info) reasons.push("personal_info");
  if (!context) reasons.push("no_rules_context");
  else if (context.rules.recommendedAction !== "quick_approve") reasons.push("rules_raised");
  if (review.stars <= 3) reasons.push("low_stars");
  if (first.ok && first.reading.language.toLowerCase().split(/[-_]/)[0] !== "en") reasons.push("not_english");
  if (isNonLatinScript(review.text)) reasons.push("non_latin_script");
  if (hasLink(review.text)) reasons.push("link");
  return reasons;
}

const CONCERN_RANK = { none: 0, complaint: 1, sensitive: 2 } as const;

/** Lower index = more serious, the order the prompt asks the model to use. */
function categoryRank(category: ReviewReading["category"]): number {
  return category === "none" ? Number.POSITIVE_INFINITY : READING_CATEGORIES.indexOf(category);
}

/**
 * Merges the cheap and the strong reading so that escalation can only raise:
 * the more serious concern wins, then the more serious category, and personal
 * info found by either model counts.
 */
export function combineReadings(first: ReviewReading, second: ReviewReading): ReviewReading {
  const lead = CONCERN_RANK[second.concern] >= CONCERN_RANK[first.concern] ? second : first;
  const sensitiveCategories = [first, second]
    .filter((r) => r.concern === "sensitive" && r.category !== "none")
    .map((r) => r.category)
    .sort((a, b) => categoryRank(a) - categoryRank(b));
  const category = lead.concern === "sensitive" ? (sensitiveCategories[0] ?? "none") : "none";
  return {
    language: second.language,
    concern: lead.concern,
    category,
    contains_personal_info: first.contains_personal_info || second.contains_personal_info,
    rationale: lead.rationale,
  };
}

export function cascadeReaderId(primaryModel: string, escalationModel: string | null): string {
  const models = escalationModel ? `${primaryModel}>${escalationModel}` : primaryModel;
  return `${ROUTING_VERSION}[${models}]:${READER_PROMPT_VERSION}@${READER_FINGERPRINT}`;
}

/**
 * The second reader (B13): a cheap model reads every review; the routing
 * rules send the uncertain ones to a stronger model. With no escalation model
 * it is a single-model reader.
 *
 * Fails closed: if the read it relies on fails, it throws, and triage holds
 * the review for the owner.
 */
export class CascadeReviewReader implements ReviewReader {
  readonly stats: ReaderStats & { escalationReasons: Partial<Record<EscalationReason, number>> } = {
    reads: 0,
    escalations: 0,
    escalationReasons: {},
    byModel: {},
  };

  constructor(
    private readonly primary: ModelReader,
    private readonly escalation: ModelReader | null,
  ) {}

  get id(): string {
    return cascadeReaderId(this.primary.model, this.escalation?.model ?? null);
  }

  get models(): string[] {
    return this.escalation ? [this.primary.model, this.escalation.model] : [this.primary.model];
  }

  private tally(attempt: ReadAttempt): void {
    const t = (this.stats.byModel[attempt.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0 });
    t.calls += 1;
    t.inputTokens += attempt.usage.inputTokens;
    t.outputTokens += attempt.usage.outputTokens;
  }

  async read(review: Review, context?: ReadContext): Promise<ReviewReading> {
    this.stats.reads += 1;
    const first = await this.primary.attempt(review);
    this.tally(first);

    const reasons = escalationReasons(review, first, context);
    if (reasons.length === 0 || !this.escalation) {
      if (!first.ok) throw new ReaderError(`The reader could not read this review (${first.reason})`, first.reason);
      return first.reading;
    }

    this.stats.escalations += 1;
    for (const reason of reasons) this.stats.escalationReasons[reason] = (this.stats.escalationReasons[reason] ?? 0) + 1;

    const second = await this.escalation.attempt(review);
    this.tally(second);
    // The escalation was needed, so its failure is not covered by the cheap read.
    if (!second.ok) throw new ReaderError(`The escalation reader could not read this review (${second.reason})`, second.reason);
    return first.ok ? combineReadings(first.reading, second.reading) : second.reading;
  }
}
