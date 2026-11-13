import { createHash } from "node:crypto";
import type {
  ApprovedBusinessFacts,
  Draft,
  Review,
  TriageResult,
} from "@/lib/types";

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export interface ReplyContext {
  review: Review;
  triage: TriageResult;
  draft: Draft;
}

/** A freshness token, NOT an authentication credential. Includes the text the user saw. */
export function contextVersion(
  context: ReplyContext,
  facts: ApprovedBusinessFacts,
): string {
  return fingerprint({ ...context, facts });
}

export interface SendConfirmation {
  contextVersion: string;
  /** The person confirms factual support and absence of private/personnel information. */
  reviewed: boolean;
}
