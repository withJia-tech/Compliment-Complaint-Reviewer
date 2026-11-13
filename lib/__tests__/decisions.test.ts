import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordRemedy, rejectReply, sendReply } from "@/lib/decisions";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import type { ApprovedBusinessFacts, Review } from "@/lib/types";

const facts: ApprovedBusinessFacts = {
  locationId: "loc_001",
  businessName: "Maple & Vine Cafe",
  facts: [{ key: "contact.phone", category: "contact", value: "(555) 012-3456" }],
};

const REVIEW: Review = {
  id: "rev_1",
  locationId: "loc_001",
  author: "Tester",
  stars: 2,
  text: "Waited far too long and the order was wrong.",
  createTime: "2026-08-20T10:00:00Z",
  updateTime: "2026-08-20T10:00:00Z",
};

let tmpDir: string;

/** Put one triaged, drafted review in the store, as a scan would have left it. */
function seed() {
  const triage = new DefaultTriagePolicy().classify(REVIEW);
  const draft = new TemplateReplyDrafter().draft(REVIEW, triage, facts);
  reviewRepo.upsert(REVIEW);
  triageRepo.upsert(triage);
  draftRepo.upsert(draft);
  return { triage, draft };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-dec-"));
  process.env.CCR_STORE_DIR = tmpDir;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CCR_STORE_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("sendReply", () => {
  it("publishes the draft unchanged and records an approved_published audit entry", async () => {
    const { draft } = seed();
    await sendReply("rev_1", draft.text);

    const approval = approvalRepo.getByReviewId("rev_1");
    expect(approval?.status).toBe("approved");
    expect(approval?.finalText).toBeUndefined();

    const [record] = auditRepo.listByReviewId("rev_1");
    expect(record.action).toBe("approved_published");
    expect(record.outcome?.success).toBe(true);
  });

  it("marks an edited reply as edited_approved and keeps the text that was sent", async () => {
    const { draft } = seed();
    const edited = `${draft.text} We have spoken with the team.`;
    await sendReply("rev_1", edited);

    const approval = approvalRepo.getByReviewId("rev_1");
    expect(approval?.status).toBe("edited_approved");
    expect(approval?.finalText).toBe(edited);
    expect(auditRepo.listByReviewId("rev_1")[0].approval.finalText).toBe(edited);
  });

  it("falls back to the draft when the submitted text is blank", async () => {
    const { draft } = seed();
    await sendReply("rev_1", "   ");
    expect(approvalRepo.getByReviewId("rev_1")?.status).toBe("approved");
    expect(auditRepo.listByReviewId("rev_1")[0].draft.text).toBe(draft.text);
  });

  it("refuses to act on a review that has not been triaged", async () => {
    await expect(sendReply("nope", "text")).rejects.toThrow(/has not been triaged/);
  });
});

describe("rejectReply", () => {
  it("records a rejection with no publish outcome", () => {
    seed();
    rejectReply("rev_1", "Handled offline");

    const approval = approvalRepo.getByReviewId("rev_1");
    expect(approval?.status).toBe("rejected");
    expect(approval?.reason).toBe("Handled offline");

    const [record] = auditRepo.listByReviewId("rev_1");
    expect(record.action).toBe("rejected");
    expect(record.outcome).toBeNull();
  });

  it("leaves the reason unset when none is given", () => {
    seed();
    rejectReply("rev_1", "   ");
    expect(approvalRepo.getByReviewId("rev_1")?.reason).toBeUndefined();
  });
});

describe("recordRemedy", () => {
  // Regression: this used to log "approved_published" for any review that was
  // not pending, so noting a voucher against a rejected review wrote an audit
  // entry claiming the reply had been published.
  it("logs remedy_recorded, not a publish, when the review was rejected", () => {
    seed();
    rejectReply("rev_1");
    recordRemedy("rev_1", { note: "Offered a £10 voucher", channel: "whatsapp" });

    const actions = auditRepo.listByReviewId("rev_1").map((r) => r.action);
    expect(actions).toEqual(["rejected", "remedy_recorded"]);
    expect(actions).not.toContain("approved_published");
  });

  it("logs remedy_recorded without changing a pending status", () => {
    seed();
    recordRemedy("rev_1", { note: "Offered a coffee on the house", channel: "email" });

    const approval = approvalRepo.getByReviewId("rev_1");
    expect(approval?.status).toBe("pending");
    expect(approval?.remedy?.channel).toBe("email");
    expect(auditRepo.listByReviewId("rev_1")[0].action).toBe("remedy_recorded");
  });

  it("never publishes anything", () => {
    seed();
    recordRemedy("rev_1", { note: "Offered a £10 voucher", channel: "phone" });
    expect(auditRepo.listByReviewId("rev_1").every((r) => r.outcome === null)).toBe(true);
  });

  it("keeps the remedy on the record when the reply is sent afterwards", async () => {
    const { draft } = seed();
    recordRemedy("rev_1", { note: "Offered a £10 voucher", channel: "whatsapp" });
    await sendReply("rev_1", draft.text);

    const approval = approvalRepo.getByReviewId("rev_1");
    expect(approval?.status).toBe("approved");
    expect(approval?.remedy?.note).toBe("Offered a £10 voucher");
  });

  it("keeps the remedy note out of the published reply text", async () => {
    const { draft } = seed();
    recordRemedy("rev_1", { note: "Offered a £10 voucher", channel: "whatsapp" });
    await sendReply("rev_1", draft.text);

    const published = auditRepo.listByReviewId("rev_1").at(-1);
    expect(published?.draft.text).not.toContain("voucher");
    expect(published?.approval.finalText ?? published?.draft.text).not.toContain("voucher");
  });
});

describe("a decided review cannot be decided again", () => {
  // Server actions are a public HTTP surface, so hiding the buttons in the UI
  // is not a guard. Two tabs, or the queue and the detail page, can both submit.
  it("sends once and refuses a second send, without a second publish or audit entry", async () => {
    const { draft } = seed();
    const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");

    const first = await sendReply("rev_1", draft.text);
    const second = await sendReply("rev_1", `${draft.text} (edited)`);

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "already_decided", status: "approved" });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(auditRepo.listByReviewId("rev_1")).toHaveLength(1);
    expect(approvalRepo.getByReviewId("rev_1")?.finalText).toBeUndefined();
  });

  // The race lives in the gap between "check status" and "record decision":
  // publishReply is awaited in between, so a second send arriving in that
  // window still sees the review as pending.
  it("publishes once when two sends race", async () => {
    const { draft } = seed();
    const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");

    const results = await Promise.all([
      sendReply("rev_1", draft.text),
      sendReply("rev_1", draft.text),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(auditRepo.listByReviewId("rev_1")).toHaveLength(1);
  });

  it("refuses to send a review the owner already skipped", async () => {
    const { draft } = seed();
    const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");

    rejectReply("rev_1", "Handled offline");
    const result = await sendReply("rev_1", draft.text);

    expect(result).toEqual({ ok: false, reason: "already_decided", status: "rejected" });
    expect(publish).not.toHaveBeenCalled();
    expect(approvalRepo.getByReviewId("rev_1")?.status).toBe("rejected");
  });

  it("refuses to skip a review that has already been sent", async () => {
    const { draft } = seed();
    await sendReply("rev_1", draft.text);

    const result = rejectReply("rev_1", "changed my mind");

    expect(result).toEqual({ ok: false, reason: "already_decided", status: "approved" });
    expect(approvalRepo.getByReviewId("rev_1")?.status).toBe("approved");
    expect(auditRepo.listByReviewId("rev_1")).toHaveLength(1);
  });

  it("does not treat a recorded remedy as a decision", async () => {
    const { draft } = seed();
    recordRemedy("rev_1", { note: "Offered a coffee on the house", channel: "email" });

    const result = await sendReply("rev_1", draft.text);

    expect(result.ok).toBe(true);
  });

  it("releases its claim when publishing throws, so the owner can retry", async () => {
    const { draft } = seed();
    vi.spyOn(FixtureReviewProvider.prototype, "publishReply").mockRejectedValueOnce(
      new Error("network down"),
    );

    await expect(sendReply("rev_1", draft.text)).rejects.toThrow("network down");
    expect(approvalRepo.getByReviewId("rev_1")?.status ?? "pending").toBe("pending");
    expect(auditRepo.listByReviewId("rev_1")).toHaveLength(0);

    expect((await sendReply("rev_1", draft.text)).ok).toBe(true);
  });
});
