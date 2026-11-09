// Claim records with role-gated status (Incident operations engineering
// tab, §3). Statuses apply to claims, never to people. Code may only record
// what it can know mechanically; judgement statuses need a named human.

import type { Actor, Assertion, AssertionStatus, EvidenceRef, Role, SourceType } from "@/lib/incidents/types";

const SYSTEM: Actor = { kind: "code", role: "system", id: "capture" };

/** Roles that may set the three judgement statuses. */
export const JUDGEMENT_ROLES: readonly Role[] = ["duty_manager", "operations_lead"];
const JUDGEMENT_STATUSES: readonly AssertionStatus[] = ["corroborated", "contradicted", "disputed"];
const CODE_STATUSES: readonly AssertionStatus[] = ["reported", "unknown"];

export interface NewAssertion {
  assertion_id: string;
  incident_id: string;
  source_type: SourceType;
  claim: string;
  evidence_refs?: EvidenceRef[];
}

/** Every claim starts as `reported`, set by code at capture. */
export function captureAssertion(input: NewAssertion): Assertion {
  return {
    assertion_id: input.assertion_id,
    incident_id: input.incident_id,
    source_type: input.source_type,
    claim: input.claim,
    evidence_refs: input.evidence_refs ?? [],
    status: "reported",
    status_set_by: SYSTEM,
    status_reason: "captured",
    history: [],
  };
}

export type StatusResult = { ok: true; assertion: Assertion } | { ok: false; assertion: Assertion; reason: string };

export function setAssertionStatus(
  assertion: Assertion,
  to: AssertionStatus,
  actor: Actor,
  reason: string,
  at: string,
): StatusResult {
  // O-05: no model may write a status, whatever tool it is handed.
  if (actor.kind === "model") return { ok: false, assertion, reason: "models cannot set a claim status" };
  if (!reason.trim()) return { ok: false, assertion, reason: "a status change needs a reason" };

  if (actor.kind === "code" && !CODE_STATUSES.includes(to)) {
    // H-07: code may hold a measured timestamp, but never labels a guest's account contradicted.
    return { ok: false, assertion, reason: `code may set only ${CODE_STATUSES.join(" or ")}` };
  }
  if (actor.kind === "human" && JUDGEMENT_STATUSES.includes(to) && !JUDGEMENT_ROLES.includes(actor.role)) {
    return { ok: false, assertion, reason: `${actor.role} may not set ${to}` };
  }

  return {
    ok: true,
    assertion: {
      ...assertion,
      status: to,
      status_set_by: actor,
      status_reason: reason,
      history: [...assertion.history, { from: assertion.status, to, actor, reason, at }],
    },
  };
}

/** O-08: a source outage turns the affected claim into `unknown`, set by code. */
export function markUnavailable(assertion: Assertion, source: string, at: string): StatusResult {
  return setAssertionStatus(assertion, "unknown", SYSTEM, `source_unavailable:${source}`, at);
}
