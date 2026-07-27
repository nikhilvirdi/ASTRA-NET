/**
 * `/api/log` integration tests against the real docker-compose Postgres,
 * matching the Phase 5+ standard for DB-backed routes.
 */

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { LogPayloadSchema } from '../log/log.schemas.js';
import type { LogPayload } from '../log/build-log.js';
import { loadDatabaseUrl } from '../test-support/db.js';

const TEST_EMAIL_SUFFIX = '@log-route-test.invalid';
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

const prisma = createPrismaClient(loadDatabaseUrl());

function app() {
  return createApp({ n2yoApiKey: 'TEST_KEY', prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
}

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

async function createUser(prefix: string) {
  const user = await prisma.user.create({ data: { email: `${prefix}${TEST_EMAIL_SUFFIX}` } });
  const accessToken = await signAccessToken(user.id, JWT_ACCESS_SECRET, new Date());
  return { userId: user.id, accessToken };
}

/** Hours before now, so streak assertions don't depend on the wall clock's date. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

async function addEntry(userId: string, eventType: string, timestamp: Date, source = 'manual') {
  await prisma.skyLogEntry.create({ data: { userId, eventType, timestamp, source } });
}

describe('GET /api/log', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('401s without a token', async () => {
    const res = await request(app()).get('/api/log');
    expect(res.status).toBe(401);
  });

  it('returns an honest empty state for a new user', async () => {
    const { accessToken } = await createUser('empty');
    const res = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as LogPayload;
    expect(body.entries).toEqual([]);
    expect(body.stats.totalSightings).toBe(0);
    expect(body.stats.lastAuroraSighting).toBeNull();
    expect(LogPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('returns the timeline newest-first with real stats', async () => {
    const { userId, accessToken } = await createUser('stats');
    await addEntry(userId, 'iss_pass', hoursAgo(2));
    await addEntry(userId, 'aurora', hoursAgo(3));
    await addEntry(userId, 'meteor_shower', hoursAgo(200));

    const res = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);
    const body = res.body as LogPayload;

    expect(res.status).toBe(200);
    expect(body.stats.totalSightings).toBe(3);
    expect(body.stats.issPassesCaught).toBe(1);
    expect(body.stats.lastAuroraSighting).not.toBeNull();
    expect(body.entries.map((e) => e.eventType)).toEqual(['iss_pass', 'aurora', 'meteor_shower']);
    expect(LogPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('never leaks another user’s entries', async () => {
    const mine = await createUser('mine');
    const theirs = await createUser('theirs');
    await addEntry(theirs.userId, 'aurora', hoursAgo(2));

    const res = await request(app())
      .get('/api/log')
      .set('Authorization', `Bearer ${mine.accessToken}`);

    expect((res.body as LogPayload).entries).toEqual([]);
    expect((res.body as LogPayload).stats.totalSightings).toBe(0);
  });

  it('does not expose the owning userId on an entry', async () => {
    const { userId, accessToken } = await createUser('noleak');
    await addEntry(userId, 'aurora', hoursAgo(2));

    const res = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);
    expect((res.body as LogPayload).entries[0]).not.toHaveProperty('userId');
  });

  it('carries the source flag through for the filled-versus-hollow marker', async () => {
    const { userId, accessToken } = await createUser('source');
    await addEntry(userId, 'iss_pass', hoursAgo(2), 'auto');

    const res = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);
    expect((res.body as LogPayload).entries[0]!.source).toBe('auto');
  });

  it('counts a live streak from entries on consecutive nights', async () => {
    const { userId, accessToken } = await createUser('streak');
    // 2h ago and 26h ago are one night apart regardless of when this runs.
    await addEntry(userId, 'aurora', hoursAgo(2));
    await addEntry(userId, 'aurora', hoursAgo(26));

    const res = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);
    expect((res.body as LogPayload).stats.currentStreakNights).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/log — failure paths', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('500s rather than shipping a payload that fails its own schema', async () => {
    // `eventType` is a plain String column with no DB constraint, so a row
    // written by an older build (or a future event type) can hold a value
    // outside the API's closed enum. The guard must catch it here.
    const { userId, accessToken } = await createUser('badrow');
    await prisma.skyLogEntry.create({
      data: { userId, eventType: 'ufo_sighting', timestamp: hoursAgo(1), source: 'manual' },
    });

    const res = await request(app()).get('/api/log').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toContain('failed validation');
  });

  it('500s cleanly when the database read fails', async () => {
    const { accessToken } = await createUser('dbfail');
    const failingPrisma = {
      skyLogEntry: { findMany: () => Promise.reject(new Error('connection lost')) },
    } as unknown as typeof prisma;

    const res = await request(
      createApp({
        n2yoApiKey: 'TEST_KEY',
        prisma: failingPrisma,
        jwtAccessSecret: JWT_ACCESS_SECRET,
      }),
    )
      .get('/api/log')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toBe('internal error');
  });
});
