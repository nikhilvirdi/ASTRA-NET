import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { historyFactor } from '@astranet/shared';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { resetStore, setSourceState } from '../poller/store.js';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';
import type { DailyBrief } from '../brief/build-brief.js';

// Never connects: these tests exercise a route that doesn't touch the
// DB, and Prisma only opens a connection on first query.
const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');

// Obviously-fake placeholder secret — matches auth.test.ts's convention.
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const visualPassesSuccess: N2yoVisualPassesData = {
  satId: 25544,
  satName: 'ISS (ZARYA)',
  passes: [
    {
      startAzimuth: 10,
      startAzimuthCompass: 'N',
      startElevation: 10,
      startUtc: NOW_SECONDS + 3600,
      maxAzimuth: 90,
      maxAzimuthCompass: 'E',
      maxElevation: 45,
      maxUtc: NOW_SECONDS + 3720,
      endAzimuth: 180,
      endAzimuthCompass: 'S',
      endElevation: 10,
      endUtc: NOW_SECONDS + 3840,
      magnitude: -2.5,
      duration: 240,
    },
  ],
  fetchedAt: new Date().toISOString(),
};

describe('GET /api/brief', () => {
  beforeEach(() => {
    resetStore();
  });

  it('400s when lat/lon are missing', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      jwtAccessSecret: 'test-only-fake-jwt-secret-not-a-real-value',
    });
    const res = await request(app).get('/api/brief');
    expect(res.status).toBe(400);
  });

  it('400s when lat/lon are out of range', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      jwtAccessSecret: 'test-only-fake-jwt-secret-not-a-real-value',
    });
    const res = await request(app).get('/api/brief?lat=999&lon=45');
    expect(res.status).toBe(400);
  });

  it('200s with a resolved Brief for valid coordinates, including a live-fetched next pass', async () => {
    const fetchN2yoVisualPasses = vi.fn().mockResolvedValue(visualPassesSuccess);
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      jwtAccessSecret: 'test-only-fake-jwt-secret-not-a-real-value',
      fetchN2yoVisualPasses,
    });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.observer).toEqual({ latDeg: 45, lonDeg: -75 });
    expect(body.skyAnchor.status).toBe('ok');
    expect(body.iss.data?.nextPass?.startUtc).toBe(NOW_SECONDS + 3600);
    expect(fetchN2yoVisualPasses).toHaveBeenCalledWith(
      expect.objectContaining({ satId: 25544, observerLat: 45, observerLng: -75 }),
      'TEST_KEY',
      expect.any(Date),
    );
  });

  it('still 200s and degrades only next-pass when that fetch rejects, leaving live ISS position intact', async () => {
    setSourceState(
      'iss',
      {
        satId: 25544,
        satName: 'ISS',
        positions: [
          {
            latitude: 1,
            longitude: 2,
            altitude: 420,
            azimuth: 0,
            elevation: 0,
            ra: 0,
            dec: 0,
            timestamp: NOW_SECONDS,
            eclipsed: false,
          },
        ],
        fetchedAt: 't',
      },
      't',
      true,
    );
    const fetchN2yoVisualPasses = vi.fn().mockRejectedValue(new Error('N2YO down'));
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      jwtAccessSecret: 'test-only-fake-jwt-secret-not-a-real-value',
      fetchN2yoVisualPasses,
    });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.skyAnchor.status).toBe('ok');
    expect(body.iss.status).toBe('ok');
    expect(body.iss.data?.position?.latitude).toBe(1);
    expect(body.iss.data?.nextPass).toBeNull();
  });

  it('reflects live poller state in the response', async () => {
    setSourceState(
      'solarWind',
      {
        kpCurrent: { timeTag: 't', kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
        rtswPlasma: {
          timeTag: 't',
          source: 'DSCOVR',
          protonSpeed: 450,
          protonDensity: 5,
          protonTemperature: 100000,
          overallQuality: 0,
        },
        fetchedAt: 't',
      },
      't',
      true,
    );

    const fetchN2yoVisualPasses = vi.fn().mockResolvedValue(visualPassesSuccess);
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      jwtAccessSecret: 'test-only-fake-jwt-secret-not-a-real-value',
      fetchN2yoVisualPasses,
    });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(body.spaceWeather.status).toBe('ok');
    expect(body.spaceWeather.data?.solarLine.live.speedKmS).toBe(450);
  });
});

/**
 * Prediction persistence + global f_hist wiring (Phase 6 Task 4) — these
 * genuinely touch the DB (an active CME in poller state triggers a
 * history lookup and, for authenticated requests, a `Prediction` write),
 * so they run against the real docker-compose Postgres, matching
 * `locations.test.ts`'s standard, rather than the `db.invalid` client
 * the tests above rely on.
 */
describe('GET /api/brief — prediction persistence + f_hist (real Postgres)', () => {
  const TEST_EMAIL_SUFFIX = '@brief-prediction-test.invalid';

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
        'DATABASE_URL is not set and no repo-root .env was found — start the docker compose Postgres and set it before running these tests.',
      );
    }
    return url;
  }

  const realPrisma = createPrismaClient(loadDatabaseUrl());

  async function createTestUser(prefix: string): Promise<{ userId: string; accessToken: string }> {
    const user = await realPrisma.user.create({ data: { email: `${prefix}${TEST_EMAIL_SUFFIX}` } });
    const accessToken = await signAccessToken(user.id, JWT_ACCESS_SECRET, new Date());
    return { userId: user.id, accessToken };
  }

  async function cleanup(): Promise<void> {
    await realPrisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
  }

  /** Sets up poller state with an active, still-incoming CME (same shape space-weather-card.test.ts's cmeEvent uses). */
  function setActiveCmeState(now: Date): void {
    setSourceState(
      'solarWind',
      {
        kpCurrent: { timeTag: now.toISOString(), kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
        rtswPlasma: {
          timeTag: now.toISOString(),
          source: 'DSCOVR',
          protonSpeed: 420,
          protonDensity: 5,
          protonTemperature: 100000,
          overallQuality: 0,
        },
        fetchedAt: now.toISOString(),
      },
      now.toISOString(),
      true,
    );
    setSourceState(
      'spaceWeatherForecast',
      {
        kpObserved: null,
        kpForecast: [{ timeTag: now.toISOString(), kp: 5, status: 'predicted', noaaScale: null }],
        solarWind: null,
        fetchedAt: now.toISOString(),
      },
      now.toISOString(),
      true,
    );
    setSourceState(
      'donki',
      {
        cmes: [
          {
            activityId: 'brief-test-cme-1',
            startTime: new Date(now.getTime() - 3_600_000).toISOString(),
            note: null,
            link: null,
            analyses: [
              {
                isMostAccurate: true,
                time21_5: null,
                latitude: null,
                longitude: null,
                halfAngle: null,
                speed: 800,
                type: 'C',
              },
            ],
          },
        ],
        flares: null,
        fetchedAt: now.toISOString(),
      },
      now.toISOString(),
      true,
    );
  }

  function createTestApp(): ReturnType<typeof createApp> {
    return createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma: realPrisma,
      jwtAccessSecret: JWT_ACCESS_SECRET,
      fetchN2yoVisualPasses: vi.fn().mockResolvedValue(null),
    });
  }

  beforeEach(async () => {
    resetStore();
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await realPrisma.$disconnect();
  });

  it('persists a Prediction for an authenticated request when there is an active CME', async () => {
    const { userId, accessToken } = await createTestUser('authed-active-cme');
    const now = new Date();
    setActiveCmeState(now);

    const res = await request(createTestApp())
      .get('/api/brief?lat=65&lon=-20')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.spaceWeather.data?.aurora?.hasActiveCme).toBe(true);

    const stored = await realPrisma.prediction.findMany({ where: { userId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.predictedKp).toBe(body.spaceWeather.data?.aurora?.kpPredicted);
    expect(stored[0]?.confidence).toBe(body.spaceWeather.data?.aurora?.confidence);
    expect(stored[0]?.scored).toBe(false);
    expect(stored[0]?.actualKp).toBeNull();
    const context = stored[0]?.context as {
      cmeActivityId: string;
      confidenceBand: string;
      leadHours: number;
    };
    expect(context.cmeActivityId).toBe('brief-test-cme-1');
    expect(context.confidenceBand).toBe(body.spaceWeather.data?.aurora?.confidenceBand);
    expect(context.leadHours).toBeGreaterThan(0);
  });

  it('never persists a Prediction for an anonymous request, even with an active CME', async () => {
    const now = new Date();
    setActiveCmeState(now);

    const res = await request(createTestApp()).get('/api/brief?lat=65&lon=-20');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.spaceWeather.data?.aurora?.hasActiveCme).toBe(true);
    const stored = await realPrisma.prediction.findMany({
      where: { context: { path: ['cmeActivityId'], equals: 'brief-test-cme-1' } },
    });
    expect(stored).toHaveLength(0);
  });

  it('never persists a Prediction when there is no active CME, even for an authenticated request', async () => {
    const { userId, accessToken } = await createTestUser('authed-no-cme');
    // No setActiveCmeState call — poller store stays empty (no CME data at all).

    const res = await request(createTestApp())
      .get('/api/brief?lat=45&lon=-75')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.spaceWeather.data?.aurora?.hasActiveCme ?? false).toBe(false);
    const stored = await realPrisma.prediction.findMany({ where: { userId } });
    expect(stored).toHaveLength(0);
  });

  it('feeds real global accuracy-loop history into the returned confidence factors (f_hist)', async () => {
    const { userId } = await createTestUser('history-feed');
    // Seed a real, already-scored track record: 3 hits out of 4 trials.
    await realPrisma.prediction.createMany({
      data: [
        {
          userId,
          targetTime: new Date(),
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
        {
          userId,
          targetTime: new Date(),
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
        {
          userId,
          targetTime: new Date(),
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
        {
          userId,
          targetTime: new Date(),
          predictedKp: 8,
          confidence: 0.6,
          scored: true,
          hit: false,
          actualKp: 2,
        },
      ],
    });

    const now = new Date();
    setActiveCmeState(now);

    const res = await request(createTestApp()).get('/api/brief?lat=65&lon=-20');
    const body = res.body as DailyBrief;

    expect(body.spaceWeather.data?.aurora?.hasActiveCme).toBe(true);
    // FORMULAS.md §8/§9: (3 + 2) / (4 + 4) = 0.625 — not the neutral-prior
    // 0.5 this same scenario would produce with zero real history.
    expect(body.spaceWeather.data?.aurora?.factors?.history).toBeCloseTo(historyFactor(3, 4), 10);
    expect(body.spaceWeather.data?.aurora?.factors?.history).not.toBeCloseTo(0.5, 2);
  });
});
