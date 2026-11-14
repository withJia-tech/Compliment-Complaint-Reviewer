import { describe, expect, it } from "vitest";
import { captureAssertion, markUnavailable, setAssertionStatus } from "@/lib/incidents/assertions";
import { acknowledge, attachTrigger, currentDeadline, lags, openEscalation, tick } from "@/lib/incidents/escalation";
import type { Actor } from "@/lib/incidents/types";

const at = "2026-11-09T12:00:00Z";
const dutyManager: Actor = { kind: "human", role: "duty_manager", id: "dm_1" };
const floor: Actor = { kind: "human", role: "floor_supervisor", id: "fs_1" };
const code: Actor = { kind: "code", role: "system", id: "pos_adapter" };
const model: Actor = { kind: "model", role: "system", id: "assistant" };

const guestClaim = () =>
  captureAssertion({ assertion_id: "a_guest", incident_id: "inc_1", source_type: "guest", claim: "server was dismissive" });
const staffClaim = () =>
  captureAssertion({ assertion_id: "a_staff", incident_id: "inc_1", source_type: "staff", claim: "explained the side item had changed" });

describe("claim status", () => {
  it("every claim starts as reported, set by code", () => {
    const claim = guestClaim();
    expect(claim.status).toBe("reported");
    expect(claim.status_set_by.kind).toBe("code");
  });

  it("O-05: a model cannot set any status", () => {
    const result = setAssertionStatus(guestClaim(), "contradicted", model, "timestamps disagree", at);
    expect(result.ok).toBe(false);
  });

  it("H-07: code may not label a guest's account contradicted", () => {
    expect(setAssertionStatus(guestClaim(), "contradicted", code, "POS shows 12 minutes", at).ok).toBe(false);
    expect(setAssertionStatus(guestClaim(), "unknown", code, "no POS record", at).ok).toBe(true);
  });

  it("H-06: a duty manager records both accounts as disputed; history is kept", () => {
    const guest = setAssertionStatus(guestClaim(), "disputed", dutyManager, "accounts conflict", at);
    const staff = setAssertionStatus(staffClaim(), "disputed", dutyManager, "accounts conflict", at);
    expect(guest.ok && staff.ok).toBe(true);
    if (guest.ok) {
      expect(guest.assertion.history).toEqual([{ from: "reported", to: "disputed", actor: dutyManager, reason: "accounts conflict", at }]);
    }
  });

  it("only named judgement roles may corroborate, and every change needs a reason", () => {
    expect(setAssertionStatus(guestClaim(), "corroborated", floor, "saw it", at).ok).toBe(false);
    expect(setAssertionStatus(guestClaim(), "corroborated", dutyManager, "  ", at).ok).toBe(false);
  });

  it("O-08: a source outage turns the claim unknown with the reason recorded", () => {
    const result = markUnavailable(guestClaim(), "pos", at);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assertion.status).toBe("unknown");
      expect(result.assertion.status_reason).toBe("source_unavailable:pos");
    }
  });
});

describe("escalation chain", () => {
  // Deadlines are owner-set; these values exist only for the test.
  const chain = [
    { role: "duty_manager" as const, person_id: "dm_1", ack_deadline_minutes: 10 },
    { role: "owner" as const, person_id: "owner_1", ack_deadline_minutes: 20 },
  ];
  const open = () =>
    openEscalation({
      escalation_id: "esc_1",
      incident_id: "inc_1",
      chain,
      trigger: { source: "lexical", detail: "escalation_medical:food poisoning", at },
      source_posted_at: "2026-11-09T11:30:00Z",
    });
  const plus = (minutes: number) => new Date(Date.parse(at) + minutes * 60_000);

  it("O-03: an unacknowledged escalation moves to the next person at the deadline, not before", () => {
    expect(tick(open(), plus(9)).level).toBe(0);
    const advanced = tick(open(), plus(10));
    expect(advanced.level).toBe(1);
    expect(advanced.events.at(-1)?.type).toBe("advanced");
  });

  it("O-04: a restart re-hydrates the same deadline", () => {
    const before = tick(open(), plus(5));
    const restored = JSON.parse(JSON.stringify(before));
    expect(currentDeadline(restored).toISOString()).toBe(currentDeadline(before).toISOString());
    expect(tick(restored, plus(10))).toEqual(tick(before, plus(10)));
  });

  it("marks the chain exhausted when nobody acknowledges", () => {
    const exhausted = tick(open(), plus(60));
    expect(exhausted.exhausted).toBe(true);
    expect(exhausted.events.at(-1)?.type).toBe("chain_exhausted");
  });

  it("acknowledgement by someone already reached stops the clock; others cannot acknowledge", () => {
    expect(acknowledge(open(), "owner_1", at).ok).toBe(false);
    const acked = acknowledge(open(), "dm_1", plus(4).toISOString());
    expect(acked.ok).toBe(true);
    if (acked.ok) expect(tick(acked.escalation, plus(60)).level).toBe(0);
  });

  it("a second trigger joins the open escalation", () => {
    const joined = attachTrigger(open(), { source: "model", detail: "allegation:illness", at });
    expect(joined.triggers).toHaveLength(2);
    expect(joined.escalation_id).toBe("esc_1");
  });

  it("records detection and acknowledgement lag", () => {
    const acked = acknowledge(open(), "dm_1", plus(4).toISOString());
    expect(acked.ok && lags(acked.escalation)).toEqual({ detection_ms: 30 * 60_000, acknowledgement_ms: 4 * 60_000 });
  });
});
