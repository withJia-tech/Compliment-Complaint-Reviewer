# Executable pilot-memory design model

Run `node --test design/pilot-memory/scenarios.mjs` from the repository root.
Only Node built-ins are needed. These files are not imported by the application and
do not add routes, database tables, authentication or publishing capability.

`model.mjs` expresses proposed save/load invariants using synthetic sessions and an
in-memory transaction. `scenarios.mjs` exercises independent device sessions, conflicts,
uncertain commits, idempotent retries, scope isolation, approval staleness, context
candidate separation and restore-epoch rejection. `seedHistoricalApproval` is a fixture
helper, not an approval endpoint or proof of semantic validation.

The model intentionally does not simulate a browser or claim PM-09. It does not verify
JWTs, send email, implement the full HTTP input schema, execute SQL/RLS, test true
concurrency, persist across processes or restore a real backup. It has no external
provider interface, so zero publishing events here is a design property; actual
adapter-level zero-call verification remains required.

See [the design](../../docs/PILOT_AUTH_STORAGE_RECOVERY_DESIGN.md),
[API contract](../../docs/PILOT_MEMORY_API_CONTRACT.md), and
[measured model evidence](../../docs/evidence/pilot-memory-design-20261119/).
