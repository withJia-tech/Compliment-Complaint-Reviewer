# Compliment-Complaint-Reviewer

A fixture-backed prototype for a governed daily review desk for Google Business Profile teams. It
demonstrates the narrow first workflow: scan new or updated reviews, classify risk, draft a
grounded response, auto-publish only low-risk replies, and route sensitive cases for approval.

## Current boundary

This prototype intentionally uses demo data. Google OAuth, the Business Profile API, email
approval, and MCP tools are the next integration layer. The backend worker — not MCP — will own
scheduling, idempotency, policy enforcement, and audit records.

See [SPEC.md](./SPEC.md) for the product boundary, non-goals, and production-shaped interfaces.

## Attribution

This is a fresh implementation inspired by the product scope and architecture of OpenReply. It
does not copy OpenReply source code and is not presented as a fork. If source code is reused in a
future version, retain OpenReply's MIT license and attribution.

## Getting started

Requires Node.js >= 22.13.0.

```bash
npm install
npm run scan     # runs the daily worker over fixture data, populating data/store/*.json
npm run dev      # starts the Next.js dev server at http://localhost:3000
```

Open `/queue` to see the daily review queue, click into a review for the evidence/draft/decision
view, and visit `/settings` to toggle auto-publish consent for the single connected location.
<img width="1280" height="1144" alt="image" src="https://github.com/user-attachments/assets/fd146c30-e2c3-4bb4-b9eb-c65647fa248d" />
<img width="1280" height="900" alt="image" src="https://github.com/user-attachments/assets/fce52202-bc40-40e4-86c1-82e28357932d" />
<img width="1280" height="1222" alt="image" src="https://github.com/user-attachments/assets/a58587f1-924d-46f8-8914-09b81ee21ba0" />

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run scan` | Run the daily scan CLI over fixture reviews (re-runnable/idempotent) |
| `npm test` | Run the Vitest suite (triage policy, drafter fact-safety, store round-trip) |
| `npm run typecheck` | Type-check the project with `tsc --noEmit` |

## Architecture

- `lib/interfaces/` — production-shaped contracts (`ReviewProvider`, `TriagePolicy`,
  `ReplyDrafter`, `ApprovalChannel`) with no implementation, so a real Google/email/MCP
  integration can be swapped in later without touching callers.
- `lib/providers/`, `lib/drafter/`, `lib/approval/` — the one fixture/stub implementation of each
  interface used by this prototype.
- `lib/triage/` — the deterministic `DefaultTriagePolicy` implementing the default policy (star
  bands, complaint-keyword downgrades, and escalation categories that always route to human
  review and never auto-publish).
- `lib/store/` — a JSON-file-backed repository layer (`data/store/*.json`) with atomic writes;
  swapping to a real database later means reimplementing the repos only.
- `lib/scan/runDailyScan.ts` — the single orchestration function shared by the CLI script
  (`scripts/dailyScan.ts`) and the optional `POST /api/scan` route.
- `app/queue`, `app/review/[id]`, `app/settings` — the reviewer-facing UI.
- `data/fixtures/` — seed reviews (spanning every risk band and escalation category) and the
  approved business facts the drafter is allowed to cite.
