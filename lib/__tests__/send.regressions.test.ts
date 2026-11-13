import { contextVersion } from "@/lib/approval/context";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sendReply as checkedSendReply } from "@/lib/decisions";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import facts from "@/data/fixtures/businessFacts.json";
import type { ApprovedBusinessFacts, Review } from "@/lib/types";
let dir: string;
const review: Review = {
  id: "regression",
  locationId: "loc_001",
  author: "Guest",
  stars: 3,
  text: "Terrible food. Rude service. Nothing was good.",
  createTime: "2026-11-13T00:00:00Z",
  updateTime: "2026-11-13T00:00:00Z",
};
function seed(r = review) {
  const triage = new DefaultTriagePolicy().classify(r);
  const draft = new TemplateReplyDrafter().draft(
    r,
    triage,
    facts as ApprovedBusinessFacts,
  );
  reviewRepo.upsert(r);
  triageRepo.upsert(triage);
  draftRepo.upsert(draft);
  return draft;
}
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-regression-"));
  process.env.CCR_STORE_DIR = dir;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CCR_STORE_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});
it("does not manufacture praise for a wholly negative three-star review", () => {
  expect(seed().text).not.toMatch(/glad parts|enjoyed|kind words/i);
});
it("does not invent written praise from a rating alone", () => {
  expect(seed({ ...review, stars: 5, text: "" }).text).not.toMatch(
    /kind words|enjoyed/i,
  );
});
it("never records a failed provider result as published", async () => {
  const draft = seed();
  vi.spyOn(FixtureReviewProvider.prototype, "publishReply").mockResolvedValue({
    success: false,
    error: "Rejected",
  });
  expect((await sendReply(review.id, draft.text)).ok).toBe(false);
  expect(auditRepo.list().some((r) => r.action === "approved_published")).toBe(
    false,
  );
});
it("blocks an edited refund promise before invoking the provider", async () => {
  seed();
  const publish = vi.spyOn(FixtureReviewProvider.prototype, "publishReply");
  expect(
    (await sendReply(review.id, "We'll refund you $100 tomorrow.")).ok,
  ).toBe(false);
  expect(publish).not.toHaveBeenCalled();
});

function sendReply(id: string, text: string) {
  return checkedSendReply(id, text, {
    reviewed: true,
    contextVersion: contextVersion(
      {
        review: reviewRepo.getById(id)!,
        triage: triageRepo.getByReviewId(id)!,
        draft: draftRepo.getByReviewId(id)!,
      },
      facts as ApprovedBusinessFacts,
    ),
  });
}
