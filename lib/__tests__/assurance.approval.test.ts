import { describe, expect, it } from "vitest";
import { validateApproval } from "@/lib/assurance/approval";
import { runAssurance } from "@/lib/assurance/checks";
import { sha256 } from "@/lib/assurance/hash";
import type { ApprovalRecord, AssuranceReport, PostIt } from "@/lib/assurance/types";
import { GOOD_DRAFT_TEXT, goodDraft, interpretation, policy, snapshot } from "@/lib/__tests__/helpers/assuranceFixtures";

const report: AssuranceReport = runAssurance({
  snapshot: snapshot(),
  interpretation: interpretation(),
  policy: policy(),
  draft: goodDraft(),
  recordedActionIds: [],
});

const NOTE: PostIt = {
  id: "PI-C-LENGTH",
  check_id: "C-LENGTH",
  severity: 30,
  text: "This reply is outside the usual length for this review. Check each added sentence is supported.",
};

function record(overrides: Partial<ApprovalRecord> = {}, text = GOOD_DRAFT_TEXT): ApprovalRecord {
  return {
    approver_id: "owner_fixture",
    decision: "approve",
    final_draft_sha256: sha256(text),
    source_version: "v3",
    approved_at: "2026-11-09T10:00:00Z",
    ...overrides,
  };
}

const ctx = (finalText = GOOD_DRAFT_TEXT, overrides: Partial<Parameters<typeof validateApproval>[1]> = {}) => ({
  currentSourceVersion: "v3",
  report,
  finalText,
  postIts: [NOTE],
  ...overrides,
});

describe("H5 approval gate", () => {
  it("accepts an approval of the exact text assurance checked, on the live version", () => {
    expect(validateApproval(record(), ctx())).toEqual({ ok: true });
  });

  it("F-15 / H-13: rejects an approval once the review has changed", () => {
    const verdict = validateApproval(record(), ctx(GOOD_DRAFT_TEXT, { currentSourceVersion: "v4" }));
    expect(verdict.ok === false && verdict.reason).toBe("stale_source");
  });

  it("sends edited text back through assurance", () => {
    const edited = `${GOOD_DRAFT_TEXT} See you soon!`;
    const verdict = validateApproval(record({ decision: "edit_and_approve" }, edited), ctx(edited));
    expect(verdict.ok === false && verdict.reason).toBe("edit_needs_reassurance");
  });

  it("rejects a record whose hash does not describe the text", () => {
    const verdict = validateApproval(record({ final_draft_sha256: sha256("something else") }), ctx());
    expect(verdict.ok === false && verdict.reason).toBe("hash_mismatch");
  });

  it("rejects approval of a blocked report", () => {
    const blocked: AssuranceReport = { ...report, overall: "blocked", blockers: ["C-REMEDY"] };
    const verdict = validateApproval(record(), ctx(GOOD_DRAFT_TEXT, { report: blocked }));
    expect(verdict.ok === false && verdict.reason).toBe("blocked_report");
  });

  it("H-19: rejects a reply that contains an internal post-it", () => {
    const leaked = `${GOOD_DRAFT_TEXT} ${NOTE.text}`;
    const verdict = validateApproval(record({ decision: "edit_and_approve" }, leaked), ctx(leaked));
    expect(verdict.ok === false && verdict.reason).toBe("post_it_leak");
  });

  it("accepts a rejection whatever the source version", () => {
    expect(validateApproval(record({ decision: "reject" }), ctx(GOOD_DRAFT_TEXT, { currentSourceVersion: "v9" }))).toEqual({ ok: true });
  });
});
