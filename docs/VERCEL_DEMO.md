# Vercel demonstration deployment

This target is a synthetic browser sandbox, not the live one-business service.
It reuses the application's triage policy, template drafter and reply wording validator.
Approval/failure demonstrations run in React state; they do not exercise real server publication,
server concurrency or durable audit persistence. Reloading clears all edits and decisions.
Do not enter real customer/staff data. No review text is submitted by the sandbox.

## Current comparison deployment

The production alias now serves the static `comparison/dist` bundle. It has no
server endpoints; `/hosted-demo` redirects to `/`. The identical assets are used
for the Sites and Pages comparison. See [hosting comparison](HOSTING_COMPARISON.md).
The instructions below describe the alternate guarded Next.js deployment target.

## Alternate Next.js deployment

Import this repository into the authorised Vercel account, using the reviewed demo branch/commit.
The root directory is the repository root. `vercel.json` selects Next.js, `npm ci`, `npm run build`
and `CCR_HOSTED_DEMO=1`. No database, Google secret or model API key is required.
Do not merge a draft PR solely to trigger deployment; deploy the selected branch as a preview.
Record the deployed commit and the HTTPS URL. Check the Vercel access setting before sending
the URL to a client; a protected preview may require their account or an authorised access method.

All Vercel executions also detect `VERCEL=1` independently of the demo flag. Middleware redirects
operational routes to `/hosted-demo` and refuses non-GET/HEAD requests. The JSON store additionally
refuses access on Vercel, so bypassing the UI/middleware cannot enable its unauthenticated writes.
Do not change the store to `/tmp` to simulate durable production storage.

## Acceptance before sharing

- HTTPS loads without a certificate warning; root redirects to `/hosted-demo`.
- Phone layout works; sample queue and facts are visible.
- Positive sample requires confirmation; editing clears that confirmation.
- Refund promise is blocked; simulated source change invalidates approval.
- Simulated uncertain delivery blocks retry; resetting starts over.
- Two browser contexts have independent decisions; reload loses session state as disclosed.
- POST `/api/scan` and server-action submissions return 405 in hosted mode.
- Record actual browser results and deployment identity; local build success is not deployment proof.

## Live-service boundary

Authentication, durable authorised state, real provider integration, reconciliation, operational
support and approved retention still need implementation and acceptance. This hosted sandbox
makes the demonstration accessible; it does not close those production release gates.
