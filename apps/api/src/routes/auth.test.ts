/**
 * `/api/auth/*` route integration tests against the real docker-compose
 * Postgres — no mocked Prisma Client, per WORKPLAN.md Phase 5's agent
 * expectations. Every credential below is obviously fake (reserved
 * `.invalid` TLD, placeholder passphrases); rows this file creates are
 * scoped to the `@signup-test.invalid` / `@login-test.invalid` suffixes
 * and deleted before and after the run (Session rows cascade-delete with
 * their User, so cleaning up Users is enough).
 */

import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { verifyPassword } from '../auth/password.js';
import { verifyAccessToken } from '../auth/jwt.js';
import { hashRefreshToken } from '../auth/refresh-token.js';
import type { GoogleIdentity } from '../clients/google/index.js';
import { registerAuthRoutes, type GoogleOAuthConfig } from './auth.js';

const TEST_EMAIL_SUFFIX = '@signup-test.invalid';
const LOGIN_TEST_EMAIL_SUFFIX = '@login-test.invalid';
const GOOGLE_TEST_EMAIL_SUFFIX = '@google-test.invalid';
const FAKE_PASSWORD = 'correct-horse-battery-staple';
// Obviously-fake placeholder secret — never a real credential, matches jwt.test.ts's convention.
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

const FAKE_GOOGLE_OAUTH: GoogleOAuthConfig = {
  clientId: 'test-client-id.apps.googleusercontent.com',
  clientSecret: 'test-only-fake-google-client-secret',
  redirectUri: 'http://localhost:3000/api/auth/google/callback',
  webOrigin: 'http://localhost:5173',
};

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    // Vitest doesn't load the repo-root .env on its own; resolve it
    // relative to this file so the test works regardless of cwd.
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
    } catch {
      // No .env — the explicit check below produces the real error.
    }
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set and no repo-root .env was found — start the docker compose Postgres and set it before running Phase 5+ tests.',
    );
  }
  return url;
}

const prisma = createPrismaClient(loadDatabaseUrl());

function createTestApp(): express.Express {
  const app = express();
  registerAuthRoutes(app, { prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
  return app;
}

/**
 * Google's real token-exchange/JWKS-verification network calls are
 * injected as fakes here — the same "mock only the external network
 * boundary, keep the DB real" approach `brief.test.ts` already uses for
 * `fetchN2yoVisualPasses`. `google-oauth.client.test.ts` already covers
 * the real exchange/verification logic in isolation.
 */
function createTestAppWithGoogleOAuth(
  identity: GoogleIdentity | null,
  options: { exchangeFails?: boolean; googleOAuth?: GoogleOAuthConfig } = {},
): express.Express {
  const app = express();
  registerAuthRoutes(app, {
    prisma,
    jwtAccessSecret: JWT_ACCESS_SECRET,
    googleOAuth: options.googleOAuth ?? FAKE_GOOGLE_OAUTH,
    exchangeGoogleAuthCode: vi
      .fn()
      .mockResolvedValue(options.exchangeFails === true ? null : { idToken: 'fake-id-token' }),
    verifyGoogleIdToken: vi.fn().mockResolvedValue(identity),
  });
  return app;
}

async function deleteTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { endsWith: TEST_EMAIL_SUFFIX } },
        { email: { endsWith: LOGIN_TEST_EMAIL_SUFFIX } },
        { email: { endsWith: GOOGLE_TEST_EMAIL_SUFFIX } },
      ],
    },
  });
}

/** Extracts the `refreshToken` cookie's value from a response's `Set-Cookie` header(s). */
function extractRefreshToken(res: request.Response): string {
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  for (const cookieHeader of setCookie) {
    const match = /^refreshToken=([^;]*)/.exec(cookieHeader);
    if (match?.[1] !== undefined && match[1] !== '') return match[1];
  }
  throw new Error('no refreshToken cookie found in response');
}

/** Signs up a fresh user and logs in, returning the raw tokens for follow-up requests. */
async function signupAndLogin(
  app: express.Express,
  emailPrefix: string,
): Promise<{ email: string; accessToken: string; refreshToken: string }> {
  const email = `${emailPrefix}${LOGIN_TEST_EMAIL_SUFFIX}`;
  await request(app).post('/api/auth/signup').send({ email, password: FAKE_PASSWORD });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: FAKE_PASSWORD });
  return {
    email,
    accessToken: (loginRes.body as { accessToken: string }).accessToken,
    refreshToken: extractRefreshToken(loginRes),
  };
}

beforeAll(deleteTestUsers);
afterAll(async () => {
  await deleteTestUsers();
  await prisma.$disconnect();
});

describe('POST /api/auth/signup', () => {
  it('creates a user, returns 201 with id+email, and stores an Argon2 hash — never the password', async () => {
    const email = `basic${TEST_EMAIL_SUFFIX}`;
    const res = await request(createTestApp())
      .post('/api/auth/signup')
      .send({ email, password: FAKE_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body as Record<string, unknown>).toEqual({
      id: expect.any(String) as unknown,
      email,
    });
    // The raw password and the hash must appear nowhere in the response.
    expect(res.text).not.toContain(FAKE_PASSWORD);
    expect(res.text).not.toContain('argon2');

    const row = await prisma.user.findUnique({ where: { email } });
    expect(row).not.toBeNull();
    expect(row?.passwordHash).toMatch(/^\$argon2/);
    expect(row?.passwordHash).not.toContain(FAKE_PASSWORD);
    await expect(verifyPassword(row?.passwordHash ?? '', FAKE_PASSWORD)).resolves.toBe(true);
  });

  it('lowercases the email so uniqueness is case-insensitive', async () => {
    const res = await request(createTestApp())
      .post('/api/auth/signup')
      .send({ email: `Mixed.Case${TEST_EMAIL_SUFFIX.toUpperCase()}`, password: FAKE_PASSWORD });

    expect(res.status).toBe(201);
    expect((res.body as { email: string }).email).toBe(`mixed.case${TEST_EMAIL_SUFFIX}`);
    await expect(
      prisma.user.findUnique({ where: { email: `mixed.case${TEST_EMAIL_SUFFIX}` } }),
    ).resolves.not.toBeNull();
  });

  it('returns 409 for a duplicate email, including a differently-cased duplicate', async () => {
    const email = `duplicate${TEST_EMAIL_SUFFIX}`;
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send({ email, password: FAKE_PASSWORD });

    const exact = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'another-fake-passphrase' });
    expect(exact.status).toBe(409);

    const recased = await request(app)
      .post('/api/auth/signup')
      .send({ email: `DUPLICATE${TEST_EMAIL_SUFFIX}`, password: 'another-fake-passphrase' });
    expect(recased.status).toBe(409);

    await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it.each([
    ['malformed email', { email: 'not-an-email', password: FAKE_PASSWORD }],
    [
      'password below the 8-char floor',
      { email: `short${TEST_EMAIL_SUFFIX}`, password: 'seven77' },
    ],
    [
      'password above the 128-char ceiling',
      { email: `long${TEST_EMAIL_SUFFIX}`, password: 'x'.repeat(129) },
    ],
    ['missing password', { email: `nopass${TEST_EMAIL_SUFFIX}` }],
    ['missing email', { password: FAKE_PASSWORD }],
    ['non-object body', 'just-a-string'],
  ])('rejects %s with 400 and creates no row', async (_label, body) => {
    const res = await request(createTestApp()).post('/api/auth/signup').send(body);

    expect(res.status).toBe(400);
    expect((res.body as { error: unknown }).error).toBeTypeOf('string');
    // A rejected password must never be echoed back.
    expect(res.text).not.toContain(FAKE_PASSWORD);
    expect(res.text).not.toContain('seven77');
  });

  it('created no rows for any rejected body', async () => {
    for (const email of [
      `short${TEST_EMAIL_SUFFIX}`,
      `long${TEST_EMAIL_SUFFIX}`,
      `nopass${TEST_EMAIL_SUFFIX}`,
    ]) {
      await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
    }
  });
});

describe('POST /api/auth/login', () => {
  it('issues a valid access token + refresh-token cookie and stores a hashed Session row', async () => {
    const app = createTestApp();
    const email = `basic${LOGIN_TEST_EMAIL_SUFFIX}`;
    await request(app).post('/api/auth/signup').send({ email, password: FAKE_PASSWORD });

    const res = await request(app).post('/api/auth/login').send({ email, password: FAKE_PASSWORD });

    expect(res.status).toBe(200);
    const { accessToken, user } = res.body as {
      accessToken: string;
      user: { id: string; email: string };
    };
    expect(user.email).toBe(email);
    await expect(verifyAccessToken(accessToken, JWT_ACCESS_SECRET, new Date())).resolves.toEqual({
      userId: user.id,
    });
    // Neither the password nor any password hash ever appears in the response.
    expect(res.text).not.toContain(FAKE_PASSWORD);
    expect(res.text).not.toContain('argon2');

    const refreshToken = extractRefreshToken(res);
    const session = await prisma.session.findUnique({
      where: { hashedRefreshToken: hashRefreshToken(refreshToken) },
    });
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(user.id);
    // The raw refresh token itself must never appear anywhere but the cookie.
    expect(res.text).not.toContain(refreshToken);
  });

  it('returns a generic 401 for a wrong password, creating no Session row', async () => {
    const app = createTestApp();
    const email = `wrongpass${LOGIN_TEST_EMAIL_SUFFIX}`;
    await request(app).post('/api/auth/signup').send({ email, password: FAKE_PASSWORD });
    const sessionCountBefore = await prisma.session.count();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'definitely-the-wrong-passphrase' });

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid email or password');
    expect(res.headers['set-cookie']).toBeUndefined();
    await expect(prisma.session.count()).resolves.toBe(sessionCountBefore);
  });

  it('returns the same generic 401 for a nonexistent email', async () => {
    const res = await request(createTestApp())
      .post('/api/auth/login')
      .send({ email: `nobody${LOGIN_TEST_EMAIL_SUFFIX}`, password: FAKE_PASSWORD });

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid email or password');
  });

  it('rejects a malformed body with 400 and creates no Session row', async () => {
    const sessionCountBefore = await prisma.session.count();

    const res = await request(createTestApp())
      .post('/api/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    await expect(prisma.session.count()).resolves.toBe(sessionCountBefore);
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the Session row and clears the refresh-token cookie', async () => {
    const app = createTestApp();
    const { refreshToken } = await signupAndLogin(app, 'logout-basic');
    await expect(
      prisma.session.findUnique({ where: { hashedRefreshToken: hashRefreshToken(refreshToken) } }),
    ).resolves.not.toBeNull();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(setCookie).toContain('refreshToken=;');
    await expect(
      prisma.session.findUnique({ where: { hashedRefreshToken: hashRefreshToken(refreshToken) } }),
    ).resolves.toBeNull();
  });

  it('is idempotent: logging out twice, or with no cookie at all, still succeeds', async () => {
    const app = createTestApp();
    const { refreshToken } = await signupAndLogin(app, 'logout-twice');

    const first = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(second.status).toBe(200);

    const noCookie = await request(app).post('/api/auth/logout');
    expect(noCookie.status).toBe(200);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the session: new access token + new refresh cookie, old Session row replaced', async () => {
    const app = createTestApp();
    const { refreshToken: oldRefreshToken, email } = await signupAndLogin(app, 'refresh-basic');
    const oldHash = hashRefreshToken(oldRefreshToken);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefreshToken}`);

    expect(res.status).toBe(200);
    const { accessToken } = res.body as { accessToken: string };
    const payload = await verifyAccessToken(accessToken, JWT_ACCESS_SECRET, new Date());
    expect(payload).not.toBeNull();

    const newRefreshToken = extractRefreshToken(res);
    expect(newRefreshToken).not.toBe(oldRefreshToken);

    // Old row gone, new row present for the same user.
    await expect(
      prisma.session.findUnique({ where: { hashedRefreshToken: oldHash } }),
    ).resolves.toBeNull();
    const newSession = await prisma.session.findUnique({
      where: { hashedRefreshToken: hashRefreshToken(newRefreshToken) },
    });
    expect(newSession).not.toBeNull();
    expect(newSession?.userId).not.toBeUndefined();

    const user = await prisma.user.findUnique({ where: { email } });
    expect(newSession?.userId).toBe(user?.id);
  });

  it('rejects a replayed (already-rotated) refresh token — the old token must not work twice', async () => {
    const app = createTestApp();
    const { refreshToken: firstToken } = await signupAndLogin(app, 'refresh-replay');

    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${firstToken}`);
    expect(firstRefresh.status).toBe(200);
    const secondToken = extractRefreshToken(firstRefresh);

    // Replaying the original (now-rotated-away) token must fail, not silently succeed.
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${firstToken}`);
    expect(replay.status).toBe(401);
    expect((replay.body as { error: string }).error).toBe('invalid or expired refresh token');

    // The legitimately-rotated second token still works — proves the failure
    // above is specific to the replayed token, not a broken refresh route.
    const secondRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${secondToken}`);
    expect(secondRefresh.status).toBe(200);
  });

  it('rejects an expired session, clearing the cookie', async () => {
    const app = createTestApp();
    const { refreshToken, email } = await signupAndLogin(app, 'refresh-expired');
    const user = await prisma.user.findUnique({ where: { email } });
    // Back-date the real Session row's expiry rather than inventing a
    // second code path — proves the route's own `expiresAt <= now` check,
    // not just "row doesn't exist."
    await prisma.session.update({
      where: { hashedRefreshToken: hashRefreshToken(refreshToken) },
      data: { expiresAt: new Date('2020-01-01T00:00:00Z') },
    });
    expect(user).not.toBeNull();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid or expired refresh token');
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(setCookie).toContain('refreshToken=;');
  });

  it('rejects a request with no refresh-token cookie at all', async () => {
    const res = await request(createTestApp()).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('no refresh token presented');
  });

  it('rejects a well-formed but bogus refresh token', async () => {
    const res = await request(createTestApp())
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=not-a-real-token-that-matches-anything');

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('invalid or expired refresh token');
  });
});

describe('GET /api/auth/google', () => {
  it('redirects to Google with the configured client id/redirect uri and sets a state cookie', async () => {
    const res = await request(createTestAppWithGoogleOAuth(null)).get('/api/auth/google');

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location as string);
    expect(location.origin + location.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(location.searchParams.get('client_id')).toBe(FAKE_GOOGLE_OAUTH.clientId);
    expect(location.searchParams.get('redirect_uri')).toBe(FAKE_GOOGLE_OAUTH.redirectUri);
    expect(location.searchParams.get('state')).not.toBe('');

    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(setCookie).toContain('googleOauthState=');
  });

  it('returns 404 when Google OAuth is not configured', async () => {
    const res = await request(createTestApp()).get('/api/auth/google');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/auth/google/callback', () => {
  /** Drives the real /api/auth/google redirect first so the agent holds a genuine state cookie. */
  async function startFlow(agent: ReturnType<typeof request.agent>): Promise<{ state: string }> {
    const startRes = await agent.get('/api/auth/google');
    const location = new URL(startRes.headers.location as string);
    return { state: location.searchParams.get('state') ?? '' };
  }

  it('creates a brand-new User (googleId set, no password) and issues the same JWT pair as login', async () => {
    const email = `newuser${GOOGLE_TEST_EMAIL_SUFFIX}`;
    const identity: GoogleIdentity = { googleId: 'google-id-newuser', email };
    const app = createTestAppWithGoogleOAuth(identity);
    const agent = request.agent(app);
    const { state } = await startFlow(agent);

    const res = await agent.get(`/api/auth/google/callback?code=fake-code&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(
      new RegExp(`^${FAKE_GOOGLE_OAUTH.webOrigin}/auth/callback#accessToken=`),
    );
    const accessToken = decodeURIComponent(
      (res.headers.location as string).split('#accessToken=')[1] ?? '',
    );
    const payload = await verifyAccessToken(accessToken, JWT_ACCESS_SECRET, new Date());
    expect(payload).not.toBeNull();

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.googleId).toBe('google-id-newuser');
    expect(user?.passwordHash).toBeNull();

    const refreshToken = extractRefreshToken(res);
    await expect(
      prisma.session.findUnique({ where: { hashedRefreshToken: hashRefreshToken(refreshToken) } }),
    ).resolves.not.toBeNull();
  });

  it('links Google to an existing password-based account sharing the same email', async () => {
    const email = `linked${GOOGLE_TEST_EMAIL_SUFFIX}`;
    await request(createTestApp())
      .post('/api/auth/signup')
      .send({ email, password: FAKE_PASSWORD });

    const identity: GoogleIdentity = { googleId: 'google-id-linked', email };
    const app = createTestAppWithGoogleOAuth(identity);
    const agent = request.agent(app);
    const { state } = await startFlow(agent);

    const res = await agent.get(`/api/auth/google/callback?code=fake-code&state=${state}`);
    expect(res.status).toBe(302);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.googleId).toBe('google-id-linked');
    // The original password still exists — linking Google didn't clobber it.
    expect(user?.passwordHash).not.toBeNull();
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it('reuses the same User on a second login with the same Google identity — no duplicate row', async () => {
    const email = `repeat${GOOGLE_TEST_EMAIL_SUFFIX}`;
    const identity: GoogleIdentity = { googleId: 'google-id-repeat', email };

    const firstApp = createTestAppWithGoogleOAuth(identity);
    const firstAgent = request.agent(firstApp);
    const first = await startFlow(firstAgent);
    await firstAgent.get(`/api/auth/google/callback?code=fake-code&state=${first.state}`);

    const secondApp = createTestAppWithGoogleOAuth(identity);
    const secondAgent = request.agent(secondApp);
    const second = await startFlow(secondAgent);
    await secondAgent.get(`/api/auth/google/callback?code=fake-code&state=${second.state}`);

    await expect(prisma.user.count({ where: { googleId: 'google-id-repeat' } })).resolves.toBe(1);
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it('redirects to a login error page on a state mismatch (CSRF check failed)', async () => {
    const app = createTestAppWithGoogleOAuth({
      googleId: 'x',
      email: `x${GOOGLE_TEST_EMAIL_SUFFIX}`,
    });
    const agent = request.agent(app);
    await startFlow(agent);

    const res = await agent.get('/api/auth/google/callback?code=fake-code&state=wrong-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FAKE_GOOGLE_OAUTH.webOrigin}/login?error=oauth_failed`);
  });

  it('redirects to a login error page when no state cookie was ever set', async () => {
    const app = createTestAppWithGoogleOAuth({
      googleId: 'x',
      email: `x2${GOOGLE_TEST_EMAIL_SUFFIX}`,
    });

    const res = await request(app).get('/api/auth/google/callback?code=fake-code&state=anything');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FAKE_GOOGLE_OAUTH.webOrigin}/login?error=oauth_failed`);
  });

  it('redirects to a login error page when the code exchange fails', async () => {
    const app = createTestAppWithGoogleOAuth(null, { exchangeFails: true });
    const agent = request.agent(app);
    const { state } = await startFlow(agent);

    const res = await agent.get(`/api/auth/google/callback?code=fake-code&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FAKE_GOOGLE_OAUTH.webOrigin}/login?error=oauth_failed`);
  });

  it('redirects to a login error page when Google ID-token verification fails', async () => {
    // Exchange succeeds, but the identity comes back null (e.g. bad signature, unverified email).
    const app = createTestAppWithGoogleOAuth(null);
    const agent = request.agent(app);
    const { state } = await startFlow(agent);

    const res = await agent.get(`/api/auth/google/callback?code=fake-code&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FAKE_GOOGLE_OAUTH.webOrigin}/login?error=oauth_failed`);
  });

  it('returns 404 when Google OAuth is not configured', async () => {
    const res = await request(createTestApp()).get('/api/auth/google/callback?code=x&state=y');
    expect(res.status).toBe(404);
  });
});
