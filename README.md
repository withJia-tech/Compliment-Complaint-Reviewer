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

Open `/queue` to see the daily review queue — click **View** on any row to read the proposed
reply, edit it in place, and send it without leaving the page. `/insights` rolls the same
reviews up weekly or monthly by Food / Service / Atmosphere, and `/settings` toggles
auto-publish consent for the single connected location.

<img width="1280" height="1144" alt="Daily review queue" src="https://github.com/user-attachments/assets/fd146c30-e2c3-4bb4-b9eb-c65647fa248d" />
<img width="1280" height="900" alt="Settings and auto-publish consent" src="https://github.com/user-attachments/assets/fce52202-bc40-40e4-86c1-82e28357932d" />
<img width="1280" height="1222" alt="Review detail with evidence, draft and audit trail" src="https://github.com/user-attachments/assets/a58587f1-924d-46f8-8914-09b81ee21ba0" />

## How it routes

Three risk levels, no escalation tier — a one-person team or an agency has nobody to escalate
to. Sensitive claims (safety, legal, discrimination, medical, fraud, compensation) are high
risk flagged `sensitive`: they are never auto-published at any star rating and get their own
reply wording. Everything else follows the star bands, with complaint language pulling a
4-5 star review down to "needs approval".

Terms match on word boundaries, and sensitive terms are split into strong and weak tiers — an
unambiguous claim goes straight to high, while an ambiguous one is softened to medium but is
still never auto-published. [SPEC.md](./SPEC.md) carries the full routing, grounding and theme
rubrics; `data/fixtures/golden.json` holds the labelled cases that hold them to it.

Goodwill remedies — vouchers and the like — are settled outside this app over email or
WhatsApp. The detail page records that one was offered so the audit trail is complete, but
nothing is sent from here and no remedy is ever mentioned in the published reply.

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
- `lib/triage/` — the deterministic `DefaultTriagePolicy`: star bands, complaint-keyword
  downgrades, sensitive-claim detection that always routes to a human, and Food / Service /
  Atmosphere theme tagging.
- `lib/insights/aggregate.ts` — weekly and monthly rollups over reviews already in the store.
- `lib/decisions.ts` — send / skip / record-remedy, shared by the queue's inline actions and
  the detail page so both write identical approval and audit records.
- `lib/store/` — a JSON-file-backed repository layer (`data/store/*.json`) with atomic writes;
  swapping to a real database later means reimplementing the repos only.
- `lib/scan/runDailyScan.ts` — the single orchestration function shared by the CLI script
  (`scripts/dailyScan.ts`) and the optional `POST /api/scan` route.
- `app/queue`, `app/review/[id]`, `app/settings` — the reviewer-facing UI.
- `data/fixtures/` — seed reviews (spanning every risk band and escalation category) and the
  approved business facts the drafter is allowed to cite.
