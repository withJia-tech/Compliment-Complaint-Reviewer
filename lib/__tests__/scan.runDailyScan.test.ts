import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewProvider } from "@/lib/interfaces/reviewProvider";
import { runDailyScan, type DailyScanDeps } from "@/lib/scan/runDailyScan";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { locationRepo } from "@/lib/store/locationRepo";
import { writeJson } from "@/lib/store/jsonStore";
import {
  type ApprovedBusinessFacts,
  DEFAULT_LOCATION_ID,
  type ProviderPublishResult,
  type Review,
} from "@/lib/types";

const facts: ApprovedBusinessFacts = {
  locationId: "loc_001",
  businessName: "Maple & Vine Cafe",
  facts: [
    { key: "business_name", category: "identity", value: "Maple & Vine Cafe" },
    { key: "contact.phone", category: "contact", value: "(555) 012-3456" },
  ],
};

// Timestamps are relative to the wall clock, because `listSince` compares
// against `lastSuccessfulScanAt`, which is set to the real time the scan ran.
// Hard-coded calendar dates would silently stop being "new" once the clock
// passed them, and the rescan assertions would pass against an empty scan.
const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const ahead = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function review(id: string, stars: Review["stars"], text: string, updateTime: string): Review {
  return {
    id,
    locationId: "loc_001",
    author: "Tester",
    stars,
    text,
    createTime: updateTime,
    updateTime,
  };
}

const POSITIVE = review("rev_pos", 5, "Loved the coffee, staff were so friendly!", ago(30));
const MIXED = review("rev_mixed", 3, "Food was good but service was slow.", ago(20));
const SENSITIVE = review("rev_sens", 1, "I slipped on a wet floor and got hurt.", ago(10));

/** Provider over a mutable review list, counting publishes. */
class FakeProvider implements ReviewProvider {
  publishes: Array<{ reviewId: string; text: string }> = [];
  constructor(public reviews: Review[]) {}

  async listSince(since: string): Promise<Review[]> {
    const t = new Date(since).getTime();
    return this.reviews.filter((r) => new Date(r.updateTime).getTime() > t);
  }
  async getById(id: string): Promise<Review | null> {
    return this.reviews.find((r) => r.id === id) ?? null;
  }
  async publishReply(reviewId: string, text: string): Promise<ProviderPublishResult> {
    this.publishes.push({ reviewId, text });
    return { success: true, providerReplyId: `fake-${reviewId}`, publishedAt: new Date().toISOString() };
  }
}

let tmpDir: string;
let provider: FakeProvider;

function deps(): DailyScanDeps {
  return {
    provider,
    policy: new DefaultTriagePolicy(),
    drafter: new TemplateReplyDrafter(),
    approvalChannel: { notify: async () => {} },
    facts,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-scan-"));
  process.env.CCR_STORE_DIR = tmpDir;
  provider = new FakeProvider([POSITIVE, MIXED, SENSITIVE]);
});

afterEach(() => {
  delete process.env.CCR_STORE_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runDailyScan", () => {
  it("processes every review on a first scan and leaves them pending", async () => {
    const result = await runDailyScan(deps());
    expect(result.scanned).toBe(3);
    expect(approvalRepo.list().every((a) => a.status === "pending")).toBe(true);
    expect(auditRepo.list()).toHaveLength(3);
  });

  it("is idempotent: a rerun with no new reviews processes nothing", async () => {
    await runDailyScan(deps());
    const second = await runDailyScan(deps());
    expect(second.scanned).toBe(0);
    expect(auditRepo.list()).toHaveLength(3);
  });

  it("advances lastSuccessfulScanAt only after the pass completes", async () => {
    expect(locationRepo.get(DEFAULT_LOCATION_ID).lastSuccessfulScanAt).toBeNull();
    const result = await runDailyScan(deps());
    expect(locationRepo.get(DEFAULT_LOCATION_ID).lastSuccessfulScanAt).toBe(result.scanStartedAt);
  });

  // The scan never sends. Every reply is sent by the owner, one at a time,
  // from the queue. Auto-send for deterministic 5-star positives is parked in
  // the backlog (docs/DECISIONS.md); until it is built, nothing in the scan
  // path may reach provider.publishReply.
  it("never publishes during a scan, for any review, including a clean 5-star", async () => {
    await runDailyScan(deps());

    expect(provider.publishes).toHaveLength(0);
    expect(approvalRepo.list().every((a) => a.status === "pending")).toBe(true);
  });

  it("ignores a legacy autoPublishConsent flag left behind in an older store", async () => {
    // A store written before auto-send was removed can still carry the flag.
    // It must not switch sending back on.
    writeJson("location.json", {
      locationId: DEFAULT_LOCATION_ID,
      connected: true,
      autoPublishConsent: true,
      lastSuccessfulScanAt: null,
    });

    await runDailyScan(deps());

    expect(provider.publishes).toHaveLength(0);
    expect(approvalRepo.getByReviewId("rev_pos")?.status).toBe("pending");
  });

  it("leaves a rejection standing when the review is edited and rescanned", async () => {
    provider = new FakeProvider([POSITIVE]);
    await runDailyScan(deps());

    // The owner rejects it, then the customer edits their review.
    approvalRepo.upsert({
      reviewId: "rev_pos",
      status: "rejected",
      actor: "business-owner",
      decidedAt: new Date().toISOString(),
    });
    provider.reviews = [{ ...POSITIVE, text: POSITIVE.text + " Still great.", updateTime: ahead(5) }];

    const result = await runDailyScan(deps());

    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(provider.publishes).toHaveLength(0);
    expect(approvalRepo.getByReviewId("rev_pos")?.status).toBe("rejected");
  });

  it("does not write a new audit record for a review a human already decided", async () => {
    await runDailyScan(deps());
    const before = auditRepo.list().length;

    approvalRepo.upsert({
      reviewId: "rev_mixed",
      status: "approved",
      actor: "business-owner",
      decidedAt: new Date().toISOString(),
    });
    provider.reviews = [{ ...MIXED, updateTime: ahead(5) }];
    await runDailyScan(deps());

    expect(auditRepo.list()).toHaveLength(before);
  });

  it("records policy version, evidence, and source timestamps on every audit entry", async () => {
    await runDailyScan(deps());
    for (const record of auditRepo.list()) {
      expect(record.policyVersion).toMatch(/^policy-v/);
      expect(record.evidence.text.length).toBeGreaterThan(0);
      expect(record.sourceUpdateTime).toBeTruthy();
      expect(record.draft.text.length).toBeGreaterThan(0);
    }
  });
});


it("bounds initial retrieval and discards an old review edited today", async () => {
  provider.reviews = [{ ...POSITIVE, createTime:"2020-01-01T00:00:00Z", updateTime:ago(1) }, MIXED];
  const result = await runDailyScan(deps());
  expect(Date.parse(result.since)).toBeGreaterThan(Date.now() - 185*86400000);
  expect(result.scanned).toBe(1);
  expect(approvalRepo.getByReviewId(POSITIVE.id)).toBeNull();
});
