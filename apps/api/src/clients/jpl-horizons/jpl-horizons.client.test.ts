import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHorizons } from './jpl-horizons.client.js';
import { HorizonsResponseSchema } from './jpl-horizons.schemas.js';

import fixture from './__fixtures__/jpl_horizons.json';

const NOW = new Date('2026-07-14T20:00:00.000Z');

describe('JPL Horizons schema', () => {
  it('validates the raw fixture', () => {
    const result = HorizonsResponseSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });
});

describe('fetchHorizons', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses successful response and extracts SOE-EOE lines', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 })),
    );

    const params = {
      command: '499',
      startTime: '2026-07-14',
      stopTime: '2026-07-15',
    };

    const data = await fetchHorizons(params, NOW);

    expect(data.ephemerisLines).not.toBeNull();
    expect(data.ephemerisLines?.length).toBe(2);
    expect(data.ephemerisLines?.[0]).toContain('2026-Jul-14');
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('returns null on missing SOE/EOE markers', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ result: 'No markers here' }), { status: 200 })),
    );

    const data = await fetchHorizons({ command: '499', startTime: '2026', stopTime: '2026' }, NOW);

    expect(data.ephemerisLines).toBeNull();
  });

  it('returns fallback on network error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Error', { status: 503 })));

    const data = await fetchHorizons({ command: '499', startTime: '2026', stopTime: '2026' }, NOW);

    expect(data.ephemerisLines).toBeNull();
  });
});
