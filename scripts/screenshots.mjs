/**
 * Regenerates the README screenshots in docs/screenshots/.
 *
 * These are committed to the repo and referenced by relative path, so they
 * are versioned with the code they depict and can be regenerated whenever
 * the UI changes — rather than being opaque upload URLs that drift silently
 * out of date.
 *
 * Playwright is not a project dependency (it would slow CI for something
 * only run by hand). Install it ad hoc before running:
 *
 *   npm run scan                  # seed data/store from the fixtures
 *   npm run build && npm start    # in another shell — NOT `npm run dev`
 *   npx -y playwright@1 node scripts/screenshots.mjs
 *
 * Capture from a production build: the dev server draws a Next.js indicator
 * in the corner of every page, which ends up in the README images.
 *
 * Options via env:
 *   BASE_URL   default http://localhost:3000
 *   OUT_DIR    default docs/screenshots
 *   CHROME     explicit path to a Chromium binary, if autodetection fails
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = process.env.OUT_DIR ?? path.join("docs", "screenshots");

fs.mkdirSync(OUT_DIR, { recursive: true });

const launchOptions = process.env.CHROME ? { executablePath: process.env.CHROME } : {};
const browser = await chromium.launch(launchOptions);
// 1x, not 2x: these are committed and regenerated on every UI change, so each
// pass adds its bytes to history permanently. GitHub renders README images at
// roughly 870px wide, so a 1280px capture is already sharper than it displays.
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});

async function shot(name, url, prepare) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle" });
  if (prepare) await prepare();
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
  console.log(`captured ${name}`);
}

await shot("queue.png", "/queue");

await shot("queue-inline-reply.png", "/queue", async () => {
  // Expand the top row so the editable draft and send controls are visible.
  await page.locator("tr:not(.row-expanded) .btn-link").first().click();
  await page.waitForSelector("textarea");
});

await shot("insights.png", "/insights");
await shot("review-detail.png", "/review/rev_007");
await shot("settings.png", "/settings");

await browser.close();
console.log(`\nWrote screenshots to ${OUT_DIR}`);
