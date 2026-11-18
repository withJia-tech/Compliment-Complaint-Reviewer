import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { BehindTheHood } from '@/app/components/BehindTheHood';

it('distinguishes the original live draft from a fresh companion return session', () => {
  const html = renderToStaticMarkup(createElement(BehindTheHood));
  expect(html).toContain('return to your original Review Desk tab');
  expect(html).toContain('Opening a fresh demo here starts a separate session');
  expect(html).toContain('does not save drafts or decisions for recovery');
  expect(html.match(/Open a fresh demo/g)).toHaveLength(2);
  expect(html).not.toContain('Open client demo');
});
it('keeps relative return and manifest links inside a static deployment prefix', () => {
  const html = renderToStaticMarkup(createElement(BehindTheHood, { demoHref: '../', buildManifestHref: '../build.json' }));
  expect(html.match(/href="\.\.\/"/g)).toHaveLength(3);
  expect(html).toContain('href="../build.json"');
  const base = new URL('https://example.test/project/demo-behindthehood/');
  expect(new URL('../', base).href).toBe('https://example.test/project/');
  expect(new URL('../build.json', base).pathname).toBe('/project/build.json');
});
it('keeps the companion read-only and defaults to the isolated hosted entry', () => {
  const html = renderToStaticMarkup(createElement(BehindTheHood));
  expect(html.match(/href="\/hosted-demo"/g)).toHaveLength(3);
  expect(html).not.toMatch(/<(?:form|button|input|textarea|script)\b/i);
});
it('checks that generated navigation guidance and digest match the reviewed bundle', () => {
  const dir = 'comparison/dist/';
  const hood = readFileSync(dir + 'demo-behindthehood/index.html', 'utf8');
  expect(hood).toContain('return to your original Review Desk tab');
  expect(hood).toContain('href="../app.css"');
  expect(hood).toContain('href="../build.json"');
  expect(hood).not.toMatch(/<(?:form|button|input|textarea|script)\b/i);
  const digest = createHash('sha256').update(readFileSync(dir+'app.js')).update(readFileSync(dir+'app.css')).update(hood).digest('hex');
  expect(JSON.parse(readFileSync(dir+'build.json','utf8')).sha256).toBe(digest);
});
