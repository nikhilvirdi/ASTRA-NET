import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { resetStore, setSourceState } from '../poller/store.js';
import { BestSpotPayloadSchema } from '../best-spot/best-spot.schemas.js';
import {
  CANDIDATE_BEARINGS_DEG,
  CANDIDATE_RING_RADII_KM,
  generateCandidateSites,
} from '../best-spot/candidates.js';
import type { BestSpotPayload } from '../best-spot/build-best-spot.js';
import type { OpenMeteoData } from '../clients/open-meteo/index.js';

// Never connects: this route doesn't touch the DB, and Prisma only opens a
// connection on first query.
const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');

const CANDIDATE_COUNT = 1 + CANDIDATE_RING_RADII_KM.length * CANDIDATE_BEARINGS_DEG.length;

/** Cloud batch stub: one entry per requested point, uniform cover. */
function cloudBatch(cloudCoverPercent = 25) {
  return vi.fn((params: { points: { latitude: number; longitude: number }[] }, now: Date) =>
    Promise.resolve(
      params.points.map<OpenMeteoData>((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        hourly: [{ time: now.toISOString(), cloudCoverPercent, visibilityMeters: 25000 }],
        fetchedAt: now.toISOString(),
      })),
    ),
  );
}

/** Deterministic Bortle stub — darker the further north, so ranking is predictable. */
const bortleStub = vi.fn((latDeg: number, _lonDeg: number) =>
  Math.max(1, Math.min(9, Math.round(9 - (latDeg - 32) * 4))),
);

function appWith(
  overrides: Parameters<typeof createApp>[0] extends infer T ? Partial<T> : never = {},
) {
  return createApp({
    n2yoApiKey: 'TEST_KEY',
    prisma,
    fetchOpenMeteoBatch: cloudBatch(),
    bortleAt: bortleStub,
    ...overrides,
  });
}

describe('GET /api/best-spot', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('400s when lat/lon are missing', async () => {
    const res = await request(appWith()).get('/api/best-spot');
    expect(res.status).toBe(400);
  });

  it('400s when lat/lon are out of range', async () => {
    const res = await request(appWith()).get('/api/best-spot?lat=95&lon=0');
    expect(res.status).toBe(400);
  });

  it('400s on an unsupported event filter', async () => {
    const res = await request(appWith()).get('/api/best-spot?lat=32.7&lon=74.9&event=meteor');
    expect(res.status).toBe(400);
  });

  it('400s on an unparseable at timestamp', async () => {
    const res = await request(appWith()).get('/api/best-spot?lat=32.7&lon=74.9&at=not-a-date');
    expect(res.status).toBe(400);
  });

  it('returns a ranked list that satisfies its own response schema', async () => {
    const res = await request(appWith()).get('/api/best-spot?lat=32.7266&lon=74.857');
    expect(res.status).toBe(200);

    const parsed = BestSpotPayloadSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    const body = res.body as BestSpotPayload;
    expect(body.status).toBe('ok');
    expect(body.sites).toHaveLength(CANDIDATE_COUNT);
    expect(body.sites.map((s) => s.rank)).toEqual(
      Array.from({ length: CANDIDATE_COUNT }, (_, i) => i + 1),
    );
  });

  it('exposes each score component separately for the "why ranked" display', async () => {
    const res = await request(appWith()).get('/api/best-spot?lat=32.7266&lon=74.857');
    const site = (res.body as BestSpotPayload).sites[0]!;

    // Each factor is present and inspectable on its own, not folded into `score`.
    expect(site.clarity.available).toBe(true);
    expect(site.clarity.cloudCoverPercent).toBe(25);
    expect(typeof site.clarity.factor).toBe('number');
    expect(site.clarity.forecastTime).not.toBeNull();

    expect(typeof site.darkness.factor).toBe('number');
    expect(typeof site.darkness.bortleClass).toBe('number');

    expect(typeof site.travel.factor).toBe('number');
    expect(typeof site.travel.distanceKm).toBe('number');

    // And the three genuinely compose into the score that was ranked on.
    expect(site.score).toBeCloseTo(
      site.clarity.factor! * site.darkness.factor * site.travel.factor,
      12,
    );
  });

  it('fetches cloud cover for every candidate in a single batch request', async () => {
    const batch = cloudBatch();
    await request(appWith({ fetchOpenMeteoBatch: batch })).get('/api/best-spot?lat=32.7&lon=74.9');

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]![0].points).toHaveLength(CANDIDATE_COUNT);
  });

  it('scores the generated candidate coordinates, not the observer repeatedly', async () => {
    const batch = cloudBatch();
    await request(appWith({ fetchOpenMeteoBatch: batch })).get(
      '/api/best-spot?lat=32.7266&lon=74.857',
    );

    const requested = batch.mock.calls[0]![0].points;
    const expected = generateCandidateSites({ latDeg: 32.7266, lonDeg: 74.857 });
    expect(requested.map((p) => p.latitude)).toEqual(expected.map((c) => c.latDeg));
    expect(requested.map((p) => p.longitude)).toEqual(expected.map((c) => c.lonDeg));
  });

  it('degrades to darkness+travel when the cloud batch fails wholesale', async () => {
    const failing = vi.fn(
      (params: { points: { latitude: number; longitude: number }[] }, now: Date) =>
        Promise.resolve(
          params.points.map<OpenMeteoData>((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            hourly: null,
            fetchedAt: now.toISOString(),
          })),
        ),
    );

    const res = await request(appWith({ fetchOpenMeteoBatch: failing })).get(
      '/api/best-spot?lat=32.7&lon=74.9',
    );

    expect(res.status).toBe(200);
    const body = res.body as BestSpotPayload;
    expect(body.status).toBe('ok');
    expect(body.ranking.clarityAvailable).toBe(false);
    expect(body.ranking.basis).toBe('darkness-travel');
    expect(body.ranking.note).toContain('darkness and travel only');
    expect(body.sites.every((s) => s.score > 0)).toBe(true);
    expect(BestSpotPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('reports unavailable — not a 500 — when the Bortle atlas is down', async () => {
    const res = await request(appWith({ bortleAt: vi.fn(() => null) })).get(
      '/api/best-spot?lat=32.7&lon=74.9',
    );

    expect(res.status).toBe(200);
    const body = res.body as BestSpotPayload;
    expect(body.status).toBe('unavailable');
    expect(body.sites).toEqual([]);
    expect(BestSpotPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('ranks on the plain §11 score with no event filter, even at high Kp', async () => {
    setSourceState(
      'spaceWeatherForecast',
      {
        kpObserved: null,
        kpForecast: [
          { timeTag: '2026-07-27T21:00:00.000Z', kp: 8, status: 'predicted', noaaScale: null },
        ],
        solarWind: null,
        fetchedAt: '2026-07-27T20:00:00.000Z',
      },
      '2026-07-27T20:00:00.000Z',
      true,
    );

    const res = await request(appWith()).get('/api/best-spot?lat=68.35&lon=18.82');
    const body = res.body as BestSpotPayload;

    expect(body.ranking.auroraApplied).toBe(false);
    expect(body.sites.every((s) => s.aurora === null)).toBe(true);
  });

  it('applies the aurora factor when asked for and the Kp forecast supports it', async () => {
    setSourceState(
      'spaceWeatherForecast',
      {
        kpObserved: null,
        kpForecast: [
          { timeTag: '2026-07-27T21:00:00.000Z', kp: 8, status: 'predicted', noaaScale: null },
        ],
        solarWind: null,
        fetchedAt: '2026-07-27T20:00:00.000Z',
      },
      '2026-07-27T20:00:00.000Z',
      true,
    );

    const res = await request(appWith()).get(
      '/api/best-spot?lat=68.35&lon=18.82&event=aurora&at=2026-07-27T21:00:00.000Z',
    );
    const body = res.body as BestSpotPayload;

    expect(body.ranking.auroraApplied).toBe(true);
    expect(body.sites[0]!.aurora).not.toBeNull();
    expect(body.sites[0]!.aurora!.kp).toBe(8);
    expect(BestSpotPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('does not apply an aurora factor when the Kp forecast is unavailable', async () => {
    const res = await request(appWith()).get('/api/best-spot?lat=68.35&lon=18.82&event=aurora');
    const body = res.body as BestSpotPayload;

    expect(body.ranking.auroraApplied).toBe(false);
    expect(body.sites.every((s) => s.score > 0)).toBe(true);
  });

  it('ranks for the requested instant when `at` is supplied', async () => {
    const at = '2026-07-28T02:00:00.000Z';
    const res = await request(appWith()).get(`/api/best-spot?lat=32.7&lon=74.9&at=${at}`);

    expect((res.body as BestSpotPayload).targetTime).toBe(at);
  });

  it('defaults the target time to now', async () => {
    const before = Date.now();
    const res = await request(appWith()).get('/api/best-spot?lat=32.7&lon=74.9');
    const after = Date.now();

    const target = new Date((res.body as BestSpotPayload).targetTime).getTime();
    expect(target).toBeGreaterThanOrEqual(before);
    expect(target).toBeLessThanOrEqual(after);
  });
});

describe('GET /api/best-spot — self-validation', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('500s rather than shipping a payload that fails its own schema', async () => {
    // A corrupt atlas cell (out of the 1-9 scale) makes darknessFromBortle
    // return a negative factor — the response guard must catch that here
    // rather than let it reach a client.
    const res = await request(appWith({ bortleAt: vi.fn(() => 42) })).get(
      '/api/best-spot?lat=32.7&lon=74.9',
    );

    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toContain('failed validation');
  });
});
