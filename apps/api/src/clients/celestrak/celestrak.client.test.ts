import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCelestrakOmm,
  fetchCelestrakTle,
  CELESTRAK_FALLBACK,
  CELESTRAK_TLE_FALLBACK,
} from './celestrak.client.js';
import { CelestrakOmmResponseSchema } from './celestrak.schemas.js';
import fixture from './__fixtures__/celestrak_omm.json';

const NOW = new Date('2026-07-14T20:00:00.000Z');

const tleFixture = readFileSync(
  fileURLToPath(new URL('./__fixtures__/celestrak_visual.tle', import.meta.url)),
  'utf8',
);

describe('CelestrakOmmResponseSchema', () => {
  it('validates the real fixture cleanly', () => {
    const result = CelestrakOmmResponseSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('extracts NORAD_CAT_ID correctly', () => {
    const result = CelestrakOmmResponseSchema.safeParse(fixture);
    if (!result.success) throw new Error('parse failed');
    expect(result.data[0]!.NORAD_CAT_ID).toBe(25544);
    expect(result.data[0]!.OBJECT_NAME).toBe('ISS (ZARYA)');
  });
});

describe('fetchCelestrakOmm', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requires catnr or group', async () => {
    const data = await fetchCelestrakOmm({}, NOW);
    expect(data.records).toBeNull();
  });

  it('parses valid response correctly', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 })),
    );

    const data = await fetchCelestrakOmm({ catnr: 25544 }, NOW);
    expect(data.records).not.toBeNull();
    expect(data.records![0]!.noradCatId).toBe(25544);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('returns null records on 5xx', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Error', { status: 503 })));
    const data = await fetchCelestrakOmm({ catnr: 25544 }, NOW);
    expect(data.records).toBeNull();
  });

  it('returns null records on malformed JSON', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([{ invalid: 'shape' }]), { status: 200 })),
    );
    const data = await fetchCelestrakOmm({ catnr: 25544 }, NOW);
    expect(data.records).toBeNull();
  });
});

describe('CELESTRAK_FALLBACK', () => {
  it('has correct fallback zero-values', () => {
    expect(CELESTRAK_FALLBACK.records).toBeNull();
    expect(CELESTRAK_FALLBACK.fetchedAt).toBe(new Date(0).toISOString());
  });
});

describe('fetchCelestrakTle', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requires catnr or group', async () => {
    const data = await fetchCelestrakTle({}, NOW);
    expect(data.records).toBeNull();
  });

  it('parses a real two-satellite TLE text response correctly', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(tleFixture, { status: 200 })));

    const data = await fetchCelestrakTle({ group: 'visual' }, NOW);

    expect(data.records).not.toBeNull();
    expect(data.records).toHaveLength(2);
    expect(data.records![0]).toEqual({
      name: 'ISS (ZARYA)',
      noradCatId: 25544,
      line1: '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
      line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
    });
    expect(data.records![1]!.noradCatId).toBe(900);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('requests FORMAT=tle with the given group', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(tleFixture, { status: 200 })));

    await fetchCelestrakTle({ group: 'visual' }, NOW);

    const calledUrl = new URL(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string,
    );
    expect(calledUrl.searchParams.get('FORMAT')).toBe('tle');
    expect(calledUrl.searchParams.get('GROUP')).toBe('visual');
  });

  it('returns null records on 5xx', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Error', { status: 503 })));
    const data = await fetchCelestrakTle({ group: 'visual' }, NOW);
    expect(data.records).toBeNull();
  });

  it('returns null records when the line count is not a multiple of three', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response('ISS (ZARYA)\n1 25544U junk\n', { status: 200 })),
    );
    const data = await fetchCelestrakTle({ group: 'visual' }, NOW);
    expect(data.records).toBeNull();
  });

  it('returns null records when line1/line2 catalog numbers disagree', async () => {
    const corrupted = tleFixture.replace('1 25544U', '1 00001U');
    global.fetch = vi.fn(() => Promise.resolve(new Response(corrupted, { status: 200 })));
    const data = await fetchCelestrakTle({ group: 'visual' }, NOW);
    expect(data.records).toBeNull();
  });
});

describe('CELESTRAK_TLE_FALLBACK', () => {
  it('has correct fallback zero-values', () => {
    expect(CELESTRAK_TLE_FALLBACK.records).toBeNull();
    expect(CELESTRAK_TLE_FALLBACK.fetchedAt).toBe(new Date(0).toISOString());
  });
});
