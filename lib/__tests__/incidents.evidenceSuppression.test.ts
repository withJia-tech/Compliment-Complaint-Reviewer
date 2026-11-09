import { describe, expect, it } from "vitest";
import { interval, NEVER_RETURNED, PLAYBOOK_FIELDS, planEvidenceRequest } from "@/lib/incidents/evidenceTools";
import { suppressSmallGroups, type WindowCell } from "@/lib/incidents/suppression";

const principal = { tenant_id: "t_1", location_ids: ["loc_001"] };
const params = { marginMinutes: 120, lookbackMinutes: 240 };
const incident = { location_id: "loc_001", occurred_at: "2026-11-09T12:30:00Z", reported_at: "2026-11-09T15:00:00Z" };

describe("purpose-bound evidence requests", () => {
  it("H-10: denies another location before any retrieval", () => {
    const result = planEvidenceRequest({ ...incident, location_id: "loc_999" }, "B_cold_food_handoff", "get_order_event_timeline", [], principal, params);
    expect(result.ok === false && result.reason).toBe("cross_location");
  });

  it("O-06: returns the playbook's field set and logs anything else asked for", () => {
    const result = planEvidenceRequest(incident, "B_cold_food_handoff", "get_order_event_timeline", ["ready_at", "staff_name"], principal, params);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.fields).toEqual(PLAYBOOK_FIELDS.B_cold_food_handoff.get_order_event_timeline);
      expect(result.plan.dropped_fields).toEqual(["staff_name"]);
    }
  });

  it("refuses a tool the playbook does not use", () => {
    const result = planEvidenceRequest(incident, "C_disputed_conduct", "get_order_event_timeline", [], principal, params);
    expect(result.ok === false && result.reason).toBe("tool_not_in_playbook");
  });

  it("sets the window from the incident, flagging it approximate when the time is unknown", () => {
    const known = planEvidenceRequest(incident, "A_busy_period", "get_service_window_metrics", [], principal, params);
    expect(known.ok && known.plan.window).toEqual({ start: "2026-11-09T10:30:00.000Z", end: "2026-11-09T14:30:00.000Z", approximate: false });
    const unknown = planEvidenceRequest({ ...incident, occurred_at: null }, "A_busy_period", "get_service_window_metrics", [], principal, params);
    expect(unknown.ok && unknown.plan.window.approximate).toBe(true);
  });

  it("no playbook can return a never-returned field", () => {
    const all = Object.values(PLAYBOOK_FIELDS).flatMap((tools) => Object.values(tools).flat());
    for (const field of NEVER_RETURNED) expect(all).not.toContain(field);
  });
});

describe("intervals across sources", () => {
  const kds = (time: string | null, offset: number | null = 0) => ({ at: time, source_clock: "kds", offset_ms: offset });
  const pos = (time: string | null, offset: number | null = 0) => ({ at: time, source_clock: "pos", offset_ms: offset });

  it("H-08: a missing pickup scan makes the gap unknown, not late", () => {
    expect(interval(kds("2026-11-09T12:30:00Z"), kds(null)).status).toBe("unknown");
  });

  it("O-07: two clocks with an unknown offset are unreliable, not computed", () => {
    expect(interval(kds("2026-11-09T12:30:00Z", null), pos("2026-11-09T12:34:00Z")).status).toBe("unreliable");
  });

  it("corrects for known offsets across clocks", () => {
    // KDS runs 60 s fast, POS is on reference time.
    expect(interval(kds("2026-11-09T12:30:00Z", 60_000), pos("2026-11-09T12:34:00Z", 0))).toEqual({ status: "measured", ms: 300_000 });
  });
});

describe("small-group suppression", () => {
  const cell = (section: string, start: string, staff: number, value: number, minutes: 15 | 30 | 60 = 15): WindowCell => ({
    location_id: "loc_001",
    section,
    window_start: start,
    window_minutes: minutes,
    staff_on_shift: staff,
    value,
  });

  it("shows 15-minute cells when every one has at least k staff", () => {
    const out = suppressSmallGroups([cell("main", "2026-11-09T12:00:00Z", 4, 2), cell("main", "2026-11-09T12:15:00Z", 3, 1)], 3);
    expect(out.map((c) => [c.window_minutes, c.status])).toEqual([[15, "shown"], [15, "shown"]]);
  });

  it("O-09: a one-server section is merged with another section, never shown alone", () => {
    const out = suppressSmallGroups(
      [cell("terrace", "2026-11-09T12:00:00Z", 1, 3), cell("bar", "2026-11-09T12:00:00Z", 2, 1)],
      3,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sections: ["bar", "terrace"], window_minutes: 60, staff_on_shift: 3, value: 4, status: "shown" });
  });

  it("suppresses when even the merged hour has fewer than k staff", () => {
    const out = suppressSmallGroups([cell("terrace", "2026-11-09T12:00:00Z", 1, 3)], 3);
    expect(out[0]).toMatchObject({ status: "suppressed", value: null, note: "suppressed: fewer than 3 staff" });
  });

  it("never shows a figure from fewer than k staff, across random inputs", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 200; trial++) {
      const cells: WindowCell[] = [];
      for (const section of ["a", "b", "c"]) {
        for (const minute of [0, 15, 30, 45]) {
          if (random() < 0.7) {
            cells.push(cell(section, `2026-11-09T12:${String(minute).padStart(2, "0")}:00Z`, Math.floor(random() * 5), Math.floor(random() * 4)));
          }
        }
      }
      for (const out of suppressSmallGroups(cells, 3)) {
        if (out.status === "shown") expect(out.staff_on_shift).toBeGreaterThanOrEqual(3);
        else expect(out.value).toBeNull();
      }
    }
  });
});
