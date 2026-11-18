import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import { loadQueueRows } from "@/lib/queueData";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { Review } from "@/lib/types";

it("sorts an older four-star stored recommendation ahead of newer quick praise without rewriting it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-attention-"));
  vi.stubEnv("CCR_STORE_DIR", dir);
  try {
    for (const stars of [4, 5] as const) {
      const time = stars === 4 ? "2026-11-11T08:00:00Z" : "2026-11-12T08:00:00Z";
      const review: Review = { id: String(stars), locationId: "test", author: "Synthetic", stars,
        text: "Great food.", createTime: time, updateTime: time };
      reviewRepo.upsert(review);
      triageRepo.upsert({ ...new DefaultTriagePolicy().classify(review), riskLevel: "low", sensitive: false,
        recommendedAction: "quick_approve", policyVersion: "policy-v1.0.0", reasonCodes: ["positive_no_complaint"] });
    }
    const stored = fs.readFileSync(path.join(dir, "triage.json"), "utf8");
    expect(loadQueueRows().map(row => row.review.id)).toEqual(["4", "5"]);
    expect(fs.readFileSync(path.join(dir, "triage.json"), "utf8")).toBe(stored);
  } finally {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
