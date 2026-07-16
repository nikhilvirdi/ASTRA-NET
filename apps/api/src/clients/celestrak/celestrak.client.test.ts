import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCelestrakOmm, CELESTRAK_FALLBACK } from './celestrak.client.js';
import { CelestrakOmmResponseSchema } from './celestrak.schemas.js';
import fixture from './__fixtures__/celestrak_omm.json';

const NOW = new Date('2026-07-14T20:00:00.000Z');

describe('CelestrakOmmResponseSchema', () => {
  it('validates the real fixture cleanly', () => {
    const result = CelestrakOmmResponseSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('extracts NORAD_CAT_ID correctly', () => {
    const result = CelestrakOmmResponseSchema.safeParse(fixture);
    if (!result.success) throw new Error('parse failed');
    expect(result.data[0].NORAD_CAT_ID).toBe(25544);
    expect(result.data[0].OBJECT_NAME).toBe('ISS (ZARYA)');
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
    expect(data.records?.[0].noradCatId).toBe(25544);
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
