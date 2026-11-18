// Proposed regression runner. Requires Playwright, but never rebuilds the app.
// Run separately from Vitest. Mobile emulation does not certify physical devices.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = new URL(process.env.DEMO_BASE_URL); // Required; include mount prefix.
assert.ok(base.pathname.endsWith('/'), 'DEMO_BASE_URL must end in /');
const kind = process.env.DEMO_KIND ?? 'static';
assert.ok(['static', 'next'].includes(kind));
const demo = new URL(kind === 'next' ? 'hosted-demo' : './', base).href;
const hood = new URL('demo-behindthehood/', base).href;
const engine = process.env.MOBILE_ENGINE ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const artifacts = path.resolve(process.env.MOBILE_ARTIFACTS ?? '/tmp/ccr-mobile-results');
const pw = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
let browser;
before(async () => {
  await mkdir(artifacts, { recursive: true });
  browser = await pw[engine].launch();
});
after(async () => { await browser?.close(); });

async function session(t) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block',
  });
  const mutations = [];
  await context.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) {
      mutations.push(`${request.method()} ${request.url()}`);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  t.after(async () => {
    await context.close();
    assert.deepEqual(mutations, [], 'Navigation must not attempt a server mutation');
  });
  return { context, page: await context.newPage() };
}
async function draft(page) {
  const field = page.locator('#hosted-reply');
  await field.waitFor({ state: 'visible' });
  return field;
}
async function openCompanion(page) {
  const link = page.locator('.desk-footer a');
  assert.equal(await link.getAttribute('target'), '_blank');
  const rel = (await link.getAttribute('rel')).split(/\s+/);
  assert.ok(rel.includes('noopener') && rel.includes('noreferrer'));
  await link.scrollIntoViewIfNeeded();
  const pending = page.waitForEvent('popup');
  await link.tap();
  const companion = await pending;
  await companion.locator('#hood-title').waitFor({ state: 'visible' });
  assert.equal(await companion.evaluate(() => window.opener === null), true);
  return companion;
}
async function noPageOverflow(page) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(size.content <= size.viewport + 1, JSON.stringify(size));
}

test('direct companion URLs load styled content and return within the deployment prefix', async t => {
  const { context, page } = await session(t);
  const entries = kind === 'static'
    ? ['demo-behindthehood/', 'demo-behindthehood', 'demo-behindthehood/index.html']
    : ['demo-behindthehood/', 'demo-behindthehood'];
  for (const entry of entries) {
    const response = await page.goto(new URL(entry, base).href);
    assert.equal(response.status(), 200);
    await page.locator('#hood-title').waitFor({ state: 'visible' });
    assert.equal(await page.locator('form,textarea,input,button').count(), 0);
    assert.equal(await page.locator('.hood-page').evaluate(el => getComputedStyle(el).maxWidth), '1080px');
    if (kind === 'static') {
      const css = await page.locator('link[rel="stylesheet"]').evaluate(el => el.href);
      assert.equal(css, new URL('app.css', base).href);
      const asset = await context.request.get(css);
      assert.equal(asset.status(), 200);
      assert.match(asset.headers()['content-type'], /text\/css/);
      assert.equal(await page.locator('script').count(), 0);
      assert.equal(await page.locator('a[href$="build.json"]').evaluate(el => el.href), new URL('build.json', base).href);
    }
    assert.equal(await page.locator('.hood-back').evaluate(el => el.href), demo);
    await page.locator('.hood-back').tap();
    assert.equal(page.url(), demo);
    await draft(page); // Hydrated draft also proves the client JS loaded.
  }
});

test('opening and closing the companion preserves the live original draft and confirmation', async t => {
  const { page } = await session(t);
  await page.goto(demo);
  await page.locator('.hosted-review').nth(1).tap(); // Non-default selection.
  const selected = await page.locator('.desk-workspace-head h2').innerText();
  const field = await draft(page);
  const marker = 'UNSENT mobile navigation regression — do not send.';
  await field.fill(marker);
  await page.locator('.hosted-check input').check();
  const companion = await openCompanion(page);
  assert.equal(page.url(), demo);
  assert.equal(await field.inputValue(), marker);
  await companion.close();
  await page.bringToFront();
  assert.equal(await field.inputValue(), marker);
  assert.equal(await page.locator('.desk-workspace-head h2').innerText(), selected);
  assert.equal(await page.locator('.hosted-check input').isChecked(), true);
  await field.fill(marker + ' edited');
  assert.equal(await page.locator('.hosted-check input').isChecked(), false);
});

test('return-link acceptance: resume the unsent draft instead of opening a fresh session', async t => {
  const { page } = await session(t);
  await page.goto(demo);
  const field = await draft(page);
  const marker = 'UNSENT original-tab marker.';
  await field.fill(marker);
  const companion = await openCompanion(page);
  await companion.locator('.hood-back').tap();
  const returnedDraft = await (await draft(companion)).inputValue();
  assert.equal(await field.inputValue(), marker);
  await companion.goBack();
  await companion.locator('#hood-title').waitFor({ state: 'visible' });
  assert.equal(await field.inputValue(), marker);
  // Intentionally red at the inspected head under the strict return-link requirement.
  // Do not change the expected value to the fixture merely to make this green.
  assert.equal(returnedDraft, marker, 'The return link opened a fresh session; the unsent draft remains only in the original tab');
});

test('same-tab Back retains the draft in this browser configuration', async t => {
  // This is a genuine assertion, not an expected-failure waiver. Browser cache
  // restoration can make it pass; passing does not promise recovery after unload.
  const { page } = await session(t);
  await page.goto(demo);
  const marker = 'UNSENT same-tab history regression.';
  await (await draft(page)).fill(marker);
  await page.goto(hood);
  await page.goBack();
  assert.equal(await (await draft(page)).inputValue(), marker,
    'Same-tab history lost the draft; record engine and lifecycle, do not add persistence silently');
});

test('narrow layouts, section anchors and disclosures remain usable', async t => {
  const { page } = await session(t);
  for (const [width, height] of [[320, 812], [390, 844], [412, 915], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto(demo);
    await draft(page);
    await noPageOverflow(page);
    await page.locator('.desk-footer a').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, `${engine}-desk-${width}x${height}.png`), fullPage: true });
    await page.goto(hood);
    await noPageOverflow(page);
    for (const id of ['workflow', 'rubrics', 'traceability', 'reliability', 'evidence']) {
      await page.locator(`.hood-nav a[href="#${id}"]`).tap();
      assert.equal(new URL(page.url()).hash, `#${id}`);
    }
    const detail = page.locator('.hood-detail').first();
    await detail.locator('summary').tap();
    assert.equal(await detail.evaluate(el => el.open), true);
    await noPageOverflow(page);
    for (const wrap of await page.locator('.hood-table-wrap').all()) {
      assert.equal(await wrap.evaluate(el => getComputedStyle(el).overflowX), 'auto');
      const box = await wrap.boundingBox();
      if (box) assert.ok(box.width <= width, 'Tables must scroll within their wrapper');
    }
    await page.screenshot({ path: path.join(artifacts, `${engine}-hood-${width}x${height}.png`), fullPage: true });
  }
});

test('reload clears draft and simulated decision; it is not durable production state', async t => {
  const { page } = await session(t);
  await page.goto(demo);
  const initial = await (await draft(page)).inputValue();
  await (await draft(page)).fill('UNSENT reload marker.');
  await page.reload();
  assert.equal(await (await draft(page)).inputValue(), initial);
  await page.locator('.hosted-check input').check();
  // Local browser simulation only. Never click Approve response in this suite.
  await page.getByRole('button', { name: 'No response required', exact: true }).tap();
  await page.getByRole('status').waitFor({ state: 'visible' });
  assert.match(await page.locator('.desk-tabs').innerText(), /Completed\s+1/);
  const companion = await openCompanion(page);
  await companion.close();
  assert.match(await page.locator('.desk-tabs').innerText(), /Completed\s+1/);
  await page.reload();
  await draft(page);
  assert.match(await page.locator('.desk-tabs').innerText(), /Completed\s+0/);
});

test('operational GET and HEAD routes stay inaccessible', async t => {
  const { context } = await session(t);
  for (const route of ['queue', 'review/rev_001', 'settings', 'insights', 'api/scan', 'demo-behindthehood/audit']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await context.request.fetch(new URL(route, base).href, { method, maxRedirects: 0 });
      if (kind === 'static') assert.equal(response.status(), 404, `${method} ${route}`);
      else {
        assert.equal(response.status(), 307, `${method} ${route}`);
        assert.equal(new URL(response.headers().location, base).href, demo);
      }
    }
  }
});
