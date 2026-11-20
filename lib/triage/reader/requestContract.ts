/** Fixed, qualified request settings. No implicit provider fallback or SDK retries. */
export const REQUEST_CONTRACT = {
  version: "bounded-reader-v1",
  endpoint: "https://api.anthropic.com",
  maxOutputTokens: 4096,
  maxInputTokens: 8192,
  effort: "low",
  serviceTier: "standard_only",
  maxRetries: 0,
  timeoutMs: 60_000,
  runTimeoutMs: 30 * 60_000,
  serverFallback: false,
  structuredOutputBeta: "structured-outputs-2025-12-15",
} as const;
