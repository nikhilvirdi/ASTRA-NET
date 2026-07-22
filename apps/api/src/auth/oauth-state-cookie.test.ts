import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  clearOAuthStateCookie,
  readOAuthStateCookie,
  setOAuthStateCookie,
} from './oauth-state-cookie.js';

function buildTestApp(): express.Express {
  const app = express();

  // Routed under /api/auth/google/* — the cookie's own Path scope — so
  // a supertest agent (which respects Path like a real browser) sends
  // it back on the /read request below.
  app.get('/api/auth/google/set', (_req, res) => {
    setOAuthStateCookie(res, 'a-fake-csrf-state-value');
    res.status(200).end();
  });

  app.get('/api/auth/google/read', (req, res) => {
    res.status(200).json({ state: readOAuthStateCookie(req) });
  });

  app.get('/api/auth/google/clear', (_req, res) => {
    clearOAuthStateCookie(res);
    res.status(200).end();
  });

  return app;
}

describe('setOAuthStateCookie', () => {
  it('sets an HttpOnly cookie scoped to /api/auth/google', async () => {
    const res = await request(buildTestApp()).get('/api/auth/google/set');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    const cookieHeader = setCookie[0] ?? '';
    expect(cookieHeader).toContain('googleOauthState=a-fake-csrf-state-value');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Path=/api/auth/google');
  });
});

describe('readOAuthStateCookie', () => {
  it('reads back a cookie set on a prior response', async () => {
    const agent = request.agent(buildTestApp());
    await agent.get('/api/auth/google/set');

    const res = await agent.get('/api/auth/google/read');
    expect((res.body as { state: string | null }).state).toBe('a-fake-csrf-state-value');
  });

  it('returns null when no Cookie header is present', async () => {
    const res = await request(buildTestApp()).get('/api/auth/google/read');
    expect((res.body as { state: string | null }).state).toBeNull();
  });
});

describe('clearOAuthStateCookie', () => {
  it('sets an expired cookie for the same name and path', async () => {
    const res = await request(buildTestApp()).get('/api/auth/google/clear');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieHeader = setCookie[0] ?? '';
    expect(cookieHeader).toContain('googleOauthState=;');
    expect(cookieHeader).toContain('Path=/api/auth/google');
  });
});
