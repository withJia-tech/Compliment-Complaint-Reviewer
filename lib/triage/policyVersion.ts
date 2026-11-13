// v1.0.0: initial star-band + keyword-heuristic policy, no LLM classifier.
// v1.1.0: normalised matching (spaced, dotted, zero-width, leetspeak), a
//   prompt-injection rule, and deterministic guards for personal info, links
//   and gibberish. An optional second reader (lib/triage/reader) can only raise.
export const POLICY_VERSION = "policy-v1.1.0";
