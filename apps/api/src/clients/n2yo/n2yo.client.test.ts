import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchN2yoPositions, fetchN2yoVisualPasses } from './n2yo.client.js';
import { N2yoPositionsResponseSchema, N2yoVisualPassesResponseSchema } from './n2yo.schemas.js';

import positionsFixture from './__fixtures__/n2yo_positions.json';
import passesFixture from './__fixtures__/n2yo_visualpasses.json';

const NOW = new Date('2026-07-14T20:00:00.000Z');
const API_KEY = 'TEST_KEY';

describe('N2yo schemas', () => {
  it('validates positions fixture', () => {
    const result = N2yoPositionsResponseSchema.safeParse(positionsFixture);
    expect(result.success).toBe(true);
  });

  it('validates passes fixture', () => {
    const result = N2yoVisualPassesResponseSchema.safeParse(passesFixture);
    expect(result.success).toBe(true);
  });
});

describe('fetchN2yoPositions', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses successful positions correctly', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(positionsFixture), { status: 200 })),
    );

    const params = { satId: 25544, observerLat: 0, observerLng: 0, observerAlt: 0, seconds: 1 };
    const data = await fetchN2yoPositions(params, API_KEY, NOW);

    expect(data.positions).not.toBeNull();
    expect(data.positions![0]!.latitude).toBeCloseTo(49.21);
    expect(data.satId).toBe(25544);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('returns null positions on network failure', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Error', { status: 503 })));

    const params = { satId: 25544, observerLat: 0, observerLng: 0, observerAlt: 0, seconds: 1 };
    const data = await fetchN2yoPositions(params, API_KEY, NOW);

    expect(data.positions).toBeNull();
  });
});

describe('fetchN2yoVisualPasses', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses successful passes correctly', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(passesFixture), { status: 200 })),
    );

    const params = {
      satId: 25544,
      observerLat: 40.7,
      observerLng: -74,
      observerAlt: 0,
      days: 2,
      minVisibility: 300,
    };
    const data = await fetchN2yoVisualPasses(params, API_KEY, NOW);

    expect(data.passes).not.toBeNull();
    expect(data.passes?.length).toBe(2);
    expect(data.passes![0]!.startAzimuthCompass).toBe('WNW');
  });

  it('returns empty array when passescount is 0', async () => {
    const noPassesFixture = {
      info: { satname: 'ISS', satid: 25544, transactionscount: 0, passescount: 0 },
    };
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(noPassesFixture), { status: 200 })),
    );

    const params = {
      satId: 25544,
      observerLat: 40.7,
      observerLng: -74,
      observerAlt: 0,
      days: 2,
      minVisibility: 300,
    };
    const data = await fetchN2yoVisualPasses(params, API_KEY, NOW);

    expect(data.passes).not.toBeNull();
    expect(data.passes).toEqual([]);
  });
});
