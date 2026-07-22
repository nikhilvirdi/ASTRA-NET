/**
 * `requireAuth` has no DB dependency (verifyAccessToken is pure), so
 * this is tested standalone via a tiny Express app + supertest — no
 * real Postgres needed here, unlike the DB-backed auth routes.
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signAccessToken } from './jwt.js';
import { requireAuth } from './require-auth.js';

const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';
const USER_ID = 'user_fakeid123';

function buildTestApp(): express.Express {
  const app = express();
  app.get('/protected', requireAuth({ jwtAccessSecret: JWT_ACCESS_SECRET }), (req, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return app;
}

describe('requireAuth', () => {
  it('attaches req.userId and calls next() for a valid access token', async () => {
    const token = await signAccessToken(USER_ID, JWT_ACCESS_SECRET, new Date());

    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect((res.body as { userId: string }).userId).toBe(USER_ID);
  });

  it('returns 401 when the Authorization header is missing entirely', async () => {
    const res = await request(buildTestApp()).get('/protected');

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('missing or malformed Authorization header');
  });

  it('returns 401 when the Authorization header has no Bearer prefix', async () => {
    const token = await signAccessToken(USER_ID, JWT_ACCESS_SECRET, new Date());

    const res = await request(buildTestApp()).get('/protected').set('Authorization', token);

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('missing or malformed Authorization header');
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-jwt');

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid or expired access token');
  });

  it('returns 401 for an expired token', async () => {
    const issuedAt = new Date('2026-07-17T12:00:00Z');
    const token = await signAccessToken(USER_ID, JWT_ACCESS_SECRET, issuedAt);
    // Sign at a real instant, but the token's own 15-min expiry has
    // necessarily already passed relative to the real clock `requireAuth`
    // checks against (it always verifies with `new Date()`, not an
    // injected `now` — there's no route-layer clock to inject here).
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid or expired access token');
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const token = await signAccessToken(USER_ID, 'a-different-fake-secret', new Date());

    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid or expired access token');
  });
});
