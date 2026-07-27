/**
 * `/api/accuracy` integration tests against the real docker-compose
 * Postgres.
 *
 * Two things matter beyond the happy path: the endpoint is genuinely
 * public, and DESIGN_SPEC.md §14's "no cherry-picking controls" is
 * enforced by the API rather than merely by the UI — so the filter
 * parameters a client might reach for are asserted to have no effect.
 */

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { AccuracyPayloadSchema } from '../accuracy/accuracy.schemas.js';
import type { AccuracyPayload } from '../accuracy/build-accuracy.js';
import { loadDatabaseUrl } from '../test-support/db.js';

const TEST_EMAIL_SUFFIX = '@accuracy-route-test.invalid';
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

const prisma = createPrismaClient(loadDatabaseUrl());

function app() {
  return createApp({ n2yoApiKey: 'TEST_KEY', prisma, jwtAccessSecret: JWT_ACCESS_SECRET });
}

/**
 * `/accuracy` is global, so any Prediction row in the database shows up.
 * These tests therefore assert on *their own* rows relative to a baseline
 * taken first, rather than on absolute totals a shared dev database
 * cannot guarantee.
 */
async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

async function seedScoredPredictions(
  prefix: string,
  rows: { targetTime: string; predictedKp: number; actualKp: number; hit: boolean }[],
) {
  const user = await prisma.user.create({ data: { email: `${prefix}${TEST_EMAIL_SUFFIX}` } });
  for (const row of rows) {
    await prisma.prediction.create({
      data: {
        userId: user.id,
        targetTime: new Date(row.targetTime),
        predictedKp: row.predictedKp,
        confidence: 0.5,
        actualKp: row.actualKp,
        hit: row.hit,
        scored: true,
      },
    });
  }
  return user.id;
}

async function getBody(query = ''): Promise<AccuracyPayload> {
  const res = await request(app()).get(`/api/accuracy${query}`);
  expect(res.status).toBe(200);
  return res.body as AccuracyPayload;
}

describe('GET /api/accuracy', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('is public — no token required', async () => {
    const res = await request(app()).get('/api/accuracy');
    expect(res.status).toBe(200);
    expect(AccuracyPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('publishes real scored predictions', async () => {
    const before = await getBody();
    await seedScoredPredictions('seeded', [
      { targetTime: '2026-06-01T00:00:00Z', predictedKp: 5, actualKp: 5, hit: true },
      { targetTime: '2026-06-02T00:00:00Z', predictedKp: 6, actualKp: 3, hit: false },
    ]);
    const after = await getBody();

    expect(after.series.length).toBe(before.series.length + 2);
    expect(after.hitRate.trials).toBe(before.hitRate.trials + 2);
    expect(after.hitRate.hits).toBe(before.hitRate.hits + 1);
    expect(AccuracyPayloadSchema.safeParse(after).success).toBe(true);
  });

  it('never exposes a user identifier — it is a public endpoint', async () => {
    await seedScoredPredictions('private', [
      { targetTime: '2026-06-03T00:00:00Z', predictedKp: 4, actualKp: 4, hit: true },
    ]);
    const body = await getBody();

    expect(body.series.length).toBeGreaterThan(0);
    for (const point of body.series) {
      expect(point).not.toHaveProperty('userId');
      expect(point).not.toHaveProperty('id');
      expect(Object.keys(point).sort()).toEqual(['actualKp', 'hit', 'predictedKp', 'targetTime']);
    }
  });

  it('omits unscored predictions rather than plotting them as zeroes', async () => {
    const before = await getBody();
    const user = await prisma.user.create({ data: { email: `unscored${TEST_EMAIL_SUFFIX}` } });
    await prisma.prediction.create({
      data: {
        userId: user.id,
        targetTime: new Date('2026-06-04T00:00:00Z'),
        predictedKp: 7,
        confidence: 0.5,
      },
    });
    const after = await getBody();

    expect(after.series.length).toBe(before.series.length);
    expect(after.hitRate.trials).toBe(before.hitRate.trials);
  });

  it('returns the series oldest-first', async () => {
    await seedScoredPredictions('ordered', [
      { targetTime: '2026-06-20T00:00:00Z', predictedKp: 5, actualKp: 5, hit: true },
      { targetTime: '2026-06-05T00:00:00Z', predictedKp: 5, actualKp: 5, hit: true },
      { targetTime: '2026-06-12T00:00:00Z', predictedKp: 5, actualKp: 5, hit: true },
    ]);
    const body = await getBody();

    const times = body.series.map((p) => p.targetTime);
    expect([...times].sort()).toEqual(times);
  });

  it('reports the Beta-prior rate, never a bare hits/trials', async () => {
    const body = await getBody();
    expect(body.hitRate.prior).toEqual({ hits: 2, trials: 4 });
    expect(body.hitRate.rate).toBeCloseTo((body.hitRate.hits + 2) / (body.hitRate.trials + 4), 12);
  });

  describe('DESIGN_SPEC §14 — no cherry-picking controls', () => {
    beforeEach(async () => {
      await cleanup();
      await seedScoredPredictions('nocherry', [
        { targetTime: '2026-01-01T00:00:00Z', predictedKp: 5, actualKp: 1, hit: false },
        { targetTime: '2026-02-01T00:00:00Z', predictedKp: 5, actualKp: 1, hit: false },
        { targetTime: '2026-06-01T00:00:00Z', predictedKp: 5, actualKp: 5, hit: true },
      ]);
    });

    it.each([
      ['?from=2026-05-01T00:00:00Z'],
      ['?to=2026-01-15T00:00:00Z'],
      ['?since=2026-05-01T00:00:00Z'],
      ['?limit=1'],
      ['?range=7d'],
      ['?order=desc'],
      ['?from=2026-05-01T00:00:00Z&to=2026-07-01T00:00:00Z&limit=1'],
    ])('ignores %s — the full record is the only view', async (query) => {
      const full = await getBody();
      const filtered = await getBody(query);

      expect(filtered.series).toEqual(full.series);
      expect(filtered.hitRate.hits).toBe(full.hitRate.hits);
      expect(filtered.hitRate.trials).toBe(full.hitRate.trials);
    });

    it('cannot be made to show only the good week', async () => {
      // The misses in January must be present no matter what is asked for.
      const filtered = await getBody('?from=2026-05-01T00:00:00Z&limit=1');
      const misses = filtered.series.filter((p) => !p.hit);
      expect(misses.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('GET /api/accuracy — failure paths', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('500s rather than publishing a record that fails its own schema', async () => {
    // `actualKp` is a plain Float column, so a bad write can hold a value
    // outside the 0-9 Kp index. Publishing it would misdraw the chart.
    const user = await prisma.user.create({ data: { email: `badkp${TEST_EMAIL_SUFFIX}` } });
    await prisma.prediction.create({
      data: {
        userId: user.id,
        targetTime: new Date('2026-06-09T00:00:00Z'),
        predictedKp: 5,
        confidence: 0.5,
        actualKp: 42,
        hit: false,
        scored: true,
      },
    });

    const res = await request(app()).get('/api/accuracy');

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toContain('failed validation');
  });

  it('500s cleanly when the database read fails', async () => {
    const failingPrisma = {
      prediction: {
        findMany: () => Promise.reject(new Error('connection lost')),
        count: () => Promise.reject(new Error('connection lost')),
      },
    } as unknown as typeof prisma;

    const res = await request(
      createApp({
        n2yoApiKey: 'TEST_KEY',
        prisma: failingPrisma,
        jwtAccessSecret: JWT_ACCESS_SECRET,
      }),
    ).get('/api/accuracy');

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toBe('internal error');
  });
});
