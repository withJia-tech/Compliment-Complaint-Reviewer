// H5: the human approval gate. Approval binds to the exact source version
// and the exact text that passed assurance; anything else is rejected and
// sent back for re-evaluation.

import type { ApprovalRecord, AssuranceReport, PostIt } from "@/lib/assurance/types";
import { sha256 } from "@/lib/assurance/hash";

export interface ApprovalContext {
  /** Live source version of the review at approval time. */
  currentSourceVersion: string;
  /** The report the approver saw. */
  report: AssuranceReport;
  /** The text that would be published. */
  finalText: string;
  postIts: PostIt[];
}

export type ApprovalVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "stale_source" | "blocked_report" | "hash_mismatch" | "edit_needs_reassurance" | "post_it_leak";
      detail: string;
    };

export function validateApproval(record: ApprovalRecord, ctx: ApprovalContext): ApprovalVerdict {
  if (record.decision === "reject") return { ok: true };

  // F-15 / H-13: an approval never survives a source change.
  if (record.source_version !== ctx.currentSourceVersion) {
    return {
      ok: false,
      reason: "stale_source",
      detail: `approved ${record.source_version}, live ${ctx.currentSourceVersion}`,
    };
  }

  const finalHash = sha256(ctx.finalText);
  if (record.final_draft_sha256 !== finalHash) {
    return { ok: false, reason: "hash_mismatch", detail: "record does not describe the text being approved" };
  }

  // H-19: internal notes must never reach the published reply. Checked before
  // the edit rule so a pasted note is reported as a leak, not just an edit.
  const lower = ctx.finalText.toLowerCase();
  const leak = ctx.postIts.find((note) => lower.includes(note.text.toLowerCase()) || ctx.finalText.includes(note.id));
  if (leak) {
    return { ok: false, reason: "post_it_leak", detail: `post-it ${leak.id} appears in the reply` };
  }

  // Edited text must go back through H3 and H4 before it can be approved.
  if (finalHash !== ctx.report.draft_sha256) {
    return {
      ok: false,
      reason: "edit_needs_reassurance",
      detail: "final text differs from the text assurance checked; re-run H3 and H4",
    };
  }

  if (ctx.report.overall === "blocked") {
    return { ok: false, reason: "blocked_report", detail: `blocked by ${ctx.report.blockers.join(", ")}` };
  }

  return { ok: true };
}
