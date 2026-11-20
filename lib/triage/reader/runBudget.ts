import { costUsd } from "./pricing";
import { REQUEST_CONTRACT } from "./requestContract";
import type { ReadAttempt } from "./types";

/** Reservations bound dispatch under the pinned tariff; this is not a provider billing cap. */
export class RunBudget {
  readonly signal = AbortSignal.timeout(REQUEST_CONTRACT.runTimeoutMs);
  calls = 0;
  tokenCountCalls = 0;
  reservedUsd = 0;
  stopped: string | null = null;
  private readonly startedAt: number;
  constructor(readonly maxCostUsd: number, readonly maxCalls: number, private readonly now = Date.now) {
    if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || !Number.isSafeInteger(maxCalls) || maxCalls <= 0) {
      throw new Error("A positive finite budget and call limit are required");
    }
    this.startedAt = now();
  }
  stop(reason: string): never {
    this.stopped = reason;
    throw new Error(reason);
  }
  assertActive(): void {
    if (this.stopped) throw new Error(this.stopped);
    if (this.signal.aborted || this.now() - this.startedAt >= REQUEST_CONTRACT.runTimeoutMs) this.stop("Run time limit reached");
  }
  preflight(model: string): void {
    this.assertActive();
    if (this.calls >= this.maxCalls || this.tokenCountCalls >= this.maxCalls) this.stop("Call limit reached");
    const reservation = this.reservation(model);
    if (this.reservedUsd + reservation > this.maxCostUsd + 1e-12) this.stop("Insufficient remaining budget");
    this.tokenCountCalls += 1;
  }
  private reservation(model: string): number {
    const cost = costUsd(model, { inputTokens: REQUEST_CONTRACT.maxInputTokens, outputTokens: REQUEST_CONTRACT.maxOutputTokens });
    if (cost === null) return this.stop("Model has no qualified price");
    return cost;
  }
  reserve(model: string, inputTokens: number): void {
    this.assertActive();
    if (!Number.isSafeInteger(inputTokens) || inputTokens <= 0 || inputTokens > REQUEST_CONTRACT.maxInputTokens) this.stop("Input token bound exceeded or unknown");
    if (this.calls >= this.maxCalls) this.stop("Call limit reached");
    const reservation = this.reservation(model);
    if (this.reservedUsd + reservation > this.maxCostUsd + 1e-12) this.stop("Insufficient remaining budget");
    this.reservedUsd += reservation;
    this.calls += 1;
  }
  observe(attempt: ReadAttempt): void {
    if (!attempt.ok || attempt.usageKnown !== true) this.stop("Reader attempt failed or usage is unknown");
    if (attempt.usage.inputTokens > REQUEST_CONTRACT.maxInputTokens || attempt.usage.outputTokens > REQUEST_CONTRACT.maxOutputTokens) this.stop("Provider usage exceeded reserved bounds");
  }
}
