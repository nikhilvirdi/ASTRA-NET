/**
 * `/api/settings` integration tests against the real docker-compose
 * Postgres — the JSONB round-trip is the thing under test, so a mocked
 * Prisma would prove nothing about how the blob actually persists.
 */

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { SettingsPayloadSchema } from '../settings/settings.schemas.js';
import { loadDatabaseUrl } from '../test-support/db.js';

const TEST_EMAIL_SUFFIX = '@settings-route-test.invalid';
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

const prisma = createPrismaClient(loadDatabaseUrl());

interface SettingsBody {
  alerts: Record<string, boolean>;
  defaultLocation: { id: string; label: string; latitude: number; longitude: number } | null;
  alertsDeliverable: boolean;
}

function app() {
  return createApp({ n2yoApiKey: 'TEST_KEY', prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
}

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

async function createUser(prefix: string, settings: object = {}) {
  const user = await prisma.user.create({
    data: { email: `${prefix}${TEST_EMAIL_SUFFIX}`, settings },
  });
  const accessToken = await signAccessToken(user.id, JWT_ACCESS_SECRET, new Date());
  return { userId: user.id, accessToken };
}

describe('GET /api/settings', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('401s without a token', async () => {
    expect((await request(app()).get('/api/settings')).status).toBe(401);
  });

  it('returns every alert off by default, with no location set', async () => {
    const { accessToken } = await createUser('fresh');
    const res = await request(app())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as SettingsBody;
    expect(body.alerts).toEqual({
      iss_pass: false,
      aurora: false,
      meteor_shower: false,
      neo_approach: false,
    });
    expect(body.defaultLocation).toBeNull();
    expect(body.alertsDeliverable).toBe(false);
    expect(SettingsPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('reports the user’s default saved location — the per-user override', async () => {
    const { userId, accessToken } = await createUser('located');
    await prisma.location.create({
      data: { userId, label: 'Backyard', latitude: 12.34, longitude: 56.78, isDefault: true },
    });
    await prisma.location.create({
      data: { userId, label: 'Elsewhere', latitude: -1, longitude: -2, isDefault: false },
    });

    const res = await request(app())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = res.body as SettingsBody;

    expect(body.defaultLocation?.label).toBe('Backyard');
    expect(body.defaultLocation?.latitude).toBeCloseTo(12.34, 10);
  });

  it('survives a settings blob written in an unrecognised shape', async () => {
    const { accessToken } = await createUser('legacy', { alerts: 'nonsense', theme: 'red' });
    const res = await request(app())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect((res.body as SettingsBody).alerts.aurora).toBe(false);
  });
});

describe('PUT /api/settings/alerts', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('401s without a token', async () => {
    const res = await request(app())
      .put('/api/settings/alerts')
      .send({ alerts: { aurora: true } });
    expect(res.status).toBe(401);
  });

  it('persists a toggle and reads it back', async () => {
    const { accessToken } = await createUser('toggle');

    const put = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: true } });

    expect(put.status).toBe(200);
    expect((put.body as SettingsBody).alerts.aurora).toBe(true);

    const get = await request(app())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect((get.body as SettingsBody).alerts.aurora).toBe(true);
  });

  it('leaves untouched toggles alone', async () => {
    const { accessToken } = await createUser('partial');
    await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: true, iss_pass: true } });

    const res = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: false } });

    const body = res.body as SettingsBody;
    expect(body.alerts.aurora).toBe(false);
    expect(body.alerts.iss_pass).toBe(true);
  });

  it('preserves unrelated keys already in the settings blob', async () => {
    const { userId, accessToken } = await createUser('preserve', { theme: 'red-light' });

    await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { neo_approach: true } });

    const row = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
    expect((row!.settings as { theme?: string }).theme).toBe('red-light');
  });

  it('400s on an empty alerts object rather than silently saving nothing', async () => {
    const { accessToken } = await createUser('empty-body');
    const res = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: {} });
    expect(res.status).toBe(400);
  });

  it('400s on an unknown alert key', async () => {
    const { accessToken } = await createUser('unknown-key');
    const res = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { comet_watch: true } });
    expect(res.status).toBe(400);
  });

  it('400s on a non-boolean value', async () => {
    const { accessToken } = await createUser('bad-value');
    const res = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: 'yes' } });
    expect(res.status).toBe(400);
  });

  it('400s on an unexpected top-level field', async () => {
    const { accessToken } = await createUser('strict');
    const res = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: true }, isAdmin: true });
    expect(res.status).toBe(400);
  });

  it('never writes to another user’s settings', async () => {
    const mine = await createUser('writer');
    const theirs = await createUser('bystander');

    await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${mine.accessToken}`)
      .send({ alerts: { aurora: true } });

    const row = await prisma.user.findUnique({
      where: { id: theirs.userId },
      select: { settings: true },
    });
    expect(row!.settings).toEqual({});
  });
});

describe('/api/settings — failure paths', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  function failingApp() {
    const failingPrisma = {
      user: {
        findUnique: () => Promise.reject(new Error('connection lost')),
        update: () => Promise.reject(new Error('connection lost')),
      },
      location: { findFirst: () => Promise.reject(new Error('connection lost')) },
    } as unknown as typeof prisma;
    return createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma: failingPrisma,
      jwtAccessSecret: JWT_ACCESS_SECRET,
    });
  }

  it('500s cleanly when the read fails', async () => {
    const { accessToken } = await createUser('readfail');
    const res = await request(failingApp())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toBe('internal error');
  });

  it('500s cleanly when the write fails', async () => {
    const { accessToken } = await createUser('writefail');
    const res = await request(failingApp())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: true } });

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toBe('internal error');
  });

  it('404s when the token is valid but the user is gone', async () => {
    const { userId, accessToken } = await createUser('ghost');
    await prisma.user.delete({ where: { id: userId } });

    const get = await request(app())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    const put = await request(app())
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alerts: { aurora: true } });

    expect(get.status).toBe(404);
    expect(put.status).toBe(404);
  });
});
