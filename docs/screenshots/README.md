# Screenshots

Committed deliberately, and referenced from the root README by relative path rather than by
upload URL, so they are versioned alongside the code they depict. An upload URL cannot be
regenerated from the repo, which is how the previous set drifted two revisions out of date —
still advertising an "Escalated" risk level that no longer exists.

Regenerate after any UI change:

```bash
npm run scan                  # seed data/store from the fixtures
npm run build && npm start    # in another shell

npx -y playwright@1 node scripts/screenshots.mjs
```

Use a production build, not `npm run dev`: the dev server draws a Next.js indicator in the
corner of every page, and it ends up in the images.

Playwright is intentionally not a project dependency — it would slow CI for something only run
by hand. If Chromium autodetection fails, point at a binary explicitly:

```bash
CHROME=/path/to/chrome node scripts/screenshots.mjs
```

| File | Page |
| --- | --- |
| `queue.png` | `/queue` — the daily queue |
| `queue-inline-reply.png` | `/queue` with the top row expanded for an inline reply |
| `insights.png` | `/insights` — weekly rollup by theme |
| `review-detail.png` | `/review/rev_007` — a sensitive claim, with audit trail |
| `settings.png` | `/settings` — connected location and how sending works |

Captured at 1280px wide, `deviceScaleFactor: 1`. These are regenerated repeatedly and every
pass adds its bytes to git history permanently, so they are kept at display resolution rather
than retina — GitHub renders README images at roughly 870px wide regardless.
