// Incident operations types (Incident operations engineering tab, §1–3).
// The incident loop is human-run; code enforces who may do what, and when.

export type IncidentState = "registered" | "safety_screened" | "reconstructing" | "verifying" | "closed";

export type Role =
  | "floor_supervisor"
  | "duty_manager"
  | "kitchen_lead"
  | "shift_lead"
  | "owner"
  | "manager"
  | "operations_lead"
  | "system";

export interface Actor {
  kind: "human" | "code" | "model";
  role: Role;
  id: string;
}

export type ResponseStatus = "not_started" | "drafting" | "approved" | "published" | "not_needed";
export type MitigationStatus = "not_started" | "planned" | "done" | "not_feasible";

export type AssertionStatus = "reported" | "corroborated" | "contradicted" | "disputed" | "unknown";
export type SourceType = "guest" | "staff" | "system";

export interface EvidenceRef {
  source: string;
  source_version: string;
  captured_at: string;
  /** What this source can establish, e.g. "order timing", never "tone". */
  establishes: string;
  limitations: string;
}

export interface StatusChange {
  from: AssertionStatus;
  to: AssertionStatus;
  actor: Actor;
  reason: string;
  at: string;
}

export interface Assertion {
  assertion_id: string;
  incident_id: string;
  source_type: SourceType;
  /** Minimised text or an excerpt reference. */
  claim: string;
  evidence_refs: EvidenceRef[];
  status: AssertionStatus;
  status_set_by: Actor;
  status_reason: string;
  history: StatusChange[];
}

export interface TransitionEvent {
  incident_id: string;
  from: IncidentState;
  to: IncidentState;
  actor: Actor;
  at: string;
  guard_results: string[];
  reason: string;
}

export interface RejectedTransition {
  incident_id: string;
  from: IncidentState;
  to: IncidentState;
  actor: Actor;
  at: string;
  failures: string[];
}

export interface Incident {
  incident_id: string;
  location_id: string;
  /** Outlet-defined issue category. */
  category: string;
  state: IncidentState;
  safety_outcome: "high_risk" | "not_high_risk" | null;
  escalation_id: string | null;
  /** True while a high-risk escalation is not yet resolved. */
  open_high_risk_escalation: boolean;
  response: { status: ResponseStatus; reason: string | null };
  mitigation: { status: MitigationStatus; reason: string | null; outcome: string | null };
  assertions: Assertion[];
  verification_evidence: string[];
  corrective_action_ids: string[];
  /** Append-only. Never edited; retention redacts content, not the event. */
  events: TransitionEvent[];
  /** Append-only log of refused transitions. */
  rejections: RejectedTransition[];
}
