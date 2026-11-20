import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { loadGoldenFixtures } from "@/lib/eval/goldenEval";
import { OMITTED_RATIONALE, ReadingCacheFileSchema, ReadingRecorder, cascadeFromCache, readingKey } from "@/lib/triage/reader/cachedReader";
import { CascadeReviewReader, cascadeReaderId } from "@/lib/triage/reader/cascade";
import { ClaudeReviewReader } from "@/lib/triage/reader/claudeReader";
import { ReviewReadingSchema } from "@/lib/triage/reader/types";
import type { Review } from "@/lib/types";

const primary = "claude-haiku-5-5", escalation = "claude-sonnet-5-5";
const review: Review = { id: "audit", locationId: "test", author: "Synthetic", stars: 5, text: "Lovely place.", createTime: "", updateTime: "" };
const reading = { language: "en", concern: "none" as const, category: "none" as const, contains_personal_info: false, rationale: OMITTED_RATIONALE };
const usage = { inputTokens: 100, outputTokens: 20 };
const attempt = { ok: true as const, reading, usage, usageKnown: true, observedModel: primary, responseId: "synthetic_test" };
const key = readingKey(review);
const cache = () => ({ format: 3 as const, readerId: cascadeReaderId(primary, escalation), createdAt: new Date(0).toISOString(), models: { primary, escalation }, attempts: { [primary]: { [key]: attempt } } });
const dir = mkdtempSync(path.join(tmpdir(), "ccr-hardening-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("audit counterexamples", () => {
  it("rejects a declared cascade whose actual models differ", () => {
    expect(() => cascadeFromCache({ ...cache(), models: { primary, escalation: null } })).toThrow();
  });
  it("does not rescue a missing primary recording with a secondary recording", async () => {
    const reader = cascadeFromCache({ ...cache(), attempts: { [escalation]: { [key]: { ...attempt, observedModel: escalation } } } });
    const result = await triageReviewForTest(reader);
    expect(result.reasonCodes).toContain("reader_failed");
    expect(reader.stats.escalations).toBe(0);
  });
  it("rejects success with zero input tokens", () => {
    expect(ReadingCacheFileSchema.safeParse({ ...cache(), attempts: { [primary]: { [key]: { ...attempt, usage: { inputTokens: 0, outputTokens: 0 } } } } }).success).toBe(false);
  });
  it("rejects semantically inconsistent reading fields", () => {
    expect(ReviewReadingSchema.safeParse({ ...reading, concern: "sensitive", category: "none" }).success).toBe(false);
    expect(ReviewReadingSchema.safeParse({ ...reading, concern: "none", category: "safety" }).success).toBe(false);
  });
  it("disables hidden fallback on Sonnet requests", async () => {
    const create = vi.fn().mockResolvedValue({ id: "synthetic_test", model: escalation, stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 }, content: [{ type: "text", text: JSON.stringify(reading) }] });
    await new ClaudeReviewReader({ model: escalation, client: { beta: { messages: { create } } } as unknown as Anthropic }).attempt(review);
    expect(create.mock.calls[0][0].fallbacks).toBeUndefined();
  });
  it("rejects a response served by a different model", async () => {
    const create = vi.fn().mockResolvedValue({ id: "synthetic_test", model: "claude-sonnet-5", stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 }, content: [{ type: "text", text: JSON.stringify(reading) }] });
    const result = await new ClaudeReviewReader({ model: escalation, client: { beta: { messages: { create } } } as unknown as Anthropic }).attempt(review);
    expect(result.ok).toBe(false);
  });
  it("marks API-error billing unknown rather than known free", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network"));
    const result = await new ClaudeReviewReader({ client: { beta: { messages: { create } } } as unknown as Anthropic }).attempt(review);
    expect(result).toMatchObject({ ok: false, usageKnown: false });
  });
  it("does not overwrite an existing recording", async () => {
    const recorder = new ReadingRecorder();
    const live = new CascadeReviewReader(recorder.wrap({ model: primary, attempt: async () => ({ model: primary, ...attempt }) }), null);
    await triageReviewForTest(live);
    const file = path.join(dir, "existing.json");
    writeFileSync(file, "existing evidence");
    expect(() => recorder.save(file, live)).toThrow();
    expect(readFileSync(file, "utf8")).toBe("existing evidence");
  });
  it("enforces the frozen manifest when loading golden fixtures outside npm test", () => {
    const file = path.join(dir, "risk_classifier_v1.jsonl");
    writeFileSync(file, "{}\n");
    writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify({ "risk_classifier_v1.jsonl": { status: "approved", fixtures: 1, sha256: "0".repeat(64) } }));
    expect(() => loadGoldenFixtures(file)).toThrow();
  });
});

async function triageReviewForTest(reader: CascadeReviewReader) {
  const { triageReview } = await import("@/lib/triage/triageReview");
  return triageReview(review, new DefaultTriagePolicy(() => new Date(0)), reader);
}
