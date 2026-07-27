import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOpenMeteo, fetchOpenMeteoBatch } from './open-meteo.client.js';
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
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 })),
    );

    const params = { latitude: 40.71, longitude: -74.01 };
    const data = await fetchOpenMeteo(params, NOW);

    expect(data.hourly).not.toBeNull();
    expect(data.hourly?.length).toBe(3);
    expect(data.hourly![0]!.cloudCoverPercent).toBe(0);
    expect(data.hourly![0]!.visibilityMeters).toBe(37700);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('pins naive Open-Meteo timestamps to UTC rather than the host timezone', async () => {
    // The API returns "2026-07-14T00:00" with no zone even for timezone=UTC;
    // `new Date()` would read that as local time and shift every hour.
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 })),
    );

    const data = await fetchOpenMeteo({ latitude: 40.71, longitude: -74.01 }, NOW);

    expect(data.hourly![0]!.time).toBe('2026-07-14T00:00:00.000Z');
    expect(data.hourly![2]!.time).toBe('2026-07-14T02:00:00.000Z');
  });

  it('returns null hourly on network error', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('Error', { status: 503 })));

    const params = { latitude: 40.71, longitude: -74.01 };
    const data = await fetchOpenMeteo(params, NOW);

    expect(data.hourly).toBeNull();
  });
});

describe('fetchOpenMeteoBatch', () => {
  let originalFetch: typeof global.fetch;

  const points = [
    { latitude: 32.73, longitude: 74.87 },
    { latitude: 32.9, longitude: 75.0 },
    { latitude: 33.1, longitude: 74.6 },
  ];

  /** Open-Meteo snaps requests to its model grid and echoes the snapped coordinate. */
  const snapped = (i: number) => ({ ...fixture, latitude: 90 + i, longitude: 90 + i });

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requests every point in one call with comma-separated coordinates', async () => {
    const fetchMock = vi.fn((_url: string | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(points.map((_, i) => snapped(i))), { status: 200 }),
      ),
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await fetchOpenMeteoBatch({ points }, NOW);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain('latitude=32.73%2C32.9%2C33.1');
    expect(url).toContain('longitude=74.87%2C75%2C74.6');
    expect(url).toContain('forecast_days=2');
  });

  it('returns one entry per point, in request order', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(points.map((_, i) => snapped(i))), { status: 200 }),
      ),
    ) as unknown as typeof global.fetch;

    const data = await fetchOpenMeteoBatch({ points }, NOW);

    expect(data).toHaveLength(3);
    expect(data.every((d) => d.hourly?.length === 3)).toBe(true);
    expect(data[0]!.fetchedAt).toBe(NOW.toISOString());
  });

  it('reports the REQUESTED coordinates, not the grid-snapped ones Open-Meteo echoes', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(points.map((_, i) => snapped(i))), { status: 200 }),
      ),
    ) as unknown as typeof global.fetch;

    const data = await fetchOpenMeteoBatch({ points }, NOW);

    // The stub echoes 90/91/92 — a site marker must not drift there.
    expect(data.map((d) => [d.latitude, d.longitude])).toEqual([
      [32.73, 74.87],
      [32.9, 75.0],
      [33.1, 74.6],
    ]);
  });

  it('accepts a bare object for a single-point batch', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 })),
    ) as unknown as typeof global.fetch;

    const data = await fetchOpenMeteoBatch({ points: [points[0]!] }, NOW);

    expect(data).toHaveLength(1);
    expect(data[0]!.hourly).not.toBeNull();
  });

  it('short-circuits an empty point list without calling fetch', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(fetchOpenMeteoBatch({ points: [] }, NOW)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades every point to null hourly on network failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response('Forbidden', { status: 403 })),
    ) as unknown as typeof global.fetch;

    const data = await fetchOpenMeteoBatch({ points }, NOW);

    expect(data).toHaveLength(3);
    expect(data.every((d) => d.hourly === null)).toBe(true);
    expect(data.map((d) => d.latitude)).toEqual([32.73, 32.9, 33.1]);
  });

  it('degrades when the response has fewer entries than points requested', async () => {
    // Silently zipping a short array to the candidate list would mis-attribute
    // one site's cloud cover to another.
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([snapped(0)]), { status: 200 })),
    ) as unknown as typeof global.fetch;

    const data = await fetchOpenMeteoBatch({ points }, NOW);

    expect(data).toHaveLength(3);
    expect(data.every((d) => d.hourly === null)).toBe(true);
  });

  it('degrades on a schema-invalid payload', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: true, reason: 'bad request' }), { status: 200 }),
      ),
    ) as unknown as typeof global.fetch;

    const data = await fetchOpenMeteoBatch({ points }, NOW);

    expect(data.every((d) => d.hourly === null)).toBe(true);
  });

  it('honours an explicit forecastDays', async () => {
    const fetchMock = vi.fn((_url: string | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(points.map((_, i) => snapped(i))), { status: 200 }),
      ),
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await fetchOpenMeteoBatch({ points, forecastDays: 5 }, NOW);

    expect(String(fetchMock.mock.calls[0]![0])).toContain('forecast_days=5');
  });
});
