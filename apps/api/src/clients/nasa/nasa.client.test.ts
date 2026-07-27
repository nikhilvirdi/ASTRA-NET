import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNasaDonki, fetchNasaNeows } from './nasa.client.js';
import {
  DonkiCmeResponseSchema,
  DonkiFlrResponseSchema,
  NeowsFeedResponseSchema,
} from './nasa.schemas.js';

import donkiCmeFixture from './__fixtures__/donki_cme.json';
import donkiFlrFixture from './__fixtures__/donki_flr.json';
import neowsFixture from './__fixtures__/neows_feed.json';

const NOW = new Date('2026-07-14T20:00:00.000Z');
const API_KEY = 'TEST_KEY';

describe('NASA schemas', () => {
  it('validates DONKI CME fixture', () => {
    const result = DonkiCmeResponseSchema.safeParse(donkiCmeFixture);
    expect(result.success).toBe(true);
  });

  it('validates DONKI FLR fixture', () => {
    const result = DonkiFlrResponseSchema.safeParse(donkiFlrFixture);
    expect(result.success).toBe(true);
  });

  it('validates NeoWs Feed fixture', () => {
    const result = NeowsFeedResponseSchema.safeParse(neowsFixture);
    expect(result.success).toBe(true);
  });
});

const NEOWS_PARAMS = { startDate: '2026-07-14', endDate: '2026-07-14' };

describe('fetchNasaDonki', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses successful CME/FLR responses', async () => {
    global.fetch = vi.fn((url: string | URL, _init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/CME'))
        return Promise.resolve(new Response(JSON.stringify(donkiCmeFixture), { status: 200 }));
      if (u.includes('/FLR'))
        return Promise.resolve(new Response(JSON.stringify(donkiFlrFixture), { status: 200 }));
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }) as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    expect(data.cmes).not.toBeNull();
    expect(data.flares).not.toBeNull();
    expect(data.cmes![0]!.activityId).toBe('2026-06-14T19:36:00-CME-001');
    expect(data.flares![0]!.flrId).toBe('2026-06-20T01:26:00-FLR-001');
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('handles partial failure (CME succeeds, FLR fails)', async () => {
    global.fetch = vi.fn((url: string | URL, _init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/CME'))
        return Promise.resolve(new Response(JSON.stringify(donkiCmeFixture), { status: 200 }));
      if (u.includes('/FLR')) return Promise.resolve(new Response('Error', { status: 500 }));
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }) as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    expect(data.cmes).not.toBeNull();
    expect(data.flares).toBeNull();
  });

  it('handles partial failure (FLR succeeds, CME fails)', async () => {
    global.fetch = vi.fn((url: string | URL, _init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/FLR'))
        return Promise.resolve(new Response(JSON.stringify(donkiFlrFixture), { status: 200 }));
      return Promise.resolve(new Response('Forbidden', { status: 403 }));
    }) as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    expect(data.cmes).toBeNull();
    expect(data.flares).not.toBeNull();
    expect(data.flares![0]!.flrId).toBe('2026-06-20T01:26:00-FLR-001');
  });

  it('returns the null/null fallback when both requests fail', async () => {
    // Rejecting with a non-Error also exercises the String(e) log path.
    global.fetch = vi.fn(() => Promise.reject('socket hang up')) as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    expect(data.cmes).toBeNull();
    expect(data.flares).toBeNull();
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('does not retry a 4xx response', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('Rate limited', { status: 429 })));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    // One attempt per endpoint (CME + FLR), no retries.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data.cmes).toBeNull();
    expect(data.flares).toBeNull();
  });

  it('forwards startDate/endDate to both DONKI endpoints', async () => {
    const fetchMock = vi.fn((url: string | URL, _init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/CME'))
        return Promise.resolve(new Response(JSON.stringify(donkiCmeFixture), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify(donkiFlrFixture), { status: 200 }));
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await fetchNasaDonki({ startDate: '2026-07-01', endDate: '2026-07-14' }, API_KEY, NOW);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    const cmeUrl = urls.find((u) => u.includes('/CME'));
    const flrUrl = urls.find((u) => u.includes('/FLR'));

    expect(cmeUrl).toContain('startDate=2026-07-01');
    expect(cmeUrl).toContain('endDate=2026-07-14');
    expect(flrUrl).toContain('startDate=2026-07-01');
    expect(flrUrl).toContain('endDate=2026-07-14');
  });

  it('defaults every optional CME/FLR field when DONKI omits it', async () => {
    const sparseCme = [
      // No cmeAnalyses at all — must normalise to an empty analyses array.
      { activityID: '2026-07-01T00:00:00-CME-001' },
      // Analysis present but entirely unmeasured.
      { activityID: '2026-07-02T00:00:00-CME-002', cmeAnalyses: [{}] },
    ];
    const sparseFlr = [{ flrID: '2026-07-01T00:00:00-FLR-001' }];

    global.fetch = vi.fn((url: string | URL, _init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/CME'))
        return Promise.resolve(new Response(JSON.stringify(sparseCme), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify(sparseFlr), { status: 200 }));
    }) as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    expect(data.cmes![0]).toEqual({
      activityId: '2026-07-01T00:00:00-CME-001',
      startTime: null,
      note: null,
      link: null,
      analyses: [],
    });
    expect(data.cmes![1]!.analyses[0]).toEqual({
      isMostAccurate: false,
      time21_5: null,
      latitude: null,
      longitude: null,
      halfAngle: null,
      speed: null,
      type: null,
    });
    expect(data.flares![0]).toEqual({
      flrId: '2026-07-01T00:00:00-FLR-001',
      beginTime: null,
      peakTime: null,
      endTime: null,
      classType: null,
      sourceLocation: null,
      link: null,
    });
  });

  it('leaves cmes/flares null when both payloads fail schema validation', async () => {
    // 200 OK, but DONKI returned an error object instead of the event array.
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'OVER_RATE_LIMIT' } }), {
          status: 200,
        }),
      ),
    ) as unknown as typeof global.fetch;

    const data = await fetchNasaDonki({}, API_KEY, NOW);

    expect(data.cmes).toBeNull();
    expect(data.flares).toBeNull();
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });
});

describe('fetchNasaNeows', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses successful feed response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(neowsFixture), { status: 200 })),
    ) as unknown as typeof global.fetch;

    const data = await fetchNasaNeows(
      { startDate: '2026-07-14', endDate: '2026-07-14' },
      API_KEY,
      NOW,
    );

    expect(data.objects).not.toBeNull();
    expect(data.objects?.length).toBe(1);
    expect(data.objects![0]!.id).toBe('3582056');
    expect(data.elementCount).toBe(1);
  });

  it('returns fallback on failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response('Error', { status: 503 })),
    ) as unknown as typeof global.fetch;

    const data = await fetchNasaNeows(
      { startDate: '2026-07-14', endDate: '2026-07-14' },
      API_KEY,
      NOW,
    );

    expect(data.objects).toBeNull();
    expect(data.elementCount).toBe(0);
  });

  it('returns fallback when a 200 payload fails schema validation', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'OVER_RATE_LIMIT' } }), { status: 200 }),
      ),
    ) as unknown as typeof global.fetch;

    const data = await fetchNasaNeows(NEOWS_PARAMS, API_KEY, NOW);

    expect(data.objects).toBeNull();
    expect(data.elementCount).toBe(0);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('flattens multiple date buckets and nulls a missing absolute magnitude', async () => {
    const neo = (id: string, name: string) => ({
      id,
      neo_reference_id: id,
      name,
      nasa_jpl_url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${id}`,
      // absolute_magnitude_h omitted — NeoWs drops it for some objects.
      estimated_diameter: {
        kilometers: { estimated_diameter_min: 0.01, estimated_diameter_max: 0.02 },
      },
      is_potentially_hazardous_asteroid: false,
      close_approach_data: [],
      is_sentry_object: false,
    });

    const feed = {
      element_count: 2,
      near_earth_objects: {
        '2026-07-14': [neo('111', '(2026 AA)')],
        '2026-07-15': [neo('222', '(2026 BB)')],
      },
    };

    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(feed), { status: 200 })),
    ) as unknown as typeof global.fetch;

    const data = await fetchNasaNeows(
      { startDate: '2026-07-14', endDate: '2026-07-15' },
      API_KEY,
      NOW,
    );

    expect(data.elementCount).toBe(2);
    expect(data.objects!.map((o) => o.id)).toEqual(['111', '222']);
    expect(data.objects![0]!.absoluteMagnitudeH).toBeNull();
    expect(data.objects![0]!.closeApproaches).toEqual([]);
  });
});
