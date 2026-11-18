import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { readJson, writeJson, acquireStoreLock } from "@/lib/store/jsonStore";

// These are server enforcement checks; client controls are not a security boundary.
afterEach(() => vi.unstubAllEnvs());
it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].flatMap(method => ['/queue', '/demo-behindthehood', '/api/scan'].map(route => [method, route])))("rejects hosted %s requests to %s, including direct server-action submissions", (method, route) => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  const response = middleware(new NextRequest('https://demo.example'+route, { method }));
  expect(response.status).toBe(405);
});
it('redirects operational pages to the isolated browser demo', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  for (const method of ['GET', 'HEAD']) {
    for (const route of ['/queue', '/review/rev_001', '/settings', '/insights', '/api/scan', '/demo-behindthehood/audit']) {
      const response = middleware(new NextRequest('https://demo.example'+route, { method }));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://demo.example/hosted-demo');
    }
  }
});
it('allows the hosted demo and required assets', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  for (const method of ['GET', 'HEAD']) {
    for (const route of ['/hosted-demo', '/demo-behindthehood', '/demo-behindthehood/', '/_next/static/app.js']) {
      expect(middleware(new NextRequest('https://demo.example'+route, { method })).headers.get('x-middleware-next')).toBe('1');
    }
  }
});
it('does not expose operational subroutes through the engineering page allowlist', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '1');
  expect(middleware(new NextRequest('https://demo.example/demo-behindthehood/audit')).headers.get('location'))
    .toBe('https://demo.example/hosted-demo');
});
it.each(['VERCEL', 'CCR_HOSTED_DEMO'])('blocks store access with %s alone', flag => {
  vi.stubEnv('CCR_HOSTED_DEMO', '');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv(flag, '1');
  expect(() => readJson('reviews.json', {})).toThrow('Server storage is disabled');
  expect(() => writeJson('reviews.json', {})).toThrow('Server storage is disabled');
  expect(() => acquireStoreLock()).toThrow('Server storage is disabled');
});
it('preserves local development routing', () => {
  vi.stubEnv('CCR_HOSTED_DEMO', '');
  vi.stubEnv('VERCEL', '');
  expect(middleware(new NextRequest('http://localhost/queue', { method: 'POST' })).headers.get('x-middleware-next')).toBe('1');
});
