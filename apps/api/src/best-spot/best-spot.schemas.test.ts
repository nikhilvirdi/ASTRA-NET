import { describe, it, expect } from 'vitest';
import { BestSpotPayloadSchema } from './best-spot.schemas.js';
import { buildBestSpot } from './build-best-spot.js';

/**
 * The response schema is the frontend contract, so it is tested the way a
 * validator has to be: against payloads that are *wrong*. A schema only ever
 * exercised with correct input proves nothing about what it rejects.
 */

function site(over: Record<string, unknown> = {}) {
  return {
    id: 'r25-b0',
    label: 'N 25 km',
    latDeg: 32.95,
    lonDeg: 74.857,
    rank: 1,
    score: 0.4,
    clarity: {
      factor: 0.8,
      cloudCoverPercent: 20,
      forecastTime: '2026-07-27T20:00:00.000Z',
      available: true,
    },
    darkness: { factor: 0.625, bortleClass: 4 },
    travel: {
      factor: 0.6065,
      distanceKm: 25,
      bearingDeg: 0,
      compass: 'N',
      travelMinutes: null,
    },
    aurora: null,
    ...over,
  };
}

function payload(over: Record<string, unknown> = {}) {
  return {
    observer: { latDeg: 32.7266, lonDeg: 74.857 },
    generatedAt: '2026-07-27T20:00:00.000Z',
    targetTime: '2026-07-27T20:00:00.000Z',
    status: 'ok',
    ranking: {
      basis: 'clarity-darkness-travel',
      clarityAvailable: true,
      auroraApplied: false,
      note: null,
    },
    sites: [site()],
    ...over,
  };
}

describe('BestSpotPayloadSchema — accepts real output', () => {
  it('accepts a hand-built valid payload', () => {
    expect(BestSpotPayloadSchema.safeParse(payload()).success).toBe(true);
  });

  it('accepts what buildBestSpot actually produces', () => {
    const built = buildBestSpot({
      observer: { latDeg: 32.7266, lonDeg: 74.857 },
      observations: [
        {
          candidate: {
            id: 'r25-b0',
            label: 'N 25 km',
            latDeg: 32.95,
            lonDeg: 74.857,
            distanceKm: 25,
            bearingDeg: 0,
            compass: 'N',
          },
          cloud: {
            latitude: 32.95,
            longitude: 74.857,
            hourly: [
              {
                time: '2026-07-27T20:00:00.000Z',
                cloudCoverPercent: 20,
                visibilityMeters: 20000,
              },
            ],
            fetchedAt: '2026-07-27T20:00:00.000Z',
          },
          bortle: 4,
        },
      ],
      kp: null,
      event: null,
      targetTime: new Date('2026-07-27T20:00:00.000Z'),
      now: new Date('2026-07-27T20:00:00.000Z'),
    });

    expect(BestSpotPayloadSchema.safeParse(built).success).toBe(true);
  });

  it('accepts the unavailable envelope with no sites', () => {
    const result = BestSpotPayloadSchema.safeParse(
      payload({
        status: 'unavailable',
        sites: [],
        ranking: {
          basis: 'darkness-travel',
          clarityAvailable: false,
          auroraApplied: false,
          note: null,
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('BestSpotPayloadSchema — rejects malformed output', () => {
  it('rejects a NaN score, which JSON would silently render as null', () => {
    expect(
      BestSpotPayloadSchema.safeParse(payload({ sites: [site({ score: NaN })] })).success,
    ).toBe(false);
  });

  it('rejects a score outside the [0,1] range a §11 product can produce', () => {
    expect(
      BestSpotPayloadSchema.safeParse(payload({ sites: [site({ score: 1.5 })] })).success,
    ).toBe(false);
  });

  it('rejects an out-of-scale Bortle class', () => {
    const bad = site({ darkness: { factor: 0.5, bortleClass: 12 } });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });

  it('rejects a darkness factor outside [0,1] — the corrupt-Bortle failure mode', () => {
    // darknessFromBortle(0) = 1.125, which would outrank every real site.
    const bad = site({ darkness: { factor: 1.125, bortleClass: 1 } });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });

  it('rejects an impossible cloud percentage', () => {
    const bad = site({
      clarity: {
        factor: 0.5,
        cloudCoverPercent: 140,
        forecastTime: '2026-07-27T20:00:00.000Z',
        available: true,
      },
    });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });

  it('rejects a naive, non-UTC forecast timestamp', () => {
    const bad = site({
      clarity: {
        factor: 0.5,
        cloudCoverPercent: 20,
        forecastTime: '2026-07-27T20:00',
        available: true,
      },
    });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });

  it('rejects an out-of-range coordinate', () => {
    expect(
      BestSpotPayloadSchema.safeParse(payload({ sites: [site({ latDeg: 91 })] })).success,
    ).toBe(false);
  });

  it('rejects a bearing of 360 (must wrap to 0)', () => {
    const bad = site({
      travel: { factor: 0.6, distanceKm: 25, bearingDeg: 360, compass: 'N', travelMinutes: null },
    });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });

  it("rejects status 'ok' with an empty site list", () => {
    const result = BestSpotPayloadSchema.safeParse(payload({ status: 'ok', sites: [] }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('at least one scored site');
  });

  it('rejects ranks that do not run 1..n in array order', () => {
    const result = BestSpotPayloadSchema.safeParse(
      payload({ sites: [site({ rank: 2, score: 0.4 }), site({ id: 'b', rank: 1, score: 0.3 })] }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('sorted best-first');
  });

  it('rejects a list that is not ordered by descending score', () => {
    const result = BestSpotPayloadSchema.safeParse(
      payload({
        sites: [site({ rank: 1, score: 0.2 }), site({ id: 'b', rank: 2, score: 0.9 })],
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('descending score');
  });

  it('rejects an unknown ranking basis', () => {
    const result = BestSpotPayloadSchema.safeParse(
      payload({
        ranking: {
          basis: 'vibes',
          clarityAvailable: true,
          auroraApplied: false,
          note: null,
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an aurora factor outside [0,1]', () => {
    const bad = site({ aurora: { factor: 3, strengthDeg: 12, visible: true, kp: 7 } });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });

  it('rejects a Kp outside the 0-9 scale', () => {
    const bad = site({ aurora: { factor: 0.5, strengthDeg: 12, visible: true, kp: 11 } });
    expect(BestSpotPayloadSchema.safeParse(payload({ sites: [bad] })).success).toBe(false);
  });
});
