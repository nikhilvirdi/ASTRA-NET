import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOpenMeteo } from './open-meteo.client.js';
import { OpenMeteoResponseSchema } from './open-meteo.schemas.js';

import fixture from './__fixtures__/open_meteo.json';

const NOW = new Date('2026-07-14T20:00:00.000Z');

describe('OpenMeteo schemas', () => {
  it('validates fixture', () => {
    const result = OpenMeteoResponseSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });
});

describe('fetchOpenMeteo', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses successful response', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    
    const params = { latitude: 40.71, longitude: -74.01 };
    const data = await fetchOpenMeteo(params, NOW);
    
    expect(data.hourly).not.toBeNull();
    expect(data.hourly?.length).toBe(3);
    expect(data.hourly?.[0].cloudCoverPercent).toBe(0);
    expect(data.hourly?.[0].visibilityMeters).toBe(37700);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('returns null hourly on network error', async () => {
    global.fetch = vi.fn(async () => new Response('Error', { status: 503 }));
    
    const params = { latitude: 40.71, longitude: -74.01 };
    const data = await fetchOpenMeteo(params, NOW);
    
    expect(data.hourly).toBeNull();
  });
});
