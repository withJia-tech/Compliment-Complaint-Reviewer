# Mobile verification for the PR #7 / #11 compatibility candidate

The executable runner and optional fresh-session wording originate from verification
branch `01956e2a5edfb62e65e347c9f82df88f5302a791`. The candidate retains the runner's
strict assertions. [Historical verification evidence](https://github.com/withJia-tech/Compliment-Complaint-Reviewer/blob/01956e2a5edfb62e65e347c9f82df88f5302a791/docs/PR7_MOBILE_VERIFICATION.md)
is separate from [this compatibility run](PR7_PR11_COMPATIBILITY.md).

## What has and has not run

The current unit suite checks relative links, read-only markup, wording, generated
bundle integrity, hosted middleware restrictions and disabled server storage.
These checks passed. Browser runner syntax also passed. **All seven browser
scenarios below are NOT_RUN on this candidate.**

| Scenario | Required observable result | Current limitation |
|---|---|---|
| Direct companion navigation | Styled content and relative assets resolve under root and repository prefixes | HTTP/static structure is not browser execution |
| New tab and close | Original draft, selection and confirmation remain; editing invalidates confirmation | Mobile tab lifecycle unverified |
| Companion return link | Exact unsent draft is available after following the return link | Expected red: current link starts a fresh session; do not weaken assertion |
| Same-tab Back | Exact draft survives back navigation | Browser cache/lifecycle dependent; unverified |
| Narrow layouts | 320/390/412 portrait and 844 landscape, anchors and disclosures usable | No emulated or physical-device result |
| Reload | Draft and simulated decision clear | No durable recovery or cross-device state |
| Operational routes | GET/HEAD cannot expose queue, reviews, settings, insights or scan APIs | Middleware tests pass; browser/host path must still be exercised |

## Prerequisites and command

Use Node >=22.13 and a separately installed Playwright module plus browser binaries.
No Playwright dependency or lockfile change was added. Chromium previously failed to
launch because the environment denied its local socket; WebKit was absent. Use an
environment that permits the normal browser launch, without security workarounds.
Serve the already built `comparison/dist` with a static server, preserving the
mount prefix if testing GitHub Pages paths. Then run, substituting the real address:

```bash
DEMO_BASE_URL=http://127.0.0.1:8000/ DEMO_KIND=static MOBILE_ENGINE=chromium \
  PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node --test scripts/verifyCompanionMobile.mjs
```

For the hosted Next.js route use `DEMO_KIND=next` with hosted-demo restrictions enabled.
`DEMO_BASE_URL` must end in `/`. Run again with `MOBILE_ENGINE=webkit` when available.
The runner never rebuilds the application and blocks browser requests other than
GET/HEAD; it does not send or approve a public reply. Keep its reports separate from
Vitest results. Emulation still does not certify Safari on a real iPhone or Android
Chrome under tab eviction, suspension, backgrounding and memory pressure.

The fresh-demo wording is honest navigation guidance, not a functional return-to-draft
fix. The accepted [pilot memory requirements](PILOT_MEMORY_POLICY.md), including one
owner across phone and desktop, remain unimplemented and unverified.
