/**
 * `/api/sky-log` route integration tests against the real docker-compose
 * Postgres — no mocked Prisma Client, matching `locations.test.ts`'s
 * standard. Test users live under `@sky-log-test.invalid` and are
 * deleted before and after the run; their SkyLogEntry rows cascade-delete
 * with them.
 */

import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { registerSkyLogRoutes } from './sky-log.js';

const TEST_EMAIL_SUFFIX = '@sky-log-test.invalid';
// Obviously-fake placeholder secret — matches auth.test.ts's convention.
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

interface SkyLogEntryBody {
  id: string;
  userId: string;
  eventType: string;
  timestamp: string;
  source: string;
  details: Record<string, unknown>;
}

/** `supertest`'s `Response.body` is typed `any` — cast at the boundary, matching locations.test.ts's convention. */
function asEntry(res: request.Response): SkyLogEntryBody {
  return res.body as SkyLogEntryBody;
}

function asEntryList(res: request.Response): SkyLogEntryBody[] {
  return res.body as SkyLogEntryBody[];
}

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
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
  registerSkyLogRoutes(app, { prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
  return app;
}

async function deleteTestUsers(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

async function createTestUser(prefix: string): Promise<{ userId: string; accessToken: string }> {
  const user = await prisma.user.create({
    data: { email: `${prefix}${TEST_EMAIL_SUFFIX}` },
  });
  const accessToken = await signAccessToken(user.id, JWT_ACCESS_SECRET, new Date());
  return { userId: user.id, accessToken };
}

const app = createTestApp();

beforeAll(deleteTestUsers);
afterAll(deleteTestUsers);

describe('/api/sky-log', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/sky-log');
    expect(res.status).toBe(401);
  });

  it('creates a manual entry, forcing source to "manual" regardless of the request body', async () => {
    const { accessToken } = await createTestUser('create-manual');

    const res = await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        eventType: 'iss_pass',
        timestamp: '2026-07-20T21:00:00.000Z',
        details: { magnitude: -3.2 },
        source: 'auto',
      });

    expect(res.status).toBe(201);
    const entry = asEntry(res);
    expect(entry.source).toBe('manual');
    expect(entry.eventType).toBe('iss_pass');
    expect(entry.details).toEqual({ magnitude: -3.2 });
  });

  it('rejects an invalid create body with 400', async () => {
    const { accessToken } = await createTestUser('invalid-create');

    const res = await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ eventType: 'not_a_real_type', timestamp: '2026-07-20T21:00:00.000Z' });

    expect(res.status).toBe(400);
  });

  it('lists only the requesting user’s own entries, newest first', async () => {
    const userA = await createTestUser('list-a');
    const userB = await createTestUser('list-b');

    await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ eventType: 'aurora', timestamp: '2026-07-18T22:00:00.000Z' });
    await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ eventType: 'meteor_shower', timestamp: '2026-07-20T22:00:00.000Z' });
    await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ eventType: 'aurora', timestamp: '2026-07-19T22:00:00.000Z' });

    const resA = await request(app)
      .get('/api/sky-log')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(resA.status).toBe(200);
    const entriesA = asEntryList(resA);
    expect(entriesA).toHaveLength(2);
    expect(entriesA[0]?.eventType).toBe('meteor_shower');
    expect(entriesA[1]?.eventType).toBe('aurora');
  });

  it('honors an explicit limit on the list query', async () => {
    const { accessToken } = await createTestUser('list-limit');

    for (const timestamp of [
      '2026-07-15T22:00:00.000Z',
      '2026-07-16T22:00:00.000Z',
      '2026-07-17T22:00:00.000Z',
    ]) {
      await request(app)
        .post('/api/sky-log')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ eventType: 'aurora', timestamp });
    }

    const res = await request(app)
      .get('/api/sky-log?limit=2')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(asEntryList(res)).toHaveLength(2);
  });

  it('rejects an out-of-range limit with 400', async () => {
    const { accessToken } = await createTestUser('list-limit-invalid');

    const res = await request(app)
      .get('/api/sky-log?limit=0')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('returns_404_not_403_for_another_users_entry_on_get', async () => {
    const owner = await createTestUser('cross-get-owner');
    const intruder = await createTestUser('cross-get-intruder');

    const created = await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ eventType: 'aurora', timestamp: '2026-07-20T22:00:00.000Z' });

    const res = await request(app)
      .get(`/api/sky-log/${asEntry(created).id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns_404_not_403_for_another_users_entry_on_delete', async () => {
    const owner = await createTestUser('cross-delete-owner');
    const intruder = await createTestUser('cross-delete-intruder');

    const created = await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ eventType: 'aurora', timestamp: '2026-07-20T22:00:00.000Z' });

    const res = await request(app)
      .delete(`/api/sky-log/${asEntry(created).id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(404);

    const stillThere = await request(app)
      .get(`/api/sky-log/${asEntry(created).id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(stillThere.status).toBe(200);
  });

  it('returns 404 for a nonexistent entry id', async () => {
    const { accessToken } = await createTestUser('nonexistent');

    const res = await request(app)
      .get('/api/sky-log/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('deletes an owned entry', async () => {
    const { accessToken } = await createTestUser('delete-owned');

    const created = await request(app)
      .post('/api/sky-log')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ eventType: 'neo_approach', timestamp: '2026-07-20T22:00:00.000Z' });

    const del = await request(app)
      .delete(`/api/sky-log/${asEntry(created).id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/sky-log')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(asEntryList(list)).toHaveLength(0);
  });
});
