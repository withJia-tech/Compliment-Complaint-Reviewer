import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { readJson, writeJson, acquireStoreLock } from "@/lib/store/jsonStore";

// These are server enforcement checks; client controls are not a security boundary.
afterEach(() => vi.unstubAllEnvs());
it.each(['POST', 'PUT', 'DELETE'].flatMap(method => ['/queue', '/demo-behindthehood'].map(route => [method, route])))("rejects hosted %s requests to %s, including direct server-action submissions", (method, route) => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  const response = middleware(new NextRequest('https://demo.example'+route, { method }));
  expect(response.status).toBe(405);
});
it('redirects operational pages to the isolated browser demo', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  expect(middleware(new NextRequest('https://demo.example/review/rev_001')).headers.get('location'))
    .toBe('https://demo.example/hosted-demo');
});
it('allows the hosted demo and required assets', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  for (const route of ['/hosted-demo', '/demo-behindthehood', '/demo-behindthehood/', '/_next/static/app.js']) {
    expect(middleware(new NextRequest('https://demo.example'+route)).headers.get('x-middleware-next')).toBe('1');
  }
});
it('does not expose operational subroutes through the engineering page allowlist', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  expect(middleware(new NextRequest('https://demo.example/demo-behindthehood/audit')).headers.get('location'))
    .toBe('https://demo.example/hosted-demo');
});
it('blocks store access on Vercel even without the explicit demo flag', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '');
  vi.stubEnv('VERCEL', '1');
  expect(() => readJson('reviews.json', {})).toThrow('Server storage is disabled');
  expect(() => writeJson('reviews.json', {})).toThrow('Server storage is disabled');
  expect(() => acquireStoreLock()).toThrow('Server storage is disabled');
});
it('preserves local development routing', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '');
  vi.stubEnv('VERCEL', '');
  expect(middleware(new NextRequest('http://localhost/queue', { method: 'POST' })).headers.get('x-middleware-next')).toBe('1');
});
