// v1.0.0: initial star-band + keyword-heuristic policy, no LLM classifier.
// v1.1.0 (PR #8): fail-closed quick approve — 4-5 stars needs praise present, no
//         contrast marker, and readable language; dev-derived sensitive
//         phrases; idiom exemptions; shadow B1 wouldAutoSend.
//         (PR #6 also shipped a different rule set as v1.1.0: normalised matching,
//         a prompt-injection rule and guards. Both are superseded by v1.2.0.)
// v1.2.0: the two v1.1.0 rule sets combined. Guards and a second reader that
//         raise a review also clear shadow wouldAutoSend.
export const POLICY_VERSION = "policy-v1.2.0";
