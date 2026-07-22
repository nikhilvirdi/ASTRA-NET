/**
 * `/api/locations` route integration tests against the real docker-compose
 * Postgres — no mocked Prisma Client, matching `auth.test.ts`'s standard
 * for Phase 5+ DB-backed routes. Test users live under
 * `@locations-test.invalid` and are deleted before and after the run;
 * their Location rows cascade-delete with them.
 */

import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { registerLocationsRoutes } from './locations.js';

const TEST_EMAIL_SUFFIX = '@locations-test.invalid';
// Obviously-fake placeholder secret — matches auth.test.ts's convention.
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

interface LocationBody {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

/** `supertest`'s `Response.body` is typed `any` — cast at the boundary, matching auth.test.ts's convention. */
function asLocation(res: request.Response): LocationBody {
  return res.body as LocationBody;
}

function asLocationList(res: request.Response): LocationBody[] {
  return res.body as LocationBody[];
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
  registerLocationsRoutes(app, { prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
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

describe('/api/locations', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(401);
  });

  it('first_location_is_auto_defaulted', async () => {
    const { accessToken } = await createTestUser('first-default');

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 40.7, longitude: -74.0 });

    expect(res.status).toBe(201);
    expect(asLocation(res).isDefault).toBe(true);
  });

  it('a second location for the same user is not auto-defaulted', async () => {
    const { accessToken } = await createTestUser('second-not-default');

    const first = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 40.7, longitude: -74.0 });
    const second = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Cabin', latitude: 44.0, longitude: -71.0 });

    expect(asLocation(first).isDefault).toBe(true);
    expect(second.status).toBe(201);
    expect(asLocation(second).isDefault).toBe(false);
  });

  it('rejects an invalid create body with 400', async () => {
    const { accessToken } = await createTestUser('invalid-create');

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: '', latitude: 200, longitude: -74.0 });

    expect(res.status).toBe(400);
  });

  it('lists only the requesting user’s own locations', async () => {
    const userA = await createTestUser('list-a');
    const userB = await createTestUser('list-b');

    await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ label: 'A Home', latitude: 1, longitude: 1 });
    await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ label: 'B Home', latitude: 2, longitude: 2 });

    const resA = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(resA.status).toBe(200);
    const locationsA = asLocationList(resA);
    expect(locationsA).toHaveLength(1);
    expect(locationsA[0]?.label).toBe('A Home');
  });

  it('returns_404_not_403_for_another_users_location_on_get', async () => {
    const owner = await createTestUser('cross-get-owner');
    const intruder = await createTestUser('cross-get-intruder');

    const created = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ label: 'Secret Spot', latitude: 10, longitude: 10 });

    const res = await request(app)
      .get(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns_404_not_403_for_another_users_location_on_patch', async () => {
    const owner = await createTestUser('cross-patch-owner');
    const intruder = await createTestUser('cross-patch-intruder');

    const created = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ label: 'Secret Spot', latitude: 10, longitude: 10 });

    const res = await request(app)
      .patch(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ label: 'Hijacked' });

    expect(res.status).toBe(404);

    const stillOwners = await request(app)
      .get(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(asLocation(stillOwners).label).toBe('Secret Spot');
  });

  it('returns_404_not_403_for_another_users_location_on_delete', async () => {
    const owner = await createTestUser('cross-delete-owner');
    const intruder = await createTestUser('cross-delete-intruder');

    const created = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ label: 'Secret Spot', latitude: 10, longitude: 10 });

    const res = await request(app)
      .delete(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(404);

    const stillThere = await request(app)
      .get(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(stillThere.status).toBe(200);
  });

  it('returns 404 for a nonexistent location id', async () => {
    const { accessToken } = await createTestUser('nonexistent');

    const res = await request(app)
      .get('/api/locations/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('switches the default atomically, unsetting the previous default', async () => {
    const { accessToken } = await createTestUser('switch-default');

    const first = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 1, longitude: 1 });
    const second = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Cabin', latitude: 2, longitude: 2 });

    const switchRes = await request(app)
      .patch(`/api/locations/${asLocation(second).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isDefault: true });
    expect(switchRes.status).toBe(200);
    expect(asLocation(switchRes).isDefault).toBe(true);

    const list = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`);
    const locations = asLocationList(list);
    const defaults = locations.filter((loc) => loc.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe(asLocation(second).id);

    const reloadedFirst = locations.find((loc) => loc.id === asLocation(first).id);
    expect(reloadedFirst?.isDefault).toBe(false);
  });

  it('updates label/lat/lon without touching default status', async () => {
    const { accessToken } = await createTestUser('update-fields');

    const created = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 1, longitude: 1 });

    const res = await request(app)
      .patch(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Renamed Home' });

    expect(res.status).toBe(200);
    expect(asLocation(res).label).toBe('Renamed Home');
    expect(asLocation(res).isDefault).toBe(true);
  });

  it('rejects isDefault: false as an invalid update body', async () => {
    const { accessToken } = await createTestUser('reject-undefault');

    const created = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 1, longitude: 1 });

    const res = await request(app)
      .patch(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isDefault: false });

    expect(res.status).toBe(400);
  });

  it('deleting the default location promotes the next-oldest to default', async () => {
    const { accessToken } = await createTestUser('delete-promotes');

    const first = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 1, longitude: 1 });
    const second = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Cabin', latitude: 2, longitude: 2 });

    const del = await request(app)
      .delete(`/api/locations/${asLocation(first).id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`);
    const locations = asLocationList(list);
    expect(locations).toHaveLength(1);
    expect(locations[0]?.id).toBe(asLocation(second).id);
    expect(locations[0]?.isDefault).toBe(true);
  });

  it('deleting a non-default location leaves the default untouched', async () => {
    const { accessToken } = await createTestUser('delete-nondefault');

    const first = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 1, longitude: 1 });
    const second = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Cabin', latitude: 2, longitude: 2 });

    const del = await request(app)
      .delete(`/api/locations/${asLocation(second).id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`);
    const locations = asLocationList(list);
    expect(locations).toHaveLength(1);
    expect(locations[0]?.id).toBe(asLocation(first).id);
    expect(locations[0]?.isDefault).toBe(true);
  });

  it('deleting the only location leaves the user with none', async () => {
    const { accessToken } = await createTestUser('delete-only');

    const created = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Home', latitude: 1, longitude: 1 });

    const del = await request(app)
      .delete(`/api/locations/${asLocation(created).id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(asLocationList(list)).toHaveLength(0);
  });
});
