import type { ReplyDrafter } from "@/lib/interfaces/replyDrafter";
import type { ApprovedBusinessFacts, Draft, Review, TriageResult } from "@/lib/types";
import { TEMPLATES_BY_RISK_LEVEL } from "@/lib/drafter/templates";

/**
 * Template-based composition with an explicit fact allow-list. The drafter
 * never free-generates prose from the review text: it selects a template by
 * risk level and fills named slots strictly from `ApprovedBusinessFacts`.
 * Every cited fact key is recorded in `factsUsed`, so a draft can be
 * independently checked for invented facts.
 */
export class TemplateReplyDrafter implements ReplyDrafter {
  draft(review: Review, triage: TriageResult, facts: ApprovedBusinessFacts): Draft {
    const factMap = new Map(facts.facts.map((fact) => [fact.key, fact.value]));
    const factsUsed: string[] = [];

    const cite = (factKey: string): string | null => {
      const value = factMap.get(factKey);
      if (value !== undefined) {
        factsUsed.push(factKey);
        return value;
      }
      return null;
    };

    const template = TEMPLATES_BY_RISK_LEVEL[triage.riskLevel];
    const text = template.build(review, cite);

    return {
      reviewId: review.id,
      text,
      factsUsed,
      templateId: template.id,
      generatedAt: new Date().toISOString(),
    };
  }
}
