# Local verification — 20 November 2026

Branch: `audit/pr6-reader-evidence-hardening`.
Inspected base: `b5c301a6c19563a8700a3c6a99f7e38c771251b9` (PR #6).
Environment: Node v24.22.3; dependencies installed from the unchanged lockfile with
`npm ci --ignore-scripts --no-audit --no-fund`.

## Executed checks

| Check | Observed result |
|---|---|
| Nine audit regressions on the original implementation | All nine failed before fixes |
| Full Vitest suite | 339 passed; 24 test files; zero failed, skipped or todo |
| `scripts/ci/noSkippedTests.ts` against the JSON test report | 339 passed, zero failed/skipped/todo |
| `npm run typecheck` | Exit 0 |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | Exit 0; Next.js production build completed |
| Three focused mutation probes | Removing identity validation, budget enforcement or provenance binding caused the relevant regression to fail; all mutations restored |
| `npm run read:golden` with explicit default model IDs | Exit 0; no requests, client or output files |
| `npm run eval:gate -- --stdout-only` | Expected exit 1: rules-only passes; model-assisted mode is `not_run` because recording is absent |
| `git diff --check` | Pass |
| Byte comparison with the inspected base | All 14 tracked files under the protected dataset/threshold/routing-fixture paths and policy/rules/match files unchanged |

The full suite adds 42 regression tests to the original 297. Synthetic cache fixtures are test
inputs only; no real provider recording or golden reading artifact was created. CLI authorization
tests block network access explicitly. The production build does not establish live-provider
compatibility or production readiness.

## Observed dry-run output

Command:

```bash
CCR_READER_MODEL=claude-haiku-5-5 \
CCR_READER_ESCALATION_MODEL=claude-sonnet-5-5 \
npm run read:golden
```

Relevant output (npm wrapper messages omitted):

```text
47 non-empty reviews; routing-v2[claude-haiku-5-5>claude-sonnet-5-5]:reader-v1@904375705b35.
Estimate at 900 input / 400 output tokens per call: $0.28623 (not a ceiling).
Full reservation at input/output bounds: $2.82993; at most 94 generation and 94 token-count requests.
Endpoint https://api.anthropic.com; retries 0; server fallback off; request timeout 60s; run timeout 30m.
Dry run: no client created, no requests sent, no files written. Live execution needs --yes --max-cost-usd <budget> --max-calls <limit> --out <new-absolute-private-path> and separate owner approval.
```

## Gate results and their limits

| Golden mode | Result | Exact | Sensitive recall | Unsafe quick approvals | False alarms |
|---|---|---|---|---|---|
| Rules only | Pass against its unchanged baseline thresholds | 30/49 | 17/30 | 1 | 4 |
| Rules plus reader | Not run; overall gate fails | Unknown | Unknown | Unknown | Unknown |

The rules-only pass permits the recorded baseline weaknesses; it does not meet the stronger proposed
model-assisted safety thresholds. The unsafe quick approval remains RC-311. Separate routing
development/holdout evaluations remain unchanged and are included in the regression suite. Their
passing ratchet gates do not mean zero safety failures or prove generalisation.

No fresh GitHub CI run was initiated. Earlier GitHub/author-reported results belong to the inspected
base, not this patch. No external model call, real recording, push, merge, deployment or reply
publication was performed. Live model/schema acceptance, billing reconciliation and the second
reader's incremental safety benefit remain unverified.

See [reader evidence hardening](READER_EVIDENCE_HARDENING.md) for the exact proposed paid command,
approval boundary, bounded execution procedure and offline verification. The US$3 local reservation
budget is not a provider-enforced invoice cap. Approval of this local patch does not authorize that run.
