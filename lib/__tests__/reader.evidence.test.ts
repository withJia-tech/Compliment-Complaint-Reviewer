import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterAll, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { validateRecording, implementationFingerprint, type EvidenceBinding } from "@/lib/eval/readerEvidence";
import { ReadingCacheFileSchema, OMITTED_RATIONALE, cascadeFromCache, readingKey, writeNewRecording, type ReadingCacheFile } from "@/lib/triage/reader/cachedReader";
import { cascadeReaderId } from "@/lib/triage/reader/cascade";
import { RunBudget } from "@/lib/triage/reader/runBudget";
import { REQUEST_CONTRACT } from "@/lib/triage/reader/requestContract";
import { ClaudeReviewReader, readerClient } from "@/lib/triage/reader/claudeReader";
import { costUsd, usageSummary } from "@/lib/triage/reader/pricing";
import { triageReview } from "@/lib/triage/triageReview";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { Review } from "@/lib/types";

const primary = "claude-haiku-5-5", escalation = "claude-sonnet-5-5";
const review: Review = { id: "synthetic", locationId: "synthetic", author: "Synthetic", stars: 5, text: "Excellent coffee.", createTime: "", updateTime: "" };
const key = readingKey(review);
const reading = { language: "en", concern: "none" as const, category: "none" as const, contains_personal_info: false, rationale: OMITTED_RATIONALE };
const binding: EvidenceBinding = { implementationSha256: "1".repeat(64), datasetSha256: "2".repeat(64), reviewSetSha256: "3".repeat(64), requestSha256: "4".repeat(64) };
const identity = cascadeReaderId(primary, escalation);
function good(): ReadingCacheFile {
  return { format: 3, readerId: identity, createdAt: new Date(0).toISOString(), models: { primary, escalation }, evidence: { ...binding, sourceCommit: "a".repeat(40), maxCalls: 2, maxCostUsd: 1, tokenCountCalls: 1, generationCalls: 1, completed: true }, attempts: { [primary]: { [key]: { ok: true, reading: { ...reading }, usage: { inputTokens: 100, outputTokens: 20 }, usageKnown: true, observedModel: primary, responseId: "synthetic_response" } } } };
}
const validate = (cache: ReadingCacheFile) => validateRecording(cache, [review], binding, identity);
const dir = mkdtempSync(path.join(tmpdir(), "ccr-evidence-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("recording evidence contract", () => {
  it("accepts a complete synthetic control and replays identical outcomes, usage and escalation twice", async () => {
    const cache = good();
    expect(ReadingCacheFileSchema.safeParse(cache).success).toBe(true);
    expect(validate(cache)).toMatchObject({ calls: 1, attemptFailures: 0 });
    const a = cascadeFromCache(cache), b = cascadeFromCache(cache), policy = new DefaultTriagePolicy(() => new Date(0));
    expect(await triageReview(review, policy, a)).toEqual(await triageReview(review, policy, b));
    expect(a.stats).toEqual(b.stats);
    expect(usageSummary(a.stats)).toEqual(usageSummary(b.stats));
  });
  it.each(Object.keys(binding) as (keyof EvidenceBinding)[])("rejects stale %s", (field) => {
    const cache = good(); cache.evidence![field] = "0".repeat(64);
    expect(() => validate(cache)).toThrow(/Stale/);
  });
  it("fingerprints executable bytes, including changes without a version bump", () => {
    const baseline = implementationFingerprint(() => "original");
    expect(implementationFingerprint((file) => file.endsWith("cascade.ts") ? "changed" : "original")).not.toBe(baseline);
  });
  it("rejects missing primary attempts independently of a successful secondary", () => {
    const cache = good(); const first = cache.attempts[primary][key];
    cache.attempts = { [escalation]: { [key]: { ...first, observedModel: escalation } } };
    expect(() => validate(cache)).toThrow(/Missing primary/);
  });
  it("rejects missing required escalation and unexpected extra attempts", () => {
    const cache = good(); const first = cache.attempts[primary][key];
    if (first.ok) first.reading.concern = "complaint";
    expect(() => validate(cache)).toThrow(/Missing required escalation/);
    const extra = good(); extra.attempts[escalation] = { [key]: { ...extra.attempts[primary][key], observedModel: escalation } };
    expect(() => validate(extra)).toThrow(/unused/);
  });
  it("counts a recovered refusal as an attempt failure", async () => {
    const cache = good(); const second = { ...cache.attempts[primary][key], observedModel: escalation };
    cache.attempts[primary][key] = { ok: false, reason: "refused", usage: { inputTokens: 100, outputTokens: 0 }, usageKnown: true, observedModel: primary, responseId: "synthetic_refusal" };
    cache.attempts[escalation] = { [key]: second };
    cache.evidence!.generationCalls = cache.evidence!.tokenCountCalls = 2;
    expect(validate(cache)).toMatchObject({ primaryFailures: 1, recoveredReads: 1, attemptFailures: 1 });
    const reader = cascadeFromCache(cache);
    expect((await triageReview(review, new DefaultTriagePolicy(), reader)).reasonCodes).not.toContain("reader_failed");
    expect(reader.stats).toMatchObject({ primaryFailures: 1, recoveredReads: 1 });
  });
  it("rejects an unknown-cost failure even if it might recover", () => {
    const cache = good(); cache.attempts[primary][key] = { ok: false, reason: "api_error", usageKnown: false, usage: { inputTokens: 0, outputTokens: 0 } };
    expect(() => validate(cache)).toThrow(/Unknown usage/);
  });
  it("rejects incomplete, unbound, over-budget and unreconciled recordings", () => {
    const incomplete = good(); incomplete.evidence!.completed = false;
    const unbound = good(); delete unbound.evidence;
    const over = good(); over.evidence!.maxCostUsd = 0.000001;
    const counts = good(); counts.evidence!.generationCalls = 0;
    for (const cache of [incomplete, unbound, over, counts]) expect(() => validate(cache)).toThrow();
  });
  it("rejects zero usage, model prose, observed-model disagreement and legacy format", () => {
    for (const mutate of [
      (cache: ReadingCacheFile) => { cache.attempts[primary][key].usage.inputTokens = 0; },
      (cache: ReadingCacheFile) => { const a = cache.attempts[primary][key]; if (a.ok) a.reading.rationale = "Person Synthetic Name lives at 12 Example Road"; },
      (cache: ReadingCacheFile) => { cache.attempts[primary][key].observedModel = escalation; },
    ]) { const cache = good(); mutate(cache); expect(ReadingCacheFileSchema.safeParse(cache).success).toBe(false); }
    expect(ReadingCacheFileSchema.safeParse({ ...good(), format: 2 }).success).toBe(false);
  });
  it("writes private evidence once and leaves no partial file on collision", () => {
    const file = path.join(dir, "new.json");
    writeNewRecording(file, "first");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(() => writeNewRecording(file, "second")).toThrow();
    expect(readFileSync(file, "utf8")).toBe("first");
    expect(readdirSync(dir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});

describe("bounded execution", () => {
  it.each([0, -1, NaN, Infinity])("rejects invalid spend cap %s", (cost) => expect(() => new RunBudget(cost, 2)).toThrow());
  it("blocks dispatch before overspending and never refunds a reservation to hide failed usage", () => {
    const cap = costUsd(primary, { inputTokens: REQUEST_CONTRACT.maxInputTokens, outputTokens: REQUEST_CONTRACT.maxOutputTokens })!;
    const budget = new RunBudget(cap, 2);
    budget.preflight(primary); budget.reserve(primary, 500);
    expect(() => budget.preflight(primary)).toThrow(/budget/);
    expect(budget.calls).toBe(1);
  });
  it("enforces call, token and elapsed-time bounds", () => {
    const calls = new RunBudget(1, 1); calls.preflight(primary); calls.reserve(primary, 500);
    expect(() => calls.preflight(primary)).toThrow(/Call limit/);
    const tokens = new RunBudget(1, 1); tokens.preflight(primary);
    expect(() => tokens.reserve(primary, REQUEST_CONTRACT.maxInputTokens + 1)).toThrow(/Input token/);
    let now = 0; const timeout = new RunBudget(1, 1, () => now); now = REQUEST_CONTRACT.runTimeoutMs;
    expect(() => timeout.preflight(primary)).toThrow(/time limit/);
  });
  it("stops after unknown usage and rejects usage beyond the reserved token bound", () => {
    const budget = new RunBudget(1, 2);
    expect(() => budget.observe({ model: primary, ok: false, reason: "api_error", usageKnown: false, usage: { inputTokens: 0, outputTokens: 0 } })).toThrow(/unknown/);
    expect(() => budget.preflight(primary)).toThrow(/unknown/);
    const over = new RunBudget(1, 1);
    expect(() => over.observe({ model: primary, ok: true, reading, usageKnown: true, usage: { inputTokens: 100, outputTokens: 4097 } })).toThrow(/exceeded/);
  });
  it("pins endpoint and disables SDK retries and logging even with ambient overrides", () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://example.invalid"); vi.stubEnv("ANTHROPIC_LOG", "debug");
    try { const client = readerClient("synthetic-key"); expect(client.baseURL).toBe(REQUEST_CONTRACT.endpoint); expect(client.maxRetries).toBe(0); expect(client.logLevel).toBe("off"); }
    finally { vi.unstubAllEnvs(); }
  });
  it("counts tokens before generating; sends neither tools nor server fallback", async () => {
    const events: string[] = [];
    const countTokens = vi.fn(async () => { events.push("count"); return { input_tokens: 100 }; });
    const create = vi.fn(async () => { events.push("create"); return { id: "synthetic_response", model: primary, stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 }, content: [{ type: "text", text: JSON.stringify(reading) }] }; });
    const budget = new RunBudget(1, 1);
    const result = await new ClaudeReviewReader({ budget, client: { beta: { messages: { countTokens, create } } } as unknown as Anthropic }).attempt(review);
    expect(result).toMatchObject({ ok: true, usageKnown: true });
    expect(events).toEqual(["count", "create"]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 4096, service_tier: "standard_only" }), expect.objectContaining({ maxRetries: 0, timeout: 60_000 }));
    expect((create.mock.calls as unknown[][])[0][0]).not.toHaveProperty("fallbacks");
    expect((create.mock.calls as unknown[][])[0][0]).not.toHaveProperty("tools");
  });
  it("does not generate when the token preflight fails or exceeds the bound", async () => {
    for (const countTokens of [vi.fn().mockRejectedValue(new Error("offline")), vi.fn().mockResolvedValue({ input_tokens: 100_000 })]) {
      const create = vi.fn();
      const reader = new ClaudeReviewReader({ budget: new RunBudget(1, 1), client: { beta: { messages: { countTokens, create } } } as unknown as Anthropic });
      await expect(reader.attempt(review)).rejects.toThrow(); expect(create).not.toHaveBeenCalled();
    }
  });
  it("preserves known billed usage on malformed JSON and rejects hidden fallback usage", async () => {
    const response = { id: "synthetic_response", model: primary, stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 }, content: [{ type: "text", text: "invalid JSON" }] };
    const create = vi.fn().mockResolvedValue(response);
    const reader = new ClaudeReviewReader({ client: { beta: { messages: { create } } } as unknown as Anthropic });
    expect(await reader.attempt(review)).toMatchObject({ ok: false, reason: "unparsed", usageKnown: true, usage: { inputTokens: 100, outputTokens: 20 } });
    create.mockResolvedValue({ ...response, usage: { ...response.usage, iterations: [{ model: escalation }] } });
    expect(await reader.attempt(review)).toMatchObject({ ok: false, usageKnown: false });
    create.mockResolvedValue({ ...response, content: [{ type: "text", text: JSON.stringify(reading) }], usage: { ...response.usage, iterations: [{ type: "message", model: primary, input_tokens: 100, output_tokens: 20 }] } });
    expect(await reader.attempt(review)).toMatchObject({ ok: true, usageKnown: true });
    create.mockResolvedValue({ ...response, usage: { ...response.usage, service_tier: "priority" } });
    expect(await reader.attempt(review)).toMatchObject({ ok: false, usageKnown: false });
  });
});
