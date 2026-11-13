import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import businessFacts from "@/data/fixtures/businessFacts.json";
import { contextVersion } from "@/lib/approval/context";
import { sendReply, reconcileReply, rejectReply, noResponseRequired } from "@/lib/decisions";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { runDailyScan } from "@/lib/scan/runDailyScan";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import type { ApprovedBusinessFacts, Review } from "@/lib/types";

const facts = businessFacts as ApprovedBusinessFacts;
let dir: string;
const review: Review = {
  id: "boundary",
  locationId: "loc_001",
  author: "Guest",
  stars: 2,
  text: "Rude service.",
  createTime: "2026-11-13T00:00:00Z",
  updateTime: "2026-11-13T00:00:00Z",
};
function seed() {
  const triage = new DefaultTriagePolicy().classify(review);
  const draft = new TemplateReplyDrafter().draft(review, triage, facts);
  reviewRepo.upsert(review);
  triageRepo.upsert(triage);
  draftRepo.upsert(draft);
  return {
    draft,
    confirmation: {
      contextVersion: contextVersion({ review, triage, draft }, facts),
      reviewed: true,
    },
  };
}
const receipt = {
  success: true,
  providerReplyId: "receipt-1",
  publishedAt: "2026-11-13T01:00:00Z",
};
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-boundary-"));
  process.env.CCR_STORE_DIR = dir;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CCR_STORE_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

it("requires explicit confirmation even for an unchanged draft", async () => {
  const { draft, confirmation } = seed();
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  expect(await sendReply(review.id, draft.text)).toMatchObject({
    reason: "confirmation_required",
  });
  expect(
    await sendReply(review.id, draft.text, {
      ...confirmation,
      reviewed: false,
    }),
  ).toMatchObject({ reason: "confirmation_required" });
  expect(publish).not.toHaveBeenCalled();
});

it.each(["source", "draft", "triage"])(
  "refuses a stale %s snapshot",
  async (kind) => {
    const { draft, confirmation } = seed();
    const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
    if (kind === "source")
      reviewRepo.upsert({
        ...review,
        text: "An edited review at the same timestamp",
      });
    if (kind === "draft") draftRepo.upsert({ ...draft, text: "Changed draft" });
    if (kind === "triage")
      triageRepo.upsert({
        ...triageRepo.getByReviewId(review.id)!,
        policyVersion: "changed",
      });
    expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
      reason: "stale_context",
    });
    expect(publish).not.toHaveBeenCalled();
  },
);

it("rejects a freshly computed token over an old draft and changed source", async () => {
  const { draft } = seed();
  const changed = { ...review, text: "New concern" };
  reviewRepo.upsert(changed);
  const version = contextVersion(
    { review: changed, triage: triageRepo.getByReviewId(review.id)!, draft },
    facts,
  );
  expect(
    await sendReply(review.id, draft.text, {
      contextVersion: version,
      reviewed: true,
    }),
  ).toMatchObject({ reason: "stale_context" });
});

it("requires rescan for legacy drafts without pinned source/facts", async () => {
  const { draft } = seed();
  delete draft.sourceVersion;
  delete draft.factsVersion;
  draftRepo.upsert(draft);
  const version = contextVersion(
    { review, triage: triageRepo.getByReviewId(review.id)!, draft },
    facts,
  );
  expect(
    await sendReply(review.id, draft.text, {
      contextVersion: version,
      reviewed: true,
    }),
  ).toMatchObject({ reason: "stale_context" });
});

it("rejects drafts created with different approved facts", async () => {
  const { draft } = seed();
  draft.factsVersion = "old-facts";
  draftRepo.upsert(draft);
  const version = contextVersion(
    { review, triage: triageRepo.getByReviewId(review.id)!, draft },
    facts,
  );
  expect(
    await sendReply(review.id, draft.text, {
      contextVersion: version,
      reviewed: true,
    }),
  ).toMatchObject({ reason: "stale_context" });
});

it.each([
  "We will refund you $100 tomorrow.",
  "The employee was at fault.",
  "We have fixed the kitchen.",
  "We investigated the allegation.",
  "Here's your vouch\u200ber.",
  "",
  " ",
  "x".repeat(4097),
])("blocks unsafe/invalid edited text (%#)", async (text) => {
  const { confirmation } = seed();
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  expect(await sendReply(review.id, text, confirmation)).toMatchObject({
    reason: "validation_failed",
  });
  expect(publish).not.toHaveBeenCalled();
});

it("persists exact approved text and intent before invoking the provider", async () => {
  const { confirmation } = seed();
  const text = "  Thank you for sharing your experience.  ";
  const publish = vi
    .spyOn(FixtureReviewProvider.prototype, "publishReply")
    .mockImplementation(async (_id, sent) => {
      expect(sent).toBe(text);
      expect(approvalRepo.getByReviewId(review.id)).toMatchObject({
        status: "publishing",
        finalText: text,
        validationVersion: "public-reply-v2",
      });
      expect(auditRepo.list()[0]).toMatchObject({
        action: "publish_requested",
        approval: {
          finalText: text,
          contextVersion: confirmation.contextVersion,
        },
      });
      return receipt;
    });
  expect(await sendReply(review.id, text, confirmation)).toEqual({ ok: true });
  expect(publish).toHaveBeenCalledOnce();
  expect(approvalRepo.getByReviewId(review.id)?.finalText).toBe(text);
});

it("a confirmed failure permits a fresh human retry and never claims the first send succeeded", async () => {
  const { draft, confirmation } = seed();
  const publish = vi
    .spyOn(FixtureReviewProvider.prototype, "publishReply")
    .mockResolvedValueOnce({ success: false })
    .mockResolvedValueOnce(receipt);
  expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
    reason: "publish_failed",
  });
  expect(auditRepo.list().map((r) => r.action)).toEqual([
    "publish_requested",
    "publish_failed",
  ]);
  const first = approvalRepo.getByReviewId(review.id)?.attemptId;
  expect(await sendReply(review.id, draft.text, confirmation)).toEqual({
    ok: true,
  });
  expect(approvalRepo.getByReviewId(review.id)?.attemptId).not.toBe(first);
  expect(publish).toHaveBeenCalledTimes(2);
});

it("a timeout blocks retry, skip and rescan overwrite until matched provider reconciliation", async () => {
  const { draft, confirmation } = seed();
  const publish = vi
    .spyOn(FixtureReviewProvider.prototype, "publishReply")
    .mockRejectedValue(new Error("Lost response after acceptance"));
  expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
    reason: "publish_unknown",
  });
  expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
    reason: "publish_unknown",
  });
  expect(rejectReply(review.id)).toMatchObject({ reason: "publish_unknown" });
  await runDailyScan({
    provider: {
      listSince: async () => [{ ...review, text: "Changed after send" }],
      getById: async () => null,
      publishReply: async () => {
        throw new Error("Scan must not publish");
      },
    },
    policy: new DefaultTriagePolicy(),
    drafter: new TemplateReplyDrafter(),
    facts,
    approvalChannel: { notify: async () => {} },
  });
  expect(reviewRepo.getById(review.id)?.text).toBe(review.text);
  vi.spyOn(FixtureReviewProvider.prototype, "reconcileReply").mockResolvedValue(
    {
      status: "published",
      text: draft.text,
      providerReplyId: "found",
      publishedAt: receipt.publishedAt,
    },
  );
  expect(await reconcileReply(review.id)).toEqual({ ok: true });
  expect(approvalRepo.getByReviewId(review.id)?.status).toBe("approved");
  expect(auditRepo.list().at(-1)?.action).toBe("publish_reconciled");
  expect(publish).toHaveBeenCalledOnce();
});

it.each(["unknown", "different_text", "exception"])(
  "does not retry after inconclusive reconciliation: %s",
  async (kind) => {
    const { draft, confirmation } = seed();
    const publish = vi
      .spyOn(FixtureReviewProvider.prototype, "publishReply")
      .mockRejectedValue(new Error("timeout"));
    await sendReply(review.id, draft.text, confirmation);
    const reconcile = vi.spyOn(
      FixtureReviewProvider.prototype,
      "reconcileReply",
    );
    if (kind === "exception") reconcile.mockRejectedValue(new Error("timeout"));
    else if (kind === "different_text")
      reconcile.mockResolvedValue({
        status: "published",
        text: "Someone else's reply",
        providerReplyId: "other",
        publishedAt: receipt.publishedAt,
      });
    else reconcile.mockResolvedValue({ status: "unknown" });
    expect(await reconcileReply(review.id)).toMatchObject({
      reason: "publish_unknown",
    });
    expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
      reason: "publish_unknown",
    });
    expect(publish).toHaveBeenCalledOnce();
  },
);

it("only conclusive non-publication reopens an uncertain attempt for human retry", async () => {
  const { draft, confirmation } = seed();
  const publish = vi
    .spyOn(FixtureReviewProvider.prototype, "publishReply")
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce(receipt);
  await sendReply(review.id, draft.text, confirmation);
  vi.spyOn(FixtureReviewProvider.prototype, "reconcileReply").mockResolvedValue(
    { status: "not_published" },
  );
  expect(await reconcileReply(review.id)).toMatchObject({
    reason: "publish_failed",
  });
  expect(publish).toHaveBeenCalledOnce(); // reconciliation cannot send
  expect(await sendReply(review.id, draft.text, confirmation)).toEqual({
    ok: true,
  });
});

it("a post-publication storage error leaves the durable attempt blocking duplicate sends", async () => {
  const { draft, confirmation } = seed();
  const append = auditRepo.append.bind(auditRepo);
  vi.spyOn(auditRepo, "append").mockImplementation((record) => {
    if (record.action === "approved_published") throw new Error("disk full");
    append(record);
  });
  const publish = vi
    .spyOn(FixtureReviewProvider.prototype, "publishReply")
    .mockResolvedValue(receipt);
  await expect(sendReply(review.id, draft.text, confirmation)).rejects.toThrow(
    "disk full",
  );
  expect(approvalRepo.getByReviewId(review.id)?.status).toBe("publishing");
  expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
    reason: "publish_unknown",
  });
  expect(publish).toHaveBeenCalledOnce();
});

it("does not call the provider if persisting the intent fails", async () => {
  const { draft, confirmation } = seed();
  vi.spyOn(auditRepo, "append").mockImplementation(() => {
    throw new Error("disk full");
  });
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  await expect(sendReply(review.id, draft.text, confirmation)).rejects.toThrow(
    "disk full",
  );
  expect(publish).not.toHaveBeenCalled();
});

it("respects a lock left by another process and never expires it automatically", async () => {
  const { draft, confirmation } = seed();
  const lock = path.join(dir, ".writer-lock");
  const child = spawnSync(process.execPath, [
    "-e",
    "require('node:fs').mkdirSync(process.argv[1])",
    lock,
  ]);
  expect(child.status).toBe(0);
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
    reason: "in_progress",
  });
  expect(fs.existsSync(lock)).toBe(true);
  expect(publish).not.toHaveBeenCalled();
});

it("treats an incomplete success receipt as unknown", async () => {
  const { draft, confirmation } = seed();
  vi.spyOn(FixtureReviewProvider.prototype, "publishReply").mockResolvedValue({
    success: true,
  });
  expect(await sendReply(review.id, draft.text, confirmation)).toMatchObject({
    reason: "publish_unknown",
  });
});


it("records a no-response decision only after current evidence confirmation and never publishes", () => {
  const { confirmation } = seed();
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  expect(noResponseRequired(review.id)).toMatchObject({reason:"confirmation_required"});
  expect(noResponseRequired(review.id, {...confirmation, contextVersion:"stale"})).toMatchObject({reason:"stale_context"});
  expect(noResponseRequired(review.id, confirmation)).toEqual({ok:true});
  expect(approvalRepo.getByReviewId(review.id)?.status).toBe("no_response_required");
  expect(auditRepo.list().at(-1)?.action).toBe("no_response_required");
  expect(noResponseRequired(review.id, confirmation)).toMatchObject({reason:"already_decided"});
  expect(publish).not.toHaveBeenCalled();
});

it("uses an injected provider and treats one that cannot reconcile as unknown", async () => {
  const { draft, confirmation } = seed();
  const calls: string[] = [];
  const provider = {
    listSince: async () => [],
    getById: async () => null,
    publishReply: async (id: string) => {
      calls.push(id);
      throw new Error("Lost response");
    },
  };
  expect(await sendReply(review.id, draft.text, confirmation, { provider, facts })).toMatchObject({
    reason: "publish_unknown",
  });
  expect(calls).toEqual([review.id]);
  // No reconcileReply on this provider: the outcome stays unknown, nothing is resent.
  expect(await reconcileReply(review.id, { provider, facts })).toEqual({ ok: false, reason: "publish_unknown" });
  expect(calls).toEqual([review.id]);
  expect(approvalRepo.getByReviewId(review.id)?.status).toBe("publish_unknown");
});

it("refuses a reply over Google's 4,096-byte limit before the provider is called", async () => {
  const { confirmation } = seed();
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  const reply = "谢谢您的反馈".repeat(233) + "谢谢"; // 1,400 characters, 4,200 bytes
  expect(await sendReply(review.id, reply, confirmation)).toMatchObject({ reason: "validation_failed" });
  expect(publish).not.toHaveBeenCalled();
});
