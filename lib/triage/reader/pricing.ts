import type { TokenUsage } from "@/lib/triage/reader/types";

/**
 * US$ per million tokens (input, output), Anthropic first-party API rates.
 * Checked 2026-11-13. Haiku 5.5's rate applies to prompts up to 100K tokens,
 * which one review always is. A model missing here has no known cost, and the
 * evaluation gate treats an unknown cost as a failure, never as free.
 */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function costUsd(model: string, usage: TokenUsage): number | null {
  const price = PRICES_PER_MTOK[model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

export interface ModelTally extends TokenUsage {
  calls: number;
}

/** What a cascade reader did over a run. */
export interface ReaderStats {
  reads: number;
  escalations: number;
  escalationReasons: Partial<Record<string, number>>;
  byModel: Record<string, ModelTally>;
}

export interface UsageSummary {
  totalCostUsd: number;
  /** NaN when it cannot be computed (no reads, or a model with no known price): never a pass. */
  costPerReviewUsd: number;
  unknownPriceModels: string[];
}

export function usageSummary(stats: ReaderStats): UsageSummary {
  let total = 0;
  const unknownPriceModels: string[] = [];
  for (const [model, tally] of Object.entries(stats.byModel)) {
    const cost = costUsd(model, tally);
    if (cost === null) unknownPriceModels.push(model);
    else total += cost;
  }
  const computable = stats.reads > 0 && unknownPriceModels.length === 0;
  return {
    totalCostUsd: unknownPriceModels.length === 0 ? total : Number.NaN,
    costPerReviewUsd: computable ? total / stats.reads : Number.NaN,
    unknownPriceModels,
  };
}
