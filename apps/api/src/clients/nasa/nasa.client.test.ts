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

describe('fetchNasaDonki', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
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
});

describe('fetchNasaNeows', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
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
});
