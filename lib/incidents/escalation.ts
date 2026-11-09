// Escalation chain with acknowledgement deadlines (Incident operations
// engineering tab, §2). State is plain data with stored timestamps, so a
// restart re-hydrates the same deadlines: there is no in-memory timer to lose.
// Deadlines are owner-set per level; nothing here assumes a number.

import type { Role } from "@/lib/incidents/types";

export interface EscalationLevel {
  role: Role;
  person_id: string;
  /** Owner-set acknowledgement deadline for this level. */
  ack_deadline_minutes: number;
}

export interface EscalationTrigger {
  source: "lexical" | "model" | "human";
  detail: string;
  at: string;
}

export interface EscalationEvent {
  type: "opened" | "trigger_attached" | "advanced" | "acknowledged" | "chain_exhausted";
  at: string;
  detail: string;
}

export interface Escalation {
  escalation_id: string;
  incident_id: string;
  chain: EscalationLevel[];
  level: number;
  level_started_at: string;
  opened_at: string;
  /** When the review was posted at the source, if known (detection lag). */
  source_posted_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  exhausted: boolean;
  triggers: EscalationTrigger[];
  events: EscalationEvent[];
}

export function openEscalation(input: {
  escalation_id: string;
  incident_id: string;
  chain: EscalationLevel[];
  trigger: EscalationTrigger;
  source_posted_at?: string | null;
}): Escalation {
  if (input.chain.length === 0) throw new Error("an escalation needs at least one person in its chain");
  const at = input.trigger.at;
  return {
    escalation_id: input.escalation_id,
    incident_id: input.incident_id,
    chain: input.chain,
    level: 0,
    level_started_at: at,
    opened_at: at,
    source_posted_at: input.source_posted_at ?? null,
    acknowledged_by: null,
    acknowledged_at: null,
    exhausted: false,
    triggers: [input.trigger],
    events: [{ type: "opened", at, detail: `${input.trigger.source}: ${input.trigger.detail}` }],
  };
}

/** A second trigger for the same incident joins the open escalation. */
export function attachTrigger(escalation: Escalation, trigger: EscalationTrigger): Escalation {
  return {
    ...escalation,
    triggers: [...escalation.triggers, trigger],
    events: [...escalation.events, { type: "trigger_attached", at: trigger.at, detail: `${trigger.source}: ${trigger.detail}` }],
  };
}

export function currentDeadline(escalation: Escalation): Date {
  const level = escalation.chain[escalation.level];
  return new Date(Date.parse(escalation.level_started_at) + level.ack_deadline_minutes * 60_000);
}

/**
 * Advance any expired, unacknowledged level. Call on every scheduler pass;
 * it is idempotent for the same `now`.
 */
export function tick(escalation: Escalation, now: Date): Escalation {
  let current = escalation;
  while (!current.acknowledged_by && !current.exhausted && now.getTime() >= currentDeadline(current).getTime()) {
    const deadline = currentDeadline(current).toISOString();
    if (current.level + 1 >= current.chain.length) {
      current = {
        ...current,
        exhausted: true,
        events: [...current.events, { type: "chain_exhausted", at: deadline, detail: "no one acknowledged; alert operations" }],
      };
      break;
    }
    const next = current.chain[current.level + 1];
    current = {
      ...current,
      level: current.level + 1,
      level_started_at: deadline,
      events: [...current.events, { type: "advanced", at: deadline, detail: `to ${next.role} ${next.person_id}` }],
    };
  }
  return current;
}

export type AckResult = { ok: true; escalation: Escalation } | { ok: false; escalation: Escalation; reason: string };

/**
 * Acknowledging means a named person in the chain, at or below the current
 * level, accepts ownership. Viewing a notification is not acknowledgement.
 */
export function acknowledge(escalation: Escalation, personId: string, at: string): AckResult {
  if (escalation.acknowledged_by) return { ok: false, escalation, reason: "already acknowledged" };
  const position = escalation.chain.findIndex((level) => level.person_id === personId);
  if (position < 0 || position > escalation.level) {
    return { ok: false, escalation, reason: "only someone already reached in the chain can acknowledge" };
  }
  return {
    ok: true,
    escalation: {
      ...escalation,
      acknowledged_by: personId,
      acknowledged_at: at,
      events: [...escalation.events, { type: "acknowledged", at, detail: personId }],
    },
  };
}

/** Lags to measure before any minutes-based commitment is made. */
export function lags(escalation: Escalation): { detection_ms: number | null; acknowledgement_ms: number | null } {
  const opened = Date.parse(escalation.opened_at);
  return {
    detection_ms: escalation.source_posted_at ? opened - Date.parse(escalation.source_posted_at) : null,
    acknowledgement_ms: escalation.acknowledged_at ? Date.parse(escalation.acknowledged_at) - opened : null,
  };
}
