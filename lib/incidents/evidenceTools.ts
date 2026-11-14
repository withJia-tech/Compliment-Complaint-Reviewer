// Purpose-bound evidence requests (Incident operations engineering tab, §4).
// The playbook decides which fields a tool may return; code sets the time
// window from the incident. These are request plans for read-only adapters
// that do not exist yet — nothing here calls a POS, KDS or rota system.

export type Playbook = "A_busy_period" | "B_cold_food_handoff" | "C_disputed_conduct";

export const PLAYBOOK_FIELDS: Record<Playbook, Record<string, string[]>> = {
  A_busy_period: {
    get_service_window_metrics: ["arrivals_per_window", "ticket_age"],
    get_shift_role_coverage: ["active_tables_per_role", "coverage_vs_plan_by_role"],
  },
  B_cold_food_handoff: {
    get_order_event_timeline: [
      "placed_at",
      "accepted_at",
      "ready_at",
      "picked_up_at",
      "served_at",
      "source_clock",
      "clock_offset_ms",
    ],
  },
  C_disputed_conduct: {
    get_current_outlet_policy: ["policy_text", "policy_version", "effective_from"],
  },
};

/** Never returned by any playbook, whatever is requested. */
export const NEVER_RETURNED = [
  "staff_name",
  "staff_id",
  "break_reason",
  "absence_reason",
  "personnel_record",
  "cctv",
  "audio",
] as const;

export interface Principal {
  tenant_id: string;
  location_ids: string[];
}

export interface IncidentWindowSource {
  location_id: string;
  occurred_at: string | null;
  reported_at: string;
}

export interface WindowParams {
  /** PROPOSED: minutes either side of the occurrence time. */
  marginMinutes: number;
  /** Owner-set lookback when the occurrence time is unknown. */
  lookbackMinutes: number;
}

export interface EvidenceRequestPlan {
  tool: string;
  location_id: string;
  fields: string[];
  window: { start: string; end: string; approximate: boolean };
  /** Requested fields outside the playbook; logged, never fetched. */
  dropped_fields: string[];
}

export type PlanResult =
  | { ok: true; plan: EvidenceRequestPlan }
  | { ok: false; reason: "cross_location" | "tool_not_in_playbook"; detail: string };

export function planEvidenceRequest(
  incident: IncidentWindowSource,
  playbook: Playbook,
  tool: string,
  requestedFields: string[],
  principal: Principal,
  params: WindowParams,
): PlanResult {
  // H-10: deny before any retrieval when the location is out of scope.
  if (!principal.location_ids.includes(incident.location_id)) {
    return { ok: false, reason: "cross_location", detail: `${incident.location_id} not in principal scope` };
  }
  const allowed = PLAYBOOK_FIELDS[playbook][tool];
  if (!allowed) {
    return { ok: false, reason: "tool_not_in_playbook", detail: `${tool} is not used by ${playbook}` };
  }

  const minute = 60_000;
  let window: EvidenceRequestPlan["window"];
  if (incident.occurred_at) {
    const at = Date.parse(incident.occurred_at);
    window = {
      start: new Date(at - params.marginMinutes * minute).toISOString(),
      end: new Date(at + params.marginMinutes * minute).toISOString(),
      approximate: false,
    };
  } else {
    const reported = Date.parse(incident.reported_at);
    window = {
      start: new Date(reported - params.lookbackMinutes * minute).toISOString(),
      end: new Date(reported).toISOString(),
      approximate: true,
    };
  }

  return {
    ok: true,
    plan: {
      tool,
      location_id: incident.location_id,
      // O-06: the computed set wins over whatever was asked for.
      fields: [...allowed],
      window,
      dropped_fields: requestedFields.filter((field) => !allowed.includes(field)),
    },
  };
}

// ----------------------------------------------------------- timestamps

export interface SourceTimestamp {
  at: string | null;
  source_clock: string;
  /** Known offset of this clock from reference time; null when unknown. */
  offset_ms: number | null;
}

export type IntervalResult =
  | { status: "measured"; ms: number }
  | { status: "unknown"; detail: string }
  | { status: "unreliable"; detail: string };

/**
 * H-08: a missing timestamp makes the interval unknown, never zero or late.
 * O-07: two clocks with an unknown offset make it unreliable, not computed.
 */
export function interval(from: SourceTimestamp, to: SourceTimestamp): IntervalResult {
  if (from.at === null || to.at === null) {
    return { status: "unknown", detail: `${from.at === null ? "start" : "end"} timestamp missing` };
  }
  let ms = Date.parse(to.at) - Date.parse(from.at);
  if (from.source_clock !== to.source_clock) {
    if (from.offset_ms === null || to.offset_ms === null) {
      return { status: "unreliable", detail: `${from.source_clock} and ${to.source_clock} offset unknown` };
    }
    ms += from.offset_ms - to.offset_ms;
  }
  return { status: "measured", ms };
}

export interface EvidenceUnavailable {
  status: "evidence_unavailable";
  source: string;
  reason: string;
}

/** Missing records are an explicit state, never an empty list. */
export function evidenceUnavailable(source: string, reason: string): EvidenceUnavailable {
  return { status: "evidence_unavailable", source, reason };
}
