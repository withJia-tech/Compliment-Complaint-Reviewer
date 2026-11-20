# PR #6: reader evidence hardening

Local implementation authorized on 20 November 2026 after the read-only audit. Base:
`b5c301a6c19563a8700a3c6a99f7e38c771251b9`. This authorization covers code and regression tests,
not paid requests, recording model outputs, pushing, merging, deployment or publishing replies.

## Decision and trust boundaries

Keep the deterministic policy and its monotonic reader unchanged in purpose: models interpret
stars/text; code validates output and controls execution; humans retain reply approval. No dataset,
label, threshold, keyword rule, or held-out failure was changed to improve scores. This is an
experimental evidence gate, not production release authorization.

The missing recording was the only reported failing golden CI dependency, but did not establish
that the recording procedure or evaluation evidence was trustworthy. This patch repairs those
controls before asking for paid-run approval.

| Audit defect | Implemented control |
|---|---|
| Claimed reader ID could disagree with actual replay models | Format 3 validates the reconstructed identity and each successful attempt's observed model and provider response ID |
| Missing primary reading could be rescued by cached secondary | Missing primary cache entries fail closed immediately; golden validation independently checks every required primary/escalation key and rejects unused attempts |
| Recovered failures disappeared from the gate | Stage failures, recoveries and final failures are distinct; the existing zero `readerFailures` threshold now counts all failed model attempts, including recovered refusals |
| Default server-side fallback silently added another model | Removed for every model; unexpected model, multiple/fallback iterations or cache-usage responses are rejected rather than mispriced |
| API/parse exceptions appeared free | API usage is unknown; raw responses are validated locally so malformed JSON retains its observed token usage |
| Printed estimate called a ceiling | Separate illustrative estimate from maximum token reservations, with explicit call, input, output, request-time and run-time controls |
| Recording could overwrite earlier evidence | Explicit output outside the repository; private file mode; atomic no-clobber publication even if a competing process creates the destination |
| Prompt fingerprint did not bind executable routing/request settings | Request contract joins the reader fingerprint; evidence also binds dataset bytes, review-key set, relevant source/dependency bytes and source commit |
| Model prose could repeat personal details | Persistent rationale is a fixed omission marker; language is a bounded tag; arbitrary model prose is not recorded |
| Standalone reading/gate did not verify the frozen manifest | Both now load through checksum, approval, count, ID and version validation |
| CLI match count omitted category correctness | CLI uses the same golden judge as the gate |
| Replay reproducibility was assumed | Gate replays twice and compares every scored outcome and reader statistic |

`routing-v2` changes cache-miss handling and observability, not the review-content escalation rules.
Reader prompt text is unchanged. Format 2 recordings are rejected, never silently upgraded. No
existing recording is modified. Source fingerprints are deliberately byte-sensitive; even a relevant
formatting change invalidates the recording. Source commit verification requires the recorded commit
to be available locally; CI's full-history evaluation checkout supplies it.

Application recovery from a known primary refusal remains possible. The bounded experiment is
stricter: any failed model attempt stops the run and produces only an incomplete diagnostic recording.
That distinction prevents spending the entire budget on a configuration error. A repeated run needs
new approval and a new output path. A process killed before final save may leave no recording; it must
not be silently resumed or rerun.

## Verification

The nine audit regressions were written first: all nine failed on the base implementation.
They subsequently passed with the patch. Additional tests cover provenance, required/missing/extra
attempts, recovery counts, unknown usage, privacy, no-clobber saving, budget/call/time/input limits,
request settings, token-count failures, malformed output, reproducible replay and CLI authorization.

Three deliberate mutations were detected: removing cache identity checks, disabling reservation-budget
checks and bypassing provenance binding each caused its focused regression test to fail. Every
mutation was restored before final verification. Targeted mutation commands select tests; they do not
represent the complete no-skips suite.

Final verification is recorded in `READER_HARDENING_VERIFICATION.md`. Full unit tests include the
60-case development and 40-case holdout regression gates; no tuning used held-out failures. The golden
rules-only result remains 30/49 exact, 17/30 sensitive recall, one unsafe quick approval and four false
alarms. The two-mode gate must still exit 1 because no real model recording has been authorized.

## Dry run: no approval or API key needed

From this checkout:

```bash
CCR_READER_MODEL=claude-haiku-5-5 \
CCR_READER_ESCALATION_MODEL=claude-sonnet-5-5 \
npm run read:golden
```

Expected: 47 non-empty reviews, `routing-v2`, an illustrative all-escalated estimate of **US$0.28623**
at 900 input / 400 output tokens per call, and a full reservation of **US$2.82993** at the configured
8,192 input / 4,096 output bounds. No client is created, no network request is sent, no file is written.
The package commands use `node --import tsx`, avoiding the tsx CLI's IPC listener in restricted hosts.

## Exact proposed external run — NOT authorized or executed

Proposed scope: the frozen 49-case golden dataset only; 47 non-empty texts. No demo run, no holdout
model run, no model comparison using extra API calls. Transmitted content is stars/text, the fixed
system prompt and JSON schema; author metadata, expected labels and notes are not sent. Personal
details embedded in review text are still transmitted, including to the token-count endpoint.

| Control | Proposed value |
|---|---|
| Models | `claude-haiku-5-5`, then `claude-sonnet-5-5` only when existing code requires escalation |
| Endpoint | `https://api.anthropic.com` |
| Service tier | Explicit `standard_only`; unexpected priority/batch usage is rejected |
| Generation calls | At most 94: 47 primary plus at most 47 secondary |
| Token-count requests | At most 94, one before each generation attempt |
| Reservation budget | US$3.00; full 94-call token reservation is US$2.82993 |
| Input/output | Reject preflight counts over 8,192; request `max_tokens=4096`; reject observed usage outside bounds |
| Retries/fallback | Zero automatic retries; no server-side fallback |
| Time | 60 seconds per request; 30 minutes for the run |
| Failure | Stop; save incomplete diagnostics if possible; exit nonzero; no automatic rerun |
| File | New owner-private absolute path outside the checkout; never replace a previous file |

Token counting is currently free but is an external request carrying the same review input. The
provider describes token counting as an estimate, and pricing/actual usage remain provider-owned.
The local US$3 reservation control is **not a provider-enforced invoice cap**: unknown billing after
transport failure requires reconciliation. Confirm current tariffs and a provider-side spending limit
if an absolute billing ceiling is required. References checked 20 November 2026:
[Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting),
[Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

After separate approval, verify `git status --short` is empty and `git rev-parse HEAD` matches the
reviewed local commit. The owner configures the key in their execution environment, never in chat or
version control. For this workspace, the concrete proposed command is:

```bash
CCR_READER_MODEL=claude-haiku-5-5 \
CCR_READER_ESCALATION_MODEL=claude-sonnet-5-5 \
npm run read:golden -- \
  --yes --max-cost-usd 3 --max-calls 94 \
  --out /workspace/scratch/6a9c24c5f104/pr6-private/golden-20261120-01.json
```

That destination has not been created by this patch. When running on the owner's computer, approve
its specific private absolute path first. The command rejects incomplete flags, dirty source,
unqualified prices, duplicate review keys, repository-contained paths and existing outputs before
generation. A complete recording can still fail quality thresholds; completion does not mean pass.

## Offline verification after that run

Keep credentials unavailable and network disabled while evaluating. This command reads the private
artifact without copying it into the repository and writes no new report:

```bash
npm run eval:gate -- --stdout-only \
  --readings /workspace/scratch/6a9c24c5f104/pr6-private/golden-20261120-01.json
```

The gate checks provenance, source commit, identity, coverage, all attempt failures, known token
usage, reservations, repeated replay and both unchanged threshold sets. Separately compare rules,
rules plus primary readings, and the full cascade using the already-recorded primary attempts; do not
call a model again for that comparison. The default gate remains qualified only for the full cascade.
A standalone Sonnet comparison would need its own approved paid run.

Fingerprinting proves internal consistency, not authenticity of a hand-edited recording. Preserve the
original private file, review provider usage/request IDs and record its checksum before promotion.
Do not commit a recording automatically. A source change, disputed usage, unexpected response format
or failed quality gate is a decision point, not permission to loosen thresholds or retry until green.

## Remaining limits and separate work

No live provider request has validated this protocol yet. The 49 cases are synthetic regression
examples, not independent production evidence; the monotonic-policy exact-match ceiling remains
45/49. One frozen recording proves replay, not live inference repeatability. PR #11's below-five-star
policy reconciliation, PR #9's byte validation and issue #10's injury/false-sensitivity work remain
separate. Fresh independent labels, owner workload and stability evidence are still needed before
claiming that the second model is worth its cost or that the product is ready for production.
