import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchHorizons,
  fetchHorizonsRaDec,
  parseEphemerisRaDecLines,
} from './jpl-horizons.client.js';
import { HorizonsResponseSchema } from './jpl-horizons.schemas.js';

import fixture from './__fixtures__/jpl_horizons.json';
import jupiterCsvFixture from './__fixtures__/jpl_horizons_jupiter_csv.json';

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

describe('parseEphemerisRaDecLines', () => {
  it('parses CSV OBSERVER rows into validated degree entries', () => {
    const entries = parseEphemerisRaDecLines([
      '2026-Jul-23 00:00,*,m,   129.42611,  18.09309,',
      '2026-Jul-23 01:00,,,   129.43450,  18.09062,',
    ]);

    expect(entries).toEqual([
      {
        timestampUtcMs: Date.UTC(2026, 6, 23, 0, 0),
        raDeg: 129.42611,
        decDeg: 18.09309,
      },
      {
        timestampUtcMs: Date.UTC(2026, 6, 23, 1, 0),
        raDeg: 129.4345,
        decDeg: 18.09062,
      },
    ]);
  });

  it('skips rows that fail validation but keeps the valid ones', () => {
    const entries = parseEphemerisRaDecLines([
      'not an ephemeris row at all',
      '2026-Jul-23 00:00,*,m,   999.0,  18.0,', // RA out of range
      '2026-Jul-23 01:00,*,m,   129.4,  95.0,', // Dec out of range
      '2026-Jul-23 02:00,*,m,   129.4,  18.0,',
    ]);

    expect(entries).toEqual([
      { timestampUtcMs: Date.UTC(2026, 6, 23, 2, 0), raDeg: 129.4, decDeg: 18.0 },
    ]);
  });

  it('returns null when no row survives validation', () => {
    expect(parseEphemerisRaDecLines(['garbage', '2026-Xyz-23 00:00,,,1,2,'])).toBeNull();
    expect(parseEphemerisRaDecLines([])).toBeNull();
  });
});

describe('fetchHorizonsRaDec', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches, parses, and validates a CSV RA/Dec ephemeris', async () => {
    const fetchMock = vi.fn((_input: string | URL) =>
      Promise.resolve(new Response(JSON.stringify(jupiterCsvFixture), { status: 200 })),
    );
    global.fetch = fetchMock;

    const data = await fetchHorizonsRaDec(
      { command: '599', startTime: '2026-07-23', stopTime: '2026-07-24', stepSize: '1 h' },
      NOW,
    );

    expect(data.entries).toHaveLength(3);
    expect(data.entries?.[0]).toEqual({
      timestampUtcMs: Date.UTC(2026, 6, 23, 0, 0),
      raDeg: 129.42611,
      decDeg: 18.09309,
    });
    expect(data.fetchedAt).toBe(NOW.toISOString());

    // The query must pin the exact table shape the parser understands.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('QUANTITIES=%271%27');
    expect(url).toContain('ANG_FORMAT=%27DEG%27');
    expect(url).toContain('CSV_FORMAT=%27YES%27');
    expect(url).toContain('EPHEM_TYPE=%27OBSERVER%27');
  });

  it('returns null entries when the underlying fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Error', { status: 503 })));

    const data = await fetchHorizonsRaDec(
      { command: '599', startTime: '2026-07-23', stopTime: '2026-07-24' },
      NOW,
    );

    expect(data.entries).toBeNull();
  });
});
