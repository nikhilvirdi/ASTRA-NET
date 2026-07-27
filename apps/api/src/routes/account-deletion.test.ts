/**
 * Proof that `DELETE /api/auth/account` really erases a user's data.
 *
 * WORKPLAN.md Phase 10 requires delete-my-data to "call the real Phase-6
 * deletion", and ARCHITECTURE.md §7 promises "real, complete removal of a
 * user's locations, sky log, and predictions — deletion means deletion,
 * not deactivation". That promise rests entirely on `onDelete: Cascade`
 * FKs in `prisma/schema.prisma`, which no test had ever actually
 * exercised: the route deletes only the `User` row.
 *
 * So this runs against the real docker-compose Postgres — a mocked Prisma
 * would prove nothing at all here, since the cascade is a database
 * behaviour, not application logic. Every child table is populated first
 * and counted afterwards.
 */

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { loadDatabaseUrl } from '../test-support/db.js';

const TEST_EMAIL_SUFFIX = '@account-deletion-test.invalid';
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

const prisma = createPrismaClient(loadDatabaseUrl());

function app() {
  return createApp({ n2yoApiKey: 'TEST_KEY', prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
}

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

/** Creates a user with one row in every table that hangs off them. */
async function createFullyPopulatedUser(prefix: string) {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}${TEST_EMAIL_SUFFIX}`,
      settings: { alerts: { aurora: true } },
    },
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      hashedRefreshToken: `hashed-${prefix}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  await prisma.location.create({
    data: { userId: user.id, label: 'Home', latitude: 32.73, longitude: 74.87, isDefault: true },
  });
  await prisma.skyLogEntry.create({
    data: {
      userId: user.id,
      eventType: 'aurora',
      timestamp: new Date('2026-07-20T21:00:00Z'),
      source: 'manual',
    },
  });
  await prisma.prediction.create({
    data: {
      userId: user.id,
      targetTime: new Date('2026-07-21T00:00:00Z'),
      predictedKp: 5,
      confidence: 0.4,
      context: { cmeActivityId: 'deletion-test-cme' },
    },
  });

  const accessToken = await signAccessToken(user.id, JWT_ACCESS_SECRET, new Date());
  return { userId: user.id, accessToken };
}

async function countChildRows(userId: string) {
  const [sessions, locations, skyLogEntries, predictions, users] = await Promise.all([
    prisma.session.count({ where: { userId } }),
    prisma.location.count({ where: { userId } }),
    prisma.skyLogEntry.count({ where: { userId } }),
    prisma.prediction.count({ where: { userId } }),
    prisma.user.count({ where: { id: userId } }),
  ]);
  return { sessions, locations, skyLogEntries, predictions, users };
}

describe('DELETE /api/auth/account — real deletion (real Postgres)', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('erases the user and every row that hangs off them', async () => {
    const { userId, accessToken } = await createFullyPopulatedUser('full');

    // Guard the guard: if the fixture didn't populate, the assertion after
    // deletion would pass vacuously and prove nothing.
    expect(await countChildRows(userId)).toEqual({
      sessions: 1,
      locations: 1,
      skyLogEntries: 1,
      predictions: 1,
      users: 1,
    });

    const res = await request(app())
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });

    expect(await countChildRows(userId)).toEqual({
      sessions: 0,
      locations: 0,
      skyLogEntries: 0,
      predictions: 0,
      users: 0,
    });
  });

  it('clears the refresh cookie, so the session cannot be resumed', async () => {
    const { accessToken } = await createFullyPopulatedUser('cookie');

    const res = await request(app())
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${accessToken}`);

    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie).toBeDefined();
    expect(setCookie!.join(';')).toContain('refreshToken=');
  });

  it('leaves other users completely untouched', async () => {
    const victim = await createFullyPopulatedUser('victim');
    const bystander = await createFullyPopulatedUser('bystander');

    await request(app())
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${victim.accessToken}`);

    expect(await countChildRows(bystander.userId)).toEqual({
      sessions: 1,
      locations: 1,
      skyLogEntries: 1,
      predictions: 1,
      users: 1,
    });
  });

  it('rejects an unauthenticated delete', async () => {
    const { userId } = await createFullyPopulatedUser('unauthed');

    const res = await request(app()).delete('/api/auth/account');

    expect(res.status).toBe(401);
    expect((await countChildRows(userId)).users).toBe(1);
  });

  it('is idempotent — a second call with a still-valid token is a clean no-op', async () => {
    const { accessToken } = await createFullyPopulatedUser('twice');

    const first = await request(app())
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${accessToken}`);
    const second = await request(app())
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('leaves the deleted user unable to read their own data back', async () => {
    const { accessToken } = await createFullyPopulatedUser('readback');

    await request(app()).delete('/api/auth/account').set('Authorization', `Bearer ${accessToken}`);

    // The access token is stateless and still cryptographically valid, so
    // this proves the *data* is gone rather than merely hidden.
    const log = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);
    expect(log.status).toBe(200);
    expect((log.body as { stats: { totalSightings: number } }).stats.totalSightings).toBe(0);

    const settings = await request(app())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(settings.status).toBe(404);
  });
});
