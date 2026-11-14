import { describe, expect, it } from "vitest";
import {
  addVerificationEvidence,
  createIncident,
  recordCorrectiveAction,
  resolveEscalation,
  setMitigationStatus,
  setResponseStatus,
  transition,
} from "@/lib/incidents/stateMachine";
import { captureAssertion } from "@/lib/incidents/assertions";
import type { Actor, Incident } from "@/lib/incidents/types";

const at = "2026-11-09T12:00:00Z";
const dutyManager: Actor = { kind: "human", role: "duty_manager", id: "dm_1" };
const owner: Actor = { kind: "human", role: "owner", id: "owner_1" };
const shiftLead: Actor = { kind: "human", role: "shift_lead", id: "sl_1" };
const opsLead: Actor = { kind: "human", role: "operations_lead", id: "ops_1" };
const system: Actor = { kind: "code", role: "system", id: "recurrence_matcher" };
const model: Actor = { kind: "model", role: "system", id: "assistant" };

function fresh(): Incident {
  return createIncident({
    incident_id: "inc_1",
    location_id: "loc_001",
    category: "cold_food",
    assertions: [captureAssertion({ assertion_id: "a_1", incident_id: "inc_1", source_type: "guest", claim: "food arrived cold" })],
  });
}

function must<T extends { ok: boolean; incident: Incident }>(result: T): Incident {
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
  return result.incident;
}

function toReconstructing(): Incident {
  let incident = fresh();
  incident = must(transition(incident, { to: "safety_screened", actor: dutyManager, at, safetyOutcome: "not_high_risk" }));
  return must(transition(incident, { to: "reconstructing", actor: dutyManager, at }));
}

function readyToVerify(): Incident {
  let incident = toReconstructing();
  incident = must(setMitigationStatus(incident, "planned", shiftLead));
  incident = must(setMitigationStatus(incident, "done", shiftLead, "runner assigned to the pass during surge"));
  incident = must(setResponseStatus(incident, "drafting", owner));
  return must(setResponseStatus(incident, "approved", owner));
}

describe("incident lifecycle", () => {
  it("runs the full happy path and logs one event per move", () => {
    let incident = readyToVerify();
    incident = must(transition(incident, { to: "verifying", actor: owner, at }));
    incident = must(addVerificationEvidence(incident, "p95 ready-to-pickup fell over 3 matched windows", owner));
    incident = must(transition(incident, { to: "closed", actor: owner, at }));
    expect(incident.state).toBe("closed");
    expect(incident.events.map((e) => `${e.from}→${e.to}`)).toEqual([
      "registered→safety_screened",
      "safety_screened→reconstructing",
      "reconstructing→verifying",
      "verifying→closed",
    ]);
  });

  it("O-01: refuses a transition not in the table, and logs it", () => {
    const result = transition(fresh(), { to: "closed", actor: owner, at });
    expect(result.ok).toBe(false);
    expect(result.incident.rejections).toHaveLength(1);
    expect(result.incident.rejections[0].failures[0]).toContain("not allowed");
  });

  it("O-02 / H-18: a published reply with mitigation not done cannot move on", () => {
    let incident = toReconstructing();
    incident = must(setResponseStatus(incident, "drafting", owner));
    incident = must(setResponseStatus(incident, "approved", owner));
    incident = must(setResponseStatus(incident, "published", owner));
    const toVerify = transition(incident, { to: "verifying", actor: owner, at });
    expect(toVerify.ok).toBe(false);
    if (!toVerify.ok) expect(toVerify.failures.join()).toContain("mitigation");
    expect(transition(incident, { to: "closed", actor: owner, at }).ok).toBe(false);
  });

  it("H-18: closing needs verification evidence, not just a reply", () => {
    const incident = must(transition(readyToVerify(), { to: "verifying", actor: owner, at }));
    const result = transition(incident, { to: "closed", actor: owner, at });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContain("no verification evidence attached");
  });

  it("a high-risk screen needs an escalation record, and blocks closing until resolved", () => {
    const noEscalation = transition(fresh(), { to: "safety_screened", actor: dutyManager, at, safetyOutcome: "high_risk" });
    expect(noEscalation.ok).toBe(false);

    let incident = must(
      transition(fresh(), { to: "safety_screened", actor: dutyManager, at, safetyOutcome: "high_risk", escalationId: "esc_1" }),
    );
    incident = must(transition(incident, { to: "reconstructing", actor: dutyManager, at }));
    incident = must(setMitigationStatus(incident, "not_feasible", shiftLead, "supplier issue outside outlet control"));
    incident = must(setResponseStatus(incident, "not_needed", owner, "guest asked for no public reply"));
    incident = must(transition(incident, { to: "verifying", actor: owner, at }));
    incident = must(addVerificationEvidence(incident, "supplier batch recalled", owner));
    expect(transition(incident, { to: "closed", actor: owner, at }).ok).toBe(false);
    incident = must(resolveEscalation(incident, dutyManager));
    expect(transition(incident, { to: "closed", actor: owner, at }).ok).toBe(true);
  });

  it("refuses a model actor and a wrong role", () => {
    expect(transition(fresh(), { to: "safety_screened", actor: model, at, safetyOutcome: "not_high_risk" }).ok).toBe(false);
    expect(transition(fresh(), { to: "safety_screened", actor: owner, at, safetyOutcome: "not_high_risk" }).ok).toBe(false);
  });

  it("not needed and not feasible both require a reason", () => {
    const incident = toReconstructing();
    expect(setResponseStatus(incident, "not_needed", owner).ok).toBe(false);
    expect(setMitigationStatus(incident, "not_feasible", shiftLead, " ").ok).toBe(false);
    expect(setMitigationStatus(incident, "planned", model).ok).toBe(false);
  });

  it("O-13: the system reopens only on a matching corrective action, resetting mitigation", () => {
    let incident = readyToVerify();
    incident = recordCorrectiveAction(incident, "CA-handoff-ack");
    incident = must(transition(incident, { to: "verifying", actor: owner, at }));
    incident = must(addVerificationEvidence(incident, "pilot complete", owner));
    incident = must(transition(incident, { to: "closed", actor: owner, at }));

    const unmatched = transition(incident, { to: "reconstructing", actor: system, at, reason: "recurrence", matchedCorrectiveActionId: "CA-other" });
    expect(unmatched.ok).toBe(false);

    const reopened = must(
      transition(incident, { to: "reconstructing", actor: system, at, reason: "new cold-food complaint", matchedCorrectiveActionId: "CA-handoff-ack" }),
    );
    expect(reopened.state).toBe("reconstructing");
    expect(reopened.mitigation.status).toBe("not_started");
    expect(reopened.verification_evidence).toEqual([]);
    expect(transition(incident, { to: "reconstructing", actor: opsLead, at, reason: "manual review" }).ok).toBe(true);
  });

  it("never mutates the incident it was given", () => {
    const original = fresh();
    const snapshot = JSON.stringify(original);
    transition(original, { to: "closed", actor: owner, at });
    transition(original, { to: "safety_screened", actor: dutyManager, at, safetyOutcome: "not_high_risk" });
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
