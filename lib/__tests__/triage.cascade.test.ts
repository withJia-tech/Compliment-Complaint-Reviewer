import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { ReadingRecorder, cascadeFromCache, loadReadingCache } from "@/lib/triage/reader/cachedReader";
import { CascadeReviewReader, cascadeReaderId, combineReadings, escalationReasons } from "@/lib/triage/reader/cascade";
import { costUsd, usageSummary } from "@/lib/triage/reader/pricing";
import type { ModelReader, ReadAttempt, ReviewReading } from "@/lib/triage/reader/types";
import { triageReview } from "@/lib/triage/triageReview";
import type { Review } from "@/lib/types";

const policy = new DefaultTriagePolicy();
const CHEAP = "claude-haiku-5-5";
const STRONG = "claude-sonnet-5-5";

function review(stars: Review["stars"], text: string, id = "r1"): Review {
  return { id, locationId: "loc_001", author: "T", stars, text, createTime: "", updateTime: "" };
}

function reading(overrides: Partial<ReviewReading> = {}): ReviewReading {
  return { language: "en", concern: "none", category: "none", contains_personal_info: false, rationale: "test", ...overrides };
}

const usage = { inputTokens: 1000, outputTokens: 200 };
const ok = (model: string, r: ReviewReading): ReadAttempt => ({ model, ok: true, reading: r, usage });
const failed = (model: string, reason: "refused" | "api_error"): ReadAttempt => ({
  model,
  ok: false,
  reason,
  usage: reason === "api_error" ? { inputTokens: 0, outputTokens: 0 } : usage,
});

/** A scripted model: returns the same attempt for every review, and counts calls. */
function scripted(model: string, answer: (r: Review) => ReadAttempt): ModelReader & { calls: number } {
  const fake = {
    model,
    calls: 0,
    async attempt(r: Review) {
      fake.calls += 1;
      return answer(r);
    },
  };
  return fake;
}

describe("cascade reader: when the cheap model is enough", () => {
  it("keeps a plain, happy English review on the cheap model alone", async () => {
    const cheap = scripted(CHEAP, () => ok(CHEAP, reading()));
    const strong = scripted(STRONG, () => ok(STRONG, reading()));
    const reader = new CascadeReviewReader(cheap, strong);
    const result = await triageReview(review(5, "Lovely coffee and friendly staff."), policy, reader);
    expect(result.recommendedAction).toBe("quick_approve");
    expect(strong.calls).toBe(0);
    expect(reader.stats.escalations).toBe(0);
  });

  it("treats a sensitive reading from the cheap model as final: there is nothing higher to reach", async () => {
    const cheap = scripted(CHEAP, () => ok(CHEAP, reading({ concern: "sensitive", category: "medical" })));
    const strong = scripted(STRONG, () => ok(STRONG, reading()));
    const result = await triageReview(review(5, "Great food, felt a bit off later."), policy, new CascadeReviewReader(cheap, strong));
    expect(result).toMatchObject({ riskLevel: "high", sensitive: true, recommendedAction: "needs_review" });
    expect(strong.calls).toBe(0);
  });
});

describe("cascade reader: when it escalates", () => {
  it.each([
    ["the cheap model saw a complaint", review(5, "Lovely place."), ok(CHEAP, reading({ concern: "complaint" })), "primary_concern"],
    ["the cheap model saw personal info", review(5, "Lovely place."), ok(CHEAP, reading({ contains_personal_info: true })), "personal_info"],
    ["the rating is three stars or fewer", review(3, "Lovely place."), ok(CHEAP, reading()), "low_stars"],
    ["the review is not in English", review(5, "Muy rico todo."), ok(CHEAP, reading({ language: "es" })), "not_english"],
    ["the text is mostly a non-Latin script", review(5, "食物很好吃，服务员很友善。"), ok(CHEAP, reading()), "non_latin_script"],
    ["the review carries a link", review(5, "Great! See promo.example.xyz"), ok(CHEAP, reading()), "link"],
    ["the keyword rules already raised it", review(5, "Rude staff and we waited an hour."), ok(CHEAP, reading()), "rules_raised"],
    ["the cheap model failed", review(5, "Lovely place."), failed(CHEAP, "refused"), "primary_failed"],
  ])("escalates when %s", async (_label, r, first, reason) => {
    const strong = scripted(STRONG, () => ok(STRONG, reading()));
    const reader = new CascadeReviewReader(scripted(CHEAP, () => first), strong);
    await triageReview(r, policy, reader);
    expect(strong.calls).toBe(1);
    expect(reader.stats.escalationReasons[reason as keyof typeof reader.stats.escalationReasons]).toBe(1);
  });

  it("decides only from the review, the rules and the cheap reading (deterministic)", () => {
    const rules = policy.classify(review(5, "Lovely place."));
    const attempt = ok(CHEAP, reading());
    const once = escalationReasons(review(5, "Lovely place."), attempt, { rules });
    expect(escalationReasons(review(5, "Lovely place."), attempt, { rules })).toEqual(once);
    expect(once).toEqual([]);
    // Without the rules result it cannot know, so it escalates.
    expect(escalationReasons(review(5, "Lovely place."), attempt)).toContain("no_rules_context");
  });

  it("uses the stronger model's reading when the cheap model failed", async () => {
    const reader = new CascadeReviewReader(
      scripted(CHEAP, () => failed(CHEAP, "refused")),
      scripted(STRONG, () => ok(STRONG, reading({ concern: "sensitive", category: "safety" }))),
    );
    const result = await triageReview(review(5, "Found glass in my bread."), policy, reader);
    expect(result).toMatchObject({ riskLevel: "high", sensitive: true });
    expect(result.reasonCodes).not.toContain("reader_failed");
  });

  it("can only raise: the stronger model cannot clear the cheap model's concern", async () => {
    const reader = new CascadeReviewReader(
      scripted(CHEAP, () => ok(CHEAP, reading({ concern: "complaint" }))),
      scripted(STRONG, () => ok(STRONG, reading())),
    );
    const result = await triageReview(review(5, "Lovely place."), policy, reader);
    expect(result).toMatchObject({ riskLevel: "medium", recommendedAction: "needs_review" });
  });

  it("lets the stronger model raise a complaint to sensitive", async () => {
    const reader = new CascadeReviewReader(
      scripted(CHEAP, () => ok(CHEAP, reading({ concern: "complaint" }))),
      scripted(STRONG, () => ok(STRONG, reading({ concern: "sensitive", category: "medical" }))),
    );
    const result = await triageReview(review(4, "Nice, though my kid was sick that night."), policy, reader);
    expect(result).toMatchObject({ riskLevel: "high", sensitive: true });
    expect(result.reasonCodes[0]).toBe("sensitive_medical");
  });

  it("merges two readings by keeping the more serious concern, the more serious category and any personal info", () => {
    const merged = combineReadings(
      reading({ concern: "sensitive", category: "compensation", contains_personal_info: true }),
      reading({ concern: "sensitive", category: "medical" }),
    );
    expect(merged).toMatchObject({ concern: "sensitive", category: "medical", contains_personal_info: true });
    expect(combineReadings(reading({ concern: "complaint" }), reading())).toMatchObject({ concern: "complaint", category: "none" });
    expect(combineReadings(reading(), reading({ concern: "complaint" }))).toMatchObject({ concern: "complaint" });
  });

  it("fails closed when the escalation read fails, even if the cheap read succeeded", async () => {
    const reader = new CascadeReviewReader(
      scripted(CHEAP, () => ok(CHEAP, reading({ concern: "complaint" }))),
      scripted(STRONG, () => failed(STRONG, "api_error")),
    );
    const result = await triageReview(review(5, "Lovely place."), policy, reader);
    expect(result.recommendedAction).toBe("needs_review");
    expect(result.reasonCodes).toContain("reader_failed");
  });

  it("with escalation turned off, keeps the cheap reading and still fails closed on a failure", async () => {
    const complaint = new CascadeReviewReader(scripted(CHEAP, () => ok(CHEAP, reading({ concern: "complaint" }))), null);
    expect((await triageReview(review(5, "Lovely place."), policy, complaint)).riskLevel).toBe("medium");
    const broken = new CascadeReviewReader(scripted(CHEAP, () => failed(CHEAP, "refused")), null);
    expect((await triageReview(review(5, "Lovely place."), policy, broken)).reasonCodes).toContain("reader_failed");
  });
});

describe("cascade reader: identity, usage and cost", () => {
  it("names both models, the routing version and a prompt fingerprint in its id", () => {
    expect(cascadeReaderId(CHEAP, STRONG)).toMatch(/^routing-v1\[claude-haiku-5-5>claude-sonnet-5-5\]:reader-v1@[0-9a-f]{12}$/);
    expect(cascadeReaderId(CHEAP, null)).toMatch(/^routing-v1\[claude-haiku-5-5\]:reader-v1@[0-9a-f]{12}$/);
    expect(cascadeReaderId("claude-opus-5-5", STRONG)).not.toBe(cascadeReaderId(CHEAP, STRONG));
  });

  it("counts reads, escalations and tokens per model", async () => {
    const reader = new CascadeReviewReader(
      scripted(CHEAP, (r) => ok(CHEAP, reading({ concern: r.stars <= 3 ? "complaint" : "none" }))),
      scripted(STRONG, () => ok(STRONG, reading({ concern: "complaint" }))),
    );
    await triageReview(review(5, "Lovely place.", "a"), policy, reader);
    await triageReview(review(2, "Slow and cold.", "b"), policy, reader);
    expect(reader.stats.reads).toBe(2);
    expect(reader.stats.escalations).toBe(1);
    expect(reader.stats.byModel[CHEAP]).toEqual({ calls: 2, inputTokens: 2000, outputTokens: 400 });
    expect(reader.stats.byModel[STRONG]).toEqual({ calls: 1, inputTokens: 1000, outputTokens: 200 });
  });

  it("prices calls from the price table, per million tokens", () => {
    expect(costUsd(CHEAP, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(0.6);
    expect(costUsd(STRONG, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(12);
    expect(costUsd("claude-unknown-9", { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });

  it("never reports a cost it cannot compute: unknown prices and empty runs are not a number", () => {
    const stats = { reads: 2, escalations: 1, escalationReasons: {}, byModel: { [CHEAP]: { calls: 2, ...usage }, [STRONG]: { calls: 1, ...usage } } };
    const summary = usageSummary(stats);
    expect(summary.costPerReviewUsd).toBeCloseTo((costUsd(CHEAP, usage)! + costUsd(STRONG, usage)!) / 2);
    expect(summary.unknownPriceModels).toEqual([]);
    expect(Number.isNaN(usageSummary({ ...stats, byModel: { "claude-unknown-9": { calls: 1, ...usage } } }).costPerReviewUsd)).toBe(true);
    expect(Number.isNaN(usageSummary({ ...stats, reads: 0, byModel: {} }).costPerReviewUsd)).toBe(true);
  });
});

describe("recorded runs", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-readings-"));

  it("replays a recorded run with the same routing, readings and cost", async () => {
    const recorder = new ReadingRecorder();
    const live = new CascadeReviewReader(
      recorder.wrap(scripted(CHEAP, (r) => (r.stars <= 3 ? ok(CHEAP, reading({ concern: "complaint" })) : ok(CHEAP, reading())))),
      recorder.wrap(scripted(STRONG, () => ok(STRONG, reading({ concern: "sensitive", category: "medical" })))),
    );
    const reviews = [review(5, "Lovely place.", "a"), review(2, "Felt ill after.", "b")];
    const liveResults = [];
    for (const r of reviews) liveResults.push(await triageReview(r, policy, live));
    const file = path.join(dir, "run.json");
    recorder.save(file, live);

    const cache = loadReadingCache(file);
    expect(cache?.readerId).toBe(live.id);
    const replay = cascadeFromCache(cache!);
    expect(replay.id).toBe(live.id);
    for (const [i, r] of reviews.entries()) {
      const again = await triageReview(r, policy, replay);
      expect(again.recommendedAction).toBe(liveResults[i].recommendedAction);
      expect(again.riskLevel).toBe(liveResults[i].riskLevel);
    }
    expect(replay.stats.byModel).toEqual(live.stats.byModel);
    expect(replay.stats.escalations).toBe(1);
  });

  it("fails closed on a review the recording never saw", async () => {
    const recorder = new ReadingRecorder();
    const live = new CascadeReviewReader(recorder.wrap(scripted(CHEAP, () => ok(CHEAP, reading()))), recorder.wrap(scripted(STRONG, () => ok(STRONG, reading()))));
    await triageReview(review(5, "Lovely place."), policy, live);
    const file = path.join(dir, "small.json");
    recorder.save(file, live);
    const replay = cascadeFromCache(loadReadingCache(file)!);
    const result = await triageReview(review(5, "A review nobody recorded."), policy, replay);
    expect(result.reasonCodes).toContain("reader_failed");
  });

  it("rejects a readings file that does not match the schema instead of replaying it", () => {
    const file = path.join(dir, "junk.json");
    writeFileSync(file, JSON.stringify({ readerId: "x", createdAt: "", readings: {} }));
    expect(() => loadReadingCache(file)).toThrow(/not a valid readings file/);
  });
});
