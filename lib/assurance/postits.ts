// Pre-send post-it notes (Hospitality addendum §4; Deterministic vs
// reasoning tab, §2 rows 10–11). Selection and wording are deterministic:
// each note maps to a failed or warned check, ranked by severity, ties broken
// by the aspect's order in the review, capped at three. Notes are internal
// and must never appear in the published reply (checked in approval.ts).

import type { AssuranceCheck, InterpretationResult, PostIt } from "@/lib/assurance/types";

export const MAX_POST_ITS = 3;

interface Template {
  severity: number;
  render: (aspect: string | null) => string;
}

const aspectWord = (aspect: string | null) => (aspect ?? "this point").replace("_", " ");

export const POST_IT_TEMPLATES: Record<string, Template> = {
  "C-HUMOUR": {
    severity: 98,
    render: () => "This review raises a serious allegation. Keep the tone plain and follow the escalation process.",
  },
  "C-REMEDY": {
    severity: 95,
    render: () => "This promise isn't in the current recovery catalogue. Remove it or hold it for manager approval.",
  },
  "C-PII": {
    severity: 92,
    render: () => "Remove the guest's or a staff member's personal details before this goes out.",
  },
  "C-FALSE-PRAISE": {
    severity: 90,
    render: (aspect) => `The review criticises the ${aspectWord(aspect)}. Keep any genuine compliment, but don't say they enjoyed it.`,
  },
  "C-ACTION": {
    severity: 85,
    render: () => "This says an action was taken, but no matching record exists. Use it only once the action is recorded.",
  },
  "C-COVERAGE": {
    severity: 80,
    render: (aspect) => `The main concern is the ${aspectWord(aspect)}. Address it before anything else.`,
  },
  "C-FACT-SUPPORT": {
    severity: 75,
    render: () => "This statement isn't in the approved facts. Check it against your policy records first.",
  },
  "C-PROMISE-NET": {
    severity: 60,
    render: () => "This wording may read as a promise. Confirm it's authorised, or soften it.",
  },
  "C-ASPECTS": {
    severity: 50,
    render: (aspect) => `The review also mentions the ${aspectWord(aspect)}. Acknowledge it without implying every cause is confirmed.`,
  },
  "C-LENGTH": {
    severity: 30,
    render: () => "This reply is outside the usual length for this review. Check each added sentence is supported.",
  },
};

export function selectPostIts(checks: AssuranceCheck[], interpretation: InterpretationResult): PostIt[] {
  const candidates = new Map<string, { check: AssuranceCheck; template: Template }>();
  for (const check of checks) {
    if (check.result === "pass") continue;
    const template = POST_IT_TEMPLATES[check.check_id];
    if (!template) continue;
    const existing = candidates.get(check.check_id);
    // One note per check: keep the finding on the earliest aspect.
    const order = (c: AssuranceCheck) => c.aspect_index ?? Number.MAX_SAFE_INTEGER;
    const failsFirst = (c: AssuranceCheck) => (c.result === "fail" ? 0 : 1);
    if (
      !existing ||
      failsFirst(check) < failsFirst(existing.check) ||
      (failsFirst(check) === failsFirst(existing.check) && order(check) < order(existing.check))
    ) {
      candidates.set(check.check_id, { check, template });
    }
  }

  return [...candidates.values()]
    .sort(
      (a, b) =>
        b.template.severity - a.template.severity ||
        (a.check.aspect_index ?? Number.MAX_SAFE_INTEGER) - (b.check.aspect_index ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, MAX_POST_ITS)
    .map(({ check, template }) => {
      const aspect =
        check.aspect_index !== null ? (interpretation.aspects[check.aspect_index]?.aspect ?? null) : null;
      return {
        id: `PI-${check.check_id}`,
        check_id: check.check_id,
        severity: template.severity,
        text: template.render(aspect),
      };
    });
}
