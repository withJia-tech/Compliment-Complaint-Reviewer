// Incident lifecycle as an explicit state machine (Incident operations
// engineering tab, §1). Every move is checked against the transition table
// and its guard; anything else is refused and logged. Functions are pure:
// they return a new incident and never mutate the one passed in.

import type {
  Actor,
  Assertion,
  Incident,
  IncidentState,
  MitigationStatus,
  ResponseStatus,
  Role,
  TransitionEvent,
} from "@/lib/incidents/types";

export interface NewIncident {
  incident_id: string;
  location_id: string;
  category: string;
  assertions?: Assertion[];
}

export function createIncident(input: NewIncident): Incident {
  return {
    incident_id: input.incident_id,
    location_id: input.location_id,
    category: input.category,
    state: "registered",
    safety_outcome: null,
    escalation_id: null,
    open_high_risk_escalation: false,
    response: { status: "not_started", reason: null },
    mitigation: { status: "not_started", reason: null, outcome: null },
    assertions: input.assertions ?? [],
    verification_evidence: [],
    corrective_action_ids: [],
    events: [],
    rejections: [],
  };
}

export interface TransitionInput {
  to: IncidentState;
  actor: Actor;
  at: string;
  reason?: string;
  safetyOutcome?: "high_risk" | "not_high_risk";
  escalationId?: string;
  /** For a system reopen: the corrective action the new complaint matched. */
  matchedCorrectiveActionId?: string;
}

export type TransitionResult =
  | { ok: true; incident: Incident; event: TransitionEvent }
  | { ok: false; incident: Incident; failures: string[] };

interface Rule {
  from: IncidentState;
  to: IncidentState;
  humanRoles: Role[];
  /** Whether code (a system actor) may make this move. */
  codeAllowed: boolean;
  guard: (incident: Incident, input: TransitionInput) => string[];
  apply?: (incident: Incident, input: TransitionInput) => Incident;
}

const responseReady = (incident: Incident) =>
  incident.response.status === "approved" ||
  incident.response.status === "published" ||
  (incident.response.status === "not_needed" && !!incident.response.reason);

const mitigationReady = (incident: Incident) =>
  (incident.mitigation.status === "done" && !!incident.mitigation.outcome) ||
  (incident.mitigation.status === "not_feasible" && !!incident.mitigation.reason);

export const TRANSITIONS: Rule[] = [
  {
    from: "registered",
    to: "safety_screened",
    humanRoles: ["duty_manager"],
    codeAllowed: false,
    guard: (_, input) => {
      if (!input.safetyOutcome) return ["safety screen outcome not recorded"];
      if (input.safetyOutcome === "high_risk" && !input.escalationId) return ["high-risk outcome needs an escalation record"];
      return [];
    },
    apply: (incident, input) => ({
      ...incident,
      safety_outcome: input.safetyOutcome ?? null,
      escalation_id: input.escalationId ?? null,
      open_high_risk_escalation: input.safetyOutcome === "high_risk",
    }),
  },
  {
    from: "safety_screened",
    to: "reconstructing",
    humanRoles: ["duty_manager"],
    codeAllowed: false,
    guard: () => [],
  },
  {
    from: "reconstructing",
    to: "verifying",
    humanRoles: ["owner", "manager"],
    codeAllowed: false,
    guard: (incident) => {
      const failures: string[] = [];
      if (incident.assertions.length === 0) failures.push("no claim recorded");
      if (!mitigationReady(incident)) failures.push("mitigation not done, or not feasible without a reason");
      if (!responseReady(incident)) failures.push("response not approved, or not needed without a reason");
      return failures;
    },
  },
  {
    from: "verifying",
    to: "closed",
    humanRoles: ["owner", "manager"],
    codeAllowed: false,
    guard: (incident) => {
      const failures: string[] = [];
      // H-18: a posted reply is never evidence of resolution.
      if (incident.verification_evidence.length === 0) failures.push("no verification evidence attached");
      if (incident.open_high_risk_escalation) failures.push("high-risk escalation still open");
      return failures;
    },
  },
  {
    from: "closed",
    to: "reconstructing",
    humanRoles: ["operations_lead"],
    codeAllowed: true,
    guard: (incident, input) => {
      const failures: string[] = [];
      if (!input.reason?.trim()) failures.push("reopen needs a reason");
      if (input.actor.kind === "code") {
        const matched = input.matchedCorrectiveActionId;
        if (!matched || !incident.corrective_action_ids.includes(matched)) {
          failures.push("system reopen needs a matching corrective action");
        }
      }
      return failures;
    },
    // A recurrence needs a new fix and new verification.
    apply: (incident) => ({
      ...incident,
      mitigation: { status: "not_started", reason: null, outcome: null },
      verification_evidence: [],
    }),
  },
];

function refuse(incident: Incident, input: TransitionInput, failures: string[]): TransitionResult {
  return {
    ok: false,
    failures,
    incident: {
      ...incident,
      rejections: [
        ...incident.rejections,
        { incident_id: incident.incident_id, from: incident.state, to: input.to, actor: input.actor, at: input.at, failures },
      ],
    },
  };
}

export function transition(incident: Incident, input: TransitionInput): TransitionResult {
  // A model never moves the lifecycle (Incident operations tab, §10).
  if (input.actor.kind === "model") return refuse(incident, input, ["models cannot move the incident lifecycle"]);

  const rule = TRANSITIONS.find((candidate) => candidate.from === incident.state && candidate.to === input.to);
  if (!rule) return refuse(incident, input, [`transition ${incident.state} → ${input.to} is not allowed`]);

  const actorAllowed =
    input.actor.kind === "code" ? rule.codeAllowed : rule.humanRoles.includes(input.actor.role);
  if (!actorAllowed) return refuse(incident, input, [`${input.actor.kind}:${input.actor.role} may not make this move`]);

  const failures = rule.guard(incident, input);
  if (failures.length > 0) return refuse(incident, input, failures);

  const event: TransitionEvent = {
    incident_id: incident.incident_id,
    from: incident.state,
    to: input.to,
    actor: input.actor,
    at: input.at,
    guard_results: ["all guards passed"],
    reason: input.reason ?? "",
  };
  const applied = rule.apply ? rule.apply(incident, input) : incident;
  return { ok: true, event, incident: { ...applied, state: input.to, events: [...incident.events, event] } };
}

// ------------------------------------------------------- parallel tracks

export type TrackResult = { ok: true; incident: Incident } | { ok: false; incident: Incident; failures: string[] };

const RESPONSE_MOVES: Record<ResponseStatus, ResponseStatus[]> = {
  not_started: ["drafting", "not_needed"],
  drafting: ["approved", "not_needed"],
  approved: ["published", "drafting"],
  published: [],
  not_needed: ["drafting"],
};

const MITIGATION_MOVES: Record<MitigationStatus, MitigationStatus[]> = {
  not_started: ["planned", "not_feasible"],
  planned: ["done", "not_feasible"],
  done: [],
  not_feasible: ["planned"],
};

export function setResponseStatus(
  incident: Incident,
  to: ResponseStatus,
  actor: Actor,
  reason?: string,
): TrackResult {
  const failures: string[] = [];
  if (actor.kind !== "human" || !["owner", "manager"].includes(actor.role)) failures.push("only the owner or a manager sets the response");
  if (incident.state !== "reconstructing" && incident.state !== "verifying") failures.push(`no response changes while ${incident.state}`);
  if (!RESPONSE_MOVES[incident.response.status].includes(to)) failures.push(`response ${incident.response.status} → ${to} not allowed`);
  if (to === "not_needed" && !reason?.trim()) failures.push("not needed requires a reason");
  if (failures.length > 0) return { ok: false, incident, failures };
  return { ok: true, incident: { ...incident, response: { status: to, reason: reason ?? null } } };
}

export function setMitigationStatus(
  incident: Incident,
  to: MitigationStatus,
  actor: Actor,
  detail?: string,
): TrackResult {
  const failures: string[] = [];
  if (actor.kind !== "human" || !["shift_lead", "duty_manager", "owner", "manager"].includes(actor.role)) {
    failures.push("only a shift lead, duty manager, owner or manager sets mitigation");
  }
  if (incident.state !== "reconstructing") failures.push(`no mitigation changes while ${incident.state}`);
  if (!MITIGATION_MOVES[incident.mitigation.status].includes(to)) failures.push(`mitigation ${incident.mitigation.status} → ${to} not allowed`);
  if ((to === "done" || to === "not_feasible") && !detail?.trim()) {
    failures.push(to === "done" ? "done requires the actual outcome" : "not feasible requires a reason");
  }
  if (failures.length > 0) return { ok: false, incident, failures };
  return {
    ok: true,
    incident: {
      ...incident,
      mitigation: {
        status: to,
        reason: to === "not_feasible" ? (detail ?? null) : null,
        outcome: to === "done" ? (detail ?? null) : null,
      },
    },
  };
}

export function addVerificationEvidence(incident: Incident, evidenceRef: string, actor: Actor): TrackResult {
  if (actor.kind !== "human" || !["owner", "manager"].includes(actor.role)) {
    return { ok: false, incident, failures: ["only the owner or a manager attaches verification evidence"] };
  }
  if (incident.state !== "verifying") return { ok: false, incident, failures: ["evidence is attached while verifying"] };
  return { ok: true, incident: { ...incident, verification_evidence: [...incident.verification_evidence, evidenceRef] } };
}

export function resolveEscalation(incident: Incident, actor: Actor): TrackResult {
  if (actor.kind !== "human" || !["duty_manager", "operations_lead", "owner"].includes(actor.role)) {
    return { ok: false, incident, failures: ["only a duty manager, operations lead or owner resolves an escalation"] };
  }
  return { ok: true, incident: { ...incident, open_high_risk_escalation: false } };
}

export function recordCorrectiveAction(incident: Incident, actionId: string): Incident {
  return incident.corrective_action_ids.includes(actionId)
    ? incident
    : { ...incident, corrective_action_ids: [...incident.corrective_action_ids, actionId] };
}
