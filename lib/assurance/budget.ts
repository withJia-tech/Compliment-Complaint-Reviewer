// Token budgets per model stage (Deterministic vs reasoning tab, §6.3).
// On breach a stage abstains with `budget_exceeded`. It never truncates:
// a truncated draft can lose a qualifier and turn into a promise.

export type ModelStage =
  | "interpretation"
  | "claim_extraction"
  | "suggested_edit"
  | "post_it_fallback"
  | "rubric_prescore";

export interface StageBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
}

/** PROPOSED placeholders; the owner signs them off. */
export const PROPOSED_STAGE_BUDGETS: Record<ModelStage, StageBudget> = {
  interpretation: { maxInputTokens: 6000, maxOutputTokens: 1500 },
  claim_extraction: { maxInputTokens: 4000, maxOutputTokens: 1000 },
  suggested_edit: { maxInputTokens: 6000, maxOutputTokens: 1200 },
  post_it_fallback: { maxInputTokens: 2000, maxOutputTokens: 450 }, // 150 per note × 3
  rubric_prescore: { maxInputTokens: 6000, maxOutputTokens: 800 },
};

/** PROPOSED: whole case, every stage and retry. */
export const PROPOSED_CASE_TOKEN_CEILING = 20_000;

export interface ModelCallUsage {
  stage: ModelStage;
  inputTokens: number;
  outputTokens: number;
  /** Provider stop reason, e.g. "end_turn" or "max_tokens". */
  stopReason: string;
}

export type BudgetVerdict = { ok: true } | { ok: false; abstain: "budget_exceeded"; detail: string };

export function checkModelCall(
  usage: ModelCallUsage,
  budgets: Record<ModelStage, StageBudget> = PROPOSED_STAGE_BUDGETS,
): BudgetVerdict {
  const budget = budgets[usage.stage];
  if (usage.stopReason === "max_tokens") {
    return { ok: false, abstain: "budget_exceeded", detail: `${usage.stage}: output was truncated` };
  }
  if (usage.inputTokens > budget.maxInputTokens) {
    return {
      ok: false,
      abstain: "budget_exceeded",
      detail: `${usage.stage}: input ${usage.inputTokens} > ${budget.maxInputTokens}`,
    };
  }
  if (usage.outputTokens > budget.maxOutputTokens) {
    return {
      ok: false,
      abstain: "budget_exceeded",
      detail: `${usage.stage}: output ${usage.outputTokens} > ${budget.maxOutputTokens}`,
    };
  }
  return { ok: true };
}

/** Accumulates every call in one case, retries included. */
export class CaseBudget {
  private used = 0;
  readonly calls: ModelCallUsage[] = [];

  constructor(readonly ceiling: number = PROPOSED_CASE_TOKEN_CEILING) {}

  get tokensUsed(): number {
    return this.used;
  }

  /** Records the call and returns whether the case may continue. */
  record(usage: ModelCallUsage, budgets?: Record<ModelStage, StageBudget>): BudgetVerdict {
    this.calls.push(usage);
    this.used += usage.inputTokens + usage.outputTokens;
    const stage = checkModelCall(usage, budgets);
    if (!stage.ok) return stage;
    if (this.used > this.ceiling) {
      return { ok: false, abstain: "budget_exceeded", detail: `case total ${this.used} > ${this.ceiling}` };
    }
    return { ok: true };
  }
}
