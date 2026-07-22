/**
 * Exercises the cookie helpers over a real (in-process) HTTP round trip
 * via supertest rather than hand-built mock req/res objects, so the
 * assertions cover Express's actual `Set-Cookie` serialization and
 * header parsing, not just this file's own logic.
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from './refresh-cookie.js';

function buildTestApp(): express.Express {
  const app = express();

  // Routed under /api/auth/* — the cookie's own Path scope — so a
  // supertest agent (which respects Path like a real browser) actually
  // sends it back on the /read request below.
  app.get('/api/auth/set', (_req, res) => {
    setRefreshTokenCookie(res, 'a-fake-refresh-token', new Date('2026-08-16T12:00:00.000Z'));
    res.status(200).end();
  });

  app.get('/api/auth/read', (req, res) => {
    res.status(200).json({ token: readRefreshTokenCookie(req) });
  });

  app.get('/api/auth/clear', (_req, res) => {
    clearRefreshTokenCookie(res);
    res.status(200).end();
  });

  return app;
}

describe('setRefreshTokenCookie', () => {
  it('sets an HttpOnly cookie scoped to /api/auth with the given expiry', async () => {
    const res = await request(buildTestApp()).get('/api/auth/set');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    const cookieHeader = setCookie[0] ?? '';
    expect(cookieHeader).toContain('refreshToken=a-fake-refresh-token');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Path=/api/auth');
    expect(cookieHeader).toContain('Expires=');
    // Not marked Secure in test (NODE_ENV isn't 'production').
    expect(cookieHeader).not.toContain('Secure');
  });
});

describe('readRefreshTokenCookie', () => {
  it('reads back a cookie set on a prior response', async () => {
    const agent = request.agent(buildTestApp());
    await agent.get('/api/auth/set');

    const res = await agent.get('/api/auth/read');
    expect((res.body as { token: string | null }).token).toBe('a-fake-refresh-token');
  });

  it('returns null when no Cookie header is present at all', async () => {
    const res = await request(buildTestApp()).get('/api/auth/read');
    expect((res.body as { token: string | null }).token).toBeNull();
  });

  it('returns null when a Cookie header is present but lacks this cookie', async () => {
    const res = await request(buildTestApp()).get('/api/auth/read').set('Cookie', 'other=value');
    expect((res.body as { token: string | null }).token).toBeNull();
  });
});

describe('clearRefreshTokenCookie', () => {
  it('sets an expired cookie for the same name and path so the browser drops it', async () => {
    const res = await request(buildTestApp()).get('/api/auth/clear');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    const cookieHeader = setCookie[0] ?? '';
    expect(cookieHeader).toContain('refreshToken=;');
    expect(cookieHeader).toContain('Path=/api/auth');
    expect(cookieHeader).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
