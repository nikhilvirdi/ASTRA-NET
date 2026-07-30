import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { historyFactor } from '@astranet/shared';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { resetStore, setSourceState } from '../poller/store.js';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';
import type { DailyBrief } from '../brief/build-brief.js';

// Never connects: these tests exercise a route that doesn't touch the
// DB, and Prisma only opens a connection on first query.
const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');

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
    const app = createApp({ n2yoApiKey: 'TEST_KEY', prisma });
    const res = await request(app).get('/api/brief');
    expect(res.status).toBe(400);
  });

  it('400s when lat/lon are out of range', async () => {
    const app = createApp({ n2yoApiKey: 'TEST_KEY', prisma });
    const res = await request(app).get('/api/brief?lat=999&lon=45');
    expect(res.status).toBe(400);
  });

  it('200s with a resolved Brief for valid coordinates, including a live-fetched next pass', async () => {
    const fetchN2yoVisualPasses = vi.fn().mockResolvedValue(visualPassesSuccess);
    const app = createApp({ n2yoApiKey: 'TEST_KEY', prisma, fetchN2yoVisualPasses });

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
    const app = createApp({ n2yoApiKey: 'TEST_KEY', prisma, fetchN2yoVisualPasses });

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
    const app = createApp({ n2yoApiKey: 'TEST_KEY', prisma, fetchN2yoVisualPasses });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(body.spaceWeather.status).toBe('ok');
    expect(body.spaceWeather.data?.solarLine.live.speedKmS).toBe(450);
  });
});

/**
 * Prediction persistence + global f_hist wiring — these genuinely touch
 * the DB (an active CME in poller state triggers a history lookup and a
 * `Prediction` write), so they run against the real docker-compose
 * Postgres rather than the `db.invalid` client the tests above rely on.
 * There is no account system: every qualifying request persists, not
 * just some — see DECISIONS.md.
 */
describe('GET /api/brief — prediction persistence + f_hist (real Postgres)', () => {
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

  /** Every prediction this file writes is tracked here, so cleanup is exact. */
  const createdIds: string[] = [];

  async function cleanup(): Promise<void> {
    if (createdIds.length > 0) {
      await realPrisma.prediction.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
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

  it('persists a Prediction for every qualifying request when there is an active CME', async () => {
    const now = new Date();
    setActiveCmeState(now);

    const res = await request(createTestApp()).get('/api/brief?lat=65&lon=-20');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.spaceWeather.data?.aurora?.hasActiveCme).toBe(true);

    const stored = await realPrisma.prediction.findMany({
      where: { context: { path: ['cmeActivityId'], equals: 'brief-test-cme-1' } },
    });
    stored.forEach((row) => createdIds.push(row.id));
    expect(stored).toHaveLength(1);
    // `predictedKp`/`confidence` are Prisma `Float` (PG `double precision`). Postgres emits
    // float8 as decimal text at `extra_float_digits` significant digits (1 → 16 on this
    // server), so a double needing all 17 does not survive the round-trip bit-for-bit and
    // exact `.toBe()` equality flakes. Measured against the real DB over 800 random doubles:
    // ~27% fail exact equality, max absolute error 5.6e-17 for confidence (range [0,1]) and
    // 8.9e-16 for predictedKp (range [0,9]) — i.e. ~2 ULP, purely representational.
    // Precision 12 (tolerance 5e-13) clears that by >500x while still being far tighter than
    // any semantically meaningful difference in a 0-1 score or a 0-9 Kp index.
    const auroraCard = body.spaceWeather.data?.aurora;
    expect(auroraCard).toBeDefined();
    // An active CME is what makes this row persistable at all, so confidence must be present.
    expect(auroraCard!.confidence).not.toBeNull();
    expect(stored[0]?.predictedKp).toBeCloseTo(auroraCard!.kpPredicted, 12);
    expect(stored[0]?.confidence).toBeCloseTo(auroraCard!.confidence!, 12);
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

  it('never persists a Prediction when there is no active CME', async () => {
    // No setActiveCmeState call — poller store stays empty (no CME data at all).
    // No per-request marker to filter on here, so this asserts on the
    // total count rather than a scoped query, matching the accuracy
    // route tests' own before/after convention against a shared database.
    const before = await realPrisma.prediction.count();

    const res = await request(createTestApp()).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.spaceWeather.data?.aurora?.hasActiveCme ?? false).toBe(false);
    const after = await realPrisma.prediction.count();
    expect(after).toBe(before);
  });

  it('feeds real global accuracy-loop history into the returned confidence factors (f_hist)', async () => {
    // Seed a real, already-scored track record: 3 hits out of 4 trials.
    const seeded = await Promise.all([
      realPrisma.prediction.create({
        data: {
          targetTime: new Date(),
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
      }),
      realPrisma.prediction.create({
        data: {
          targetTime: new Date(),
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
      }),
      realPrisma.prediction.create({
        data: {
          targetTime: new Date(),
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
      }),
      realPrisma.prediction.create({
        data: {
          targetTime: new Date(),
          predictedKp: 8,
          confidence: 0.6,
          scored: true,
          hit: false,
          actualKp: 2,
        },
      }),
    ]);
    seeded.forEach((row) => createdIds.push(row.id));

    const now = new Date();
    setActiveCmeState(now);

    const res = await request(createTestApp()).get('/api/brief?lat=65&lon=-20');
    const body = res.body as DailyBrief;

    expect(body.spaceWeather.data?.aurora?.hasActiveCme).toBe(true);
    // FORMULAS.md §8/§9: (3 + 2) / (4 + 4) = 0.625 — not the neutral-prior
    // 0.5 this same scenario would produce with zero real history.
    expect(body.spaceWeather.data?.aurora?.factors?.history).toBeCloseTo(historyFactor(3, 4), 10);
    expect(body.spaceWeather.data?.aurora?.factors?.history).not.toBeCloseTo(0.5, 2);

    // The Brief's own persisted row (matched by its CME marker) also needs cleanup.
    const own = await realPrisma.prediction.findMany({
      where: { context: { path: ['cmeActivityId'], equals: 'brief-test-cme-1' } },
    });
    own.forEach((row) => createdIds.push(row.id));
  });
});

/**
 * The two "a DB call failed, degrade rather than blank the Brief" paths.
 *
 * Both route through `logUnexpectedBriefError`. Each path is asserted on
 * behaviour (the Brief still serves), not merely on the log call.
 */
describe('GET /api/brief — degradation when a DB call fails', () => {
  function appWithPrisma(prismaLike: unknown): ReturnType<typeof createApp> {
    return createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma: prismaLike as Parameters<typeof createApp>[0]['prisma'],
      fetchN2yoVisualPasses: vi.fn().mockResolvedValue(null),
    });
  }

  /** Poller state with an active, still-incoming CME — what triggers the prediction-persistence path. */
  function setActiveCme(now: Date): void {
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
            activityId: 'degrade-test-cme',
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

  beforeEach(() => {
    resetStore();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('still serves the Brief on the neutral prior when the history lookup throws', async () => {
    const now = new Date();
    setActiveCme(now);
    const app = appWithPrisma({
      prediction: {
        count: () => Promise.reject(new Error('connection lost')),
        create: () => Promise.resolve({}),
      },
    });

    const res = await request(app).get('/api/brief?lat=65&lon=-20');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    // f_hist falls back to the neutral Beta prior, so confidence still resolves.
    expect(body.spaceWeather.data?.aurora?.confidence).not.toBeNull();
    expect(body.spaceWeather.data?.aurora?.factors?.history).toBeCloseTo(historyFactor(0, 0), 12);
  });

  it('still serves the Brief when persisting the prediction throws', async () => {
    const now = new Date();
    setActiveCme(now);
    const app = appWithPrisma({
      prediction: {
        count: () => Promise.resolve(0),
        create: () => Promise.reject(new Error('unique constraint')),
      },
    });

    const res = await request(app).get('/api/brief?lat=65&lon=-20');
    const body = res.body as DailyBrief;

    // Persistence is a side effect; failing it must never cost the user their Brief.
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.spaceWeather.data?.aurora?.hasActiveCme).toBe(true);
  });
});
