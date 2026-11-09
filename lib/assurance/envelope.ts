// Shared handoff envelope and the consumer rules every stage enforces
// (spec v0.5 §4.1–4.2). A consumer never repairs a record: it accepts it,
// or routes it to the human queue with the rule that failed.

import { ABSTAIN_REASON_CODES, type HandoffEnvelope, type HandoffType, type SourceRef } from "@/lib/assurance/types";
import { arr, nullable, obj, oneOf, str, validate, type Issue, type Validator } from "@/lib/assurance/schema";
import { sourceRefSchema } from "@/lib/assurance/payloadSchemas";

const HANDOFF_TYPES: readonly HandoffType[] = [
  "review_snapshot",
  "interpretation_result",
  "policy_decision",
  "draft_proposal",
  "assurance_report",
  "approval_record",
];

const ID = str({ nonEmpty: true, maxLength: 200 });

/** Envelope shape with the payload checked separately (it depends on status). */
const envelopeShape: Validator = obj({
  handoff_type: oneOf(HANDOFF_TYPES),
  contract_version: str({ nonEmpty: true, maxLength: 20 }),
  run_id: ID,
  stage_id: ID,
  producer: obj({ kind: oneOf(["model", "code", "human"]), id: ID, model_version: nullable(ID) }),
  produced_at: str({ nonEmpty: true, maxLength: 40 }),
  source_ref: sourceRefSchema,
  input_hashes: arr(str({ maxLength: 100 })),
  status: oneOf(["ok", "abstain"]),
  abstain: nullable(obj({ reason_code: oneOf(ABSTAIN_REASON_CODES), detail: str({ maxLength: 500 }) })),
  payload: () => undefined, // validated below
});

export interface ConsumerExpectation {
  handoffType: HandoffType;
  contractVersion: string;
  /** The run's pinned snapshot; every handoff must match it (rule 3). */
  sourceRef: SourceRef;
}

export type HandoffVerdict<P> =
  | { kind: "accepted"; envelope: HandoffEnvelope<P> }
  | { kind: "abstained"; reasonCode: string; detail: string }
  | { kind: "rejected"; rule: 1 | 2 | 3 | 4 | 5; issues: Issue[] };

/**
 * Applies consumer rules 1–5. Rule 6 (bounded free text) lives in the
 * schemas; rule 7 (log and route) is the caller's job on any non-accepted
 * verdict — both "abstained" and "rejected" go to the human queue.
 */
export function consumeHandoff<P>(
  raw: unknown,
  expect: ConsumerExpectation,
  payloadSchema: Validator,
  semantic?: (payload: P) => Issue[],
): HandoffVerdict<P> {
  // Rule 1: unknown fields, missing fields, out-of-enum values. No coercion.
  const shapeIssues = validate(raw, envelopeShape);
  if (shapeIssues.length > 0) return { kind: "rejected", rule: 1, issues: shapeIssues };
  const env = raw as HandoffEnvelope<P>;

  if (env.handoff_type !== expect.handoffType) {
    return {
      kind: "rejected",
      rule: 1,
      issues: [{ path: "handoff_type", code: "out_of_enum", message: `expected ${expect.handoffType}` }],
    };
  }

  // Rule 2: contract version must match exactly.
  if (env.contract_version !== expect.contractVersion) {
    return {
      kind: "rejected",
      rule: 2,
      issues: [
        {
          path: "contract_version",
          code: "out_of_enum",
          message: `${env.contract_version} ≠ consumer ${expect.contractVersion}`,
        },
      ],
    };
  }

  // Rule 3: same source version and text hash as the run's snapshot.
  const ref = env.source_ref;
  const mismatched = (["review_id", "source_version", "text_sha256"] as const).filter(
    (key) => ref[key] !== expect.sourceRef[key],
  );
  if (mismatched.length > 0) {
    return {
      kind: "rejected",
      rule: 3,
      issues: mismatched.map((key) => ({
        path: `source_ref.${key}`,
        code: "out_of_enum" as const,
        message: "does not match the run's snapshot",
      })),
    };
  }

  // Rule 4: abstain carries a reason and no payload; ok carries a payload and no abstain.
  if (env.status === "abstain") {
    if (env.abstain === null || env.payload !== null) {
      return {
        kind: "rejected",
        rule: 4,
        issues: [{ path: "abstain", code: "missing_field", message: "abstain needs a reason and a null payload" }],
      };
    }
    return { kind: "abstained", reasonCode: env.abstain.reason_code, detail: env.abstain.detail };
  }
  if (env.abstain !== null || env.payload === null) {
    return {
      kind: "rejected",
      rule: 4,
      issues: [{ path: "payload", code: "missing_field", message: "ok needs a payload and a null abstain" }],
    };
  }

  // Rule 5: payload schema, then context-dependent semantic rules.
  const payloadIssues = validate(env.payload, payloadSchema, "payload");
  if (payloadIssues.length > 0) return { kind: "rejected", rule: 5, issues: payloadIssues };
  const semanticIssues = semantic ? semantic(env.payload as P) : [];
  if (semanticIssues.length > 0) return { kind: "rejected", rule: 5, issues: semanticIssues };

  return { kind: "accepted", envelope: env };
}
