/**
 * NOAA SWPC client tests.
 *
 * Tests run against real recorded fixtures (never the live network).
 * Fixture files are slices of actual API responses captured 2026-07-14.
 *
 * Coverage:
 * 1. Schema validation — each fixture passes Zod parsing cleanly.
 * 2. Data extraction — correct values are extracted from each response.
 * 3. Failure handling — malformed JSON / empty arrays / wrong shapes return null,
 *    not thrown errors.
 * 4. fetchSwpcFast()/fetchSwpcSlow() integration — with mocked fetch, verifies
 *    per-product isolation: one endpoint returning 5xx doesn't null out the others.
 * 5. Both always return their data type (never throw), even if all endpoints fail.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  KpOneMinuteResponseSchema,
  KpObservedResponseSchema,
  KpForecastResponseSchema,
  SolarWindRawResponseSchema,
  RtswWindResponseSchema,
} from './swpc.schemas.js';
import {
  fetchSwpcFast,
  fetchSwpcSlow,
  SWPC_FAST_FALLBACK,
  SWPC_SLOW_FALLBACK,
} from './swpc.client.js';
import type { SwpcFastData, SwpcSlowData } from './swpc.types.js';

// ---------------------------------------------------------------------------
// Fixtures (real recorded responses)
// ---------------------------------------------------------------------------

import kp1mFixture from './__fixtures__/kp_1m.json';
import kpObservedFixture from './__fixtures__/kp_observed.json';
import kpForecastFixture from './__fixtures__/kp_forecast.json';
import solarWindFixture from './__fixtures__/solar_wind.json';
import rtswFixture from './__fixtures__/rtsw_plasma.json';

// ---------------------------------------------------------------------------
// Schema-level unit tests
// ---------------------------------------------------------------------------

describe('KpOneMinuteResponseSchema', () => {
  it('validates the real fixture without error', () => {
    const result = KpOneMinuteResponseSchema.safeParse(kp1mFixture);
    expect(result.success).toBe(true);
  });

  it('extracts correct values from the last entry', () => {
    const result = KpOneMinuteResponseSchema.safeParse(kp1mFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const last = result.data[result.data.length - 1]!;
    expect(last.time_tag).toBe('2026-07-14T19:05:00');
    expect(last.kp_index).toBe(1);
    expect(last.estimated_kp).toBe(1.0);
    expect(last.kp).toBe('1Z');
  });

  it('parses kp_index=0 and estimated_kp=0.00 (quiet conditions)', () => {
    const result = KpOneMinuteResponseSchema.safeParse(kp1mFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const quietEntry = result.data.find((e) => e.kp_index === 0 && e.estimated_kp === 0.0);
    expect(quietEntry).toBeDefined();
    expect(quietEntry?.kp).toBe('0Z');
  });

  it('parses suffix M (minus) entries correctly', () => {
    const result = KpOneMinuteResponseSchema.safeParse(kp1mFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const mEntry = result.data.find((e) => e.kp.endsWith('M'));
    expect(mEntry).toBeDefined();
    expect(mEntry?.estimated_kp).toBeCloseTo(0.67);
  });

  it('rejects an entry with kp_index > 9', () => {
    const badFixture = [
      { time_tag: '2026-07-14T00:00:00', kp_index: 10, estimated_kp: 10, kp: '10Z' },
    ];
    const result = KpOneMinuteResponseSchema.safeParse(badFixture);
    expect(result.success).toBe(false);
  });

  it('rejects a non-array input', () => {
    const result = KpOneMinuteResponseSchema.safeParse({ not: 'an array' });
    expect(result.success).toBe(false);
  });

  it('returns empty array for an empty array input', () => {
    const result = KpOneMinuteResponseSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});

describe('KpObservedResponseSchema', () => {
  it('validates the real fixture without error', () => {
    const result = KpObservedResponseSchema.safeParse(kpObservedFixture);
    expect(result.success).toBe(true);
  });

  it('extracts Kp=4.67 (near G1-storm level) correctly', () => {
    const result = KpObservedResponseSchema.safeParse(kpObservedFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const stormEntry = result.data.find((e) => e.Kp === 4.67);
    expect(stormEntry).toBeDefined();
    expect(stormEntry?.a_running).toBe(39);
    expect(stormEntry?.station_count).toBe(8);
  });

  it('parses the minimum Kp=0.67 (quiet) entry', () => {
    const result = KpObservedResponseSchema.safeParse(kpObservedFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const quiet = result.data.find((e) => e.Kp < 1);
    expect(quiet).toBeDefined();
  });
});

describe('KpForecastResponseSchema', () => {
  it('validates the real fixture without error', () => {
    const result = KpForecastResponseSchema.safeParse(kpForecastFixture);
    expect(result.success).toBe(true);
  });

  it('parses all three observed status values', () => {
    const result = KpForecastResponseSchema.safeParse(kpForecastFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const statuses = new Set(result.data.map((e) => e.observed));
    expect(statuses).toContain('observed');
    expect(statuses).toContain('estimated');
    expect(statuses).toContain('predicted');
  });

  it('parses noaa_scale="G1" for Kp=4.67 correctly', () => {
    const result = KpForecastResponseSchema.safeParse(kpForecastFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const g1Entry = result.data.find((e) => e.noaa_scale === 'G1');
    expect(g1Entry).toBeDefined();
    expect(g1Entry?.kp).toBe(4.67);
  });

  it('accepts null noaa_scale for Kp below 5', () => {
    const result = KpForecastResponseSchema.safeParse(kpForecastFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const nullScaleEntry = result.data.find((e) => e.noaa_scale === null && e.kp < 5);
    expect(nullScaleEntry).toBeDefined();
  });

  it('rejects an invalid observed status value', () => {
    const bad = [{ time_tag: '2026-07-15T00:00:00', kp: 2, observed: 'guessed', noaa_scale: null }];
    const result = KpForecastResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('SolarWindRawResponseSchema (tuple array)', () => {
  it('validates the real fixture without error', () => {
    const result = SolarWindRawResponseSchema.safeParse(solarWindFixture);
    expect(result.success).toBe(true);
  });

  it('first row is the header array', () => {
    const result = SolarWindRawResponseSchema.safeParse(solarWindFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]![0]).toBe('time_tag');
    expect(result.data[0]![6]).toBe('bz');
  });

  it('data rows contain numeric Bz values (including negative)', () => {
    const result = SolarWindRawResponseSchema.safeParse(solarWindFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // rows after header
    const dataRows = result.data.slice(1);
    const hasSouthwardBz = dataRows.some((row) => typeof row[6] === 'number' && row[6] < 0);
    expect(hasSouthwardBz).toBe(true);
  });
});

describe('RtswWindResponseSchema', () => {
  it('validates the real fixture without error', () => {
    const result = RtswWindResponseSchema.safeParse(rtswFixture);
    expect(result.success).toBe(true);
  });

  it('finds the active=true entry (SOLAR1 source)', () => {
    const result = RtswWindResponseSchema.safeParse(rtswFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const active = result.data.find((e) => e.active === true);
    expect(active).toBeDefined();
    expect(active?.source).toBe('SOLAR1');
    expect(active?.proton_speed).toBeCloseTo(419.3);
  });

  it('tolerates null alpha fields in the same entry', () => {
    const result = RtswWindResponseSchema.safeParse(rtswFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.data[0];
    // alpha fields are nullable and not in the validated object (passthrough)
    expect((entry as Record<string, unknown>)['alpha_speed']).toBeNull();
  });

  it('rejects an entry missing the required proton_speed field', () => {
    const bad = [
      { time_tag: '2026-07-14T00:00:00', active: true, source: 'ACE', overall_quality: 0 },
    ];
    const result = RtswWindResponseSchema.safeParse(bad);
    // proton_speed is required (even if nullable), so absence should fail
    // RtswWindEntrySchema has proton_speed: z.number().nullable() — missing key fails
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchSwpcFast()/fetchSwpcSlow() integration tests (mocked fetch)
// ---------------------------------------------------------------------------

type FetchMock = ReturnType<typeof vi.fn>;

/** Build a fetch mock that maps URLs to fixture responses. */
function buildFetchMock(
  overrides: Partial<Record<keyof typeof ENDPOINTS_MAP, unknown>> = {},
): FetchMock {
  return vi.fn((url: string) => {
    const key = Object.keys(ENDPOINTS_MAP).find((k) =>
      url.includes(ENDPOINTS_MAP[k as keyof typeof ENDPOINTS_MAP].sentinel),
    );
    if (!key) return Promise.reject(new Error(`Unmapped URL in test: ${url}`));
    const override = overrides[key as keyof typeof ENDPOINTS_MAP];

    if (override === 'error') return Promise.reject(new Error('Network error'));
    if (override === 'server_error')
      return Promise.resolve(new Response('Service Unavailable', { status: 503 }));

    const body = override ?? ENDPOINTS_MAP[key as keyof typeof ENDPOINTS_MAP].fixture;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

const ENDPOINTS_MAP = {
  kpOneMin: { sentinel: 'planetary_k_index_1m', fixture: kp1mFixture },
  kpObserved: { sentinel: 'noaa-planetary-k-index.json', fixture: kpObservedFixture },
  kpForecast: { sentinel: 'noaa-planetary-k-index-forecast', fixture: kpForecastFixture },
  solarWind: { sentinel: 'propagated-solar-wind-1-hour', fixture: solarWindFixture },
  rtswPlasma: { sentinel: 'rtsw_wind_1m', fixture: rtswFixture },
} as const;

const NOW = new Date('2026-07-14T20:00:00.000Z');

describe('fetchSwpcFast()', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns both fields populated when both endpoints succeed', async () => {
    global.fetch = buildFetchMock() as unknown as typeof global.fetch;
    const data: SwpcFastData = await fetchSwpcFast(NOW);

    expect(data.kpCurrent).not.toBeNull();
    expect(data.rtswPlasma).not.toBeNull();
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('kpCurrent is the last entry from the 1-min feed', async () => {
    global.fetch = buildFetchMock() as unknown as typeof global.fetch;
    const data = await fetchSwpcFast(NOW);
    expect(data.kpCurrent?.timeTag).toBe('2026-07-14T19:05:00');
    expect(data.kpCurrent?.estimatedKp).toBe(1.0);
  });

  it('rtswPlasma picks the active=true entry', async () => {
    global.fetch = buildFetchMock() as unknown as typeof global.fetch;
    const data = await fetchSwpcFast(NOW);
    expect(data.rtswPlasma?.source).toBe('SOLAR1');
    expect(data.rtswPlasma?.protonSpeed).toBeCloseTo(419.3);
  });

  it('one failing endpoint nulls only that field — the other remains populated', async () => {
    global.fetch = buildFetchMock({ kpOneMin: 'server_error' }) as unknown as typeof global.fetch;
    const data = await fetchSwpcFast(NOW);

    expect(data.kpCurrent).toBeNull();
    expect(data.rtswPlasma).not.toBeNull();
  });

  it('both endpoints failing returns nulled SwpcFastData but does NOT throw', async () => {
    global.fetch = buildFetchMock({
      kpOneMin: 'error',
      rtswPlasma: 'error',
    }) as unknown as typeof global.fetch;

    let data: SwpcFastData | undefined;
    try {
      data = await fetchSwpcFast(NOW);
    } catch (e) {
      expect.fail('fetchSwpcFast should not throw when all endpoints fail');
    }

    expect(data?.kpCurrent).toBeNull();
    expect(data?.rtswPlasma).toBeNull();
    expect(data?.fetchedAt).toBe(NOW.toISOString());
  });
});

describe('fetchSwpcSlow()', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns all fields populated when all endpoints succeed', async () => {
    global.fetch = buildFetchMock() as unknown as typeof global.fetch;
    const data: SwpcSlowData = await fetchSwpcSlow(NOW);

    expect(data.kpObserved).not.toBeNull();
    expect(data.kpForecast).not.toBeNull();
    expect(data.solarWind).not.toBeNull();
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('kpForecast includes all three status types', async () => {
    global.fetch = buildFetchMock() as unknown as typeof global.fetch;
    const data = await fetchSwpcSlow(NOW);
    const statuses = new Set(data.kpForecast?.map((e) => e.status));
    expect(statuses).toContain('observed');
    expect(statuses).toContain('estimated');
    expect(statuses).toContain('predicted');
  });

  it('solarWind contains entries with negative Bz', async () => {
    global.fetch = buildFetchMock() as unknown as typeof global.fetch;
    const data = await fetchSwpcSlow(NOW);
    const hasSouthwardBz = data.solarWind?.some((e) => typeof e.bz === 'number' && e.bz < 0);
    expect(hasSouthwardBz).toBe(true);
  });

  it('solar wind failing nulls only solarWind — Kp fields remain', async () => {
    global.fetch = buildFetchMock({ solarWind: 'error' }) as unknown as typeof global.fetch;
    const data = await fetchSwpcSlow(NOW);

    expect(data.solarWind).toBeNull();
    expect(data.kpObserved).not.toBeNull();
    expect(data.kpForecast).not.toBeNull();
  });

  it('all endpoints failing returns nulled SwpcSlowData but does NOT throw', async () => {
    global.fetch = buildFetchMock({
      kpObserved: 'error',
      kpForecast: 'error',
      solarWind: 'error',
    }) as unknown as typeof global.fetch;

    let data: SwpcSlowData | undefined;
    try {
      data = await fetchSwpcSlow(NOW);
    } catch (e) {
      expect.fail('fetchSwpcSlow should not throw when all endpoints fail');
    }

    expect(data?.kpObserved).toBeNull();
    expect(data?.kpForecast).toBeNull();
    expect(data?.solarWind).toBeNull();
    expect(data?.fetchedAt).toBe(NOW.toISOString());
  });

  it('returns SwpcSlowData even when an endpoint returns malformed JSON-shaped data', async () => {
    // kpForecast returns an array of wrong-shaped objects
    const badForecast = [{ wrong: 'shape', no_kp_field: true }];
    global.fetch = buildFetchMock({ kpForecast: badForecast }) as unknown as typeof global.fetch;
    const data = await fetchSwpcSlow(NOW);

    expect(data.kpForecast).toBeNull(); // Zod parse fails → null
    expect(data.kpObserved).not.toBeNull(); // others unaffected
  });
});

// ---------------------------------------------------------------------------
// SWPC_FAST_FALLBACK / SWPC_SLOW_FALLBACK sanity checks
// ---------------------------------------------------------------------------

describe('SWPC_FAST_FALLBACK', () => {
  it('has all data fields null', () => {
    expect(SWPC_FAST_FALLBACK.kpCurrent).toBeNull();
    expect(SWPC_FAST_FALLBACK.rtswPlasma).toBeNull();
  });

  it('fetchedAt is the epoch (sentinel for "never fetched")', () => {
    expect(SWPC_FAST_FALLBACK.fetchedAt).toBe(new Date(0).toISOString());
  });
});

describe('SWPC_SLOW_FALLBACK', () => {
  it('has all data fields null', () => {
    expect(SWPC_SLOW_FALLBACK.kpObserved).toBeNull();
    expect(SWPC_SLOW_FALLBACK.kpForecast).toBeNull();
    expect(SWPC_SLOW_FALLBACK.solarWind).toBeNull();
  });

  it('fetchedAt is the epoch (sentinel for "never fetched")', () => {
    expect(SWPC_SLOW_FALLBACK.fetchedAt).toBe(new Date(0).toISOString());
  });
});
