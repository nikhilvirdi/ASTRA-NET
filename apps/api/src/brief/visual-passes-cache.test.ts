/**
 * The N2YO `visualpasses` TTL cache (WORKPLAN.md Phase 12).
 *
 * Real Postgres rather than a mocked Prisma: the whole point of this module
 * is that a *second* request finds what the first one wrote, and expiry is
 * enforced by the store's own read path. A mock would be asserting the test
 * author's model of the cache rather than the cache.
 *
 * These tests count upstream calls, because the number of times N2YO is hit
 * is the entire reason the module exists.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import {
  VISUAL_PASSES_CACHE_TTL_MS,
  fetchVisualPassesCached,
  visualPassesCacheKey,
  type VisualPassesCacheParams,
} from './visual-passes-cache.js';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
    } catch {
      // No .env — the explicit check below produces the real error.
    }
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set and no repo-root .env was found — start the docker compose Postgres and set it before running these tests.',
    );
  }
  return url;
}

const prisma = createPrismaClient(loadDatabaseUrl());
const NOW = new Date('2026-07-17T21:40:00.000Z');
const KEY_PREFIX = 'n2yo:visualpasses:v1';

const LONDON: VisualPassesCacheParams = {
  satId: 25544,
  observerLat: 51.5072,
  observerLng: -0.1276,
  observerAlt: 0,
  days: 2,
  minVisibility: 300,
};

function passes(satName = 'ISS (ZARYA)'): N2yoVisualPassesData {
  return {
    satId: 25544,
    satName,
    passes: [
      {
        startAzimuth: 218,
        startAzimuthCompass: 'SW',
        startElevation: 10,
        startUtc: 1_784_000_000,
        maxAzimuth: 142,
        maxAzimuthCompass: 'SE',
        maxElevation: 68.4,
        maxUtc: 1_784_000_180,
        endAzimuth: 71,
        endAzimuthCompass: 'ENE',
        endElevation: 10,
        endUtc: 1_784_000_360,
        magnitude: -3.2,
        duration: 360,
      },
    ],
    fetchedAt: NOW.toISOString(),
  };
}

/** A failed upstream fetch, as the real client reports one. */
function failure(): N2yoVisualPassesData {
  return { satId: 25544, satName: 'Unknown', passes: null, fetchedAt: NOW.toISOString() };
}

function depsWith(fetchImpl: () => Promise<N2yoVisualPassesData>) {
  const fetchN2yoVisualPasses = vi.fn(fetchImpl);
  return {
    deps: { prisma, n2yoApiKey: 'TEST_KEY', fetchN2yoVisualPasses },
    fetchN2yoVisualPasses,
  };
}

async function clearCache(): Promise<void> {
  await prisma.cache.deleteMany({ where: { key: { startsWith: KEY_PREFIX } } });
}

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await clearCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await clearCache();
  await prisma.$disconnect();
});

describe('visualPassesCacheKey', () => {
  it('follows SCHEMA.md’s "source + query signature" shape', () => {
    expect(visualPassesCacheKey(LONDON)).toBe(`${KEY_PREFIX}:25544:51.5072:-0.1276:0:2:300`);
  });

  it('is observer-specific — two positions never share a row', () => {
    const elsewhere = { ...LONDON, observerLat: 40.7128, observerLng: -74.006 };
    expect(visualPassesCacheKey(elsewhere)).not.toBe(visualPassesCacheKey(LONDON));
  });

  it('normalises coordinate formatting so one position yields one key', () => {
    // `51.5` and `51.5000` are the same place; without fixed formatting they
    // would be two rows for it.
    const a = visualPassesCacheKey({ ...LONDON, observerLat: 51.5, observerLng: -0.1 });
    const b = visualPassesCacheKey({ ...LONDON, observerLat: 51.5, observerLng: -0.1 });
    expect(a).toBe(b);
    expect(a).toContain(':51.5000:-0.1000:');
  });

  it('keeps positions ~11 m apart distinct — this normalises, it does not round', () => {
    const a = visualPassesCacheKey({ ...LONDON, observerLat: 51.5072 });
    const b = visualPassesCacheKey({ ...LONDON, observerLat: 51.5073 });
    expect(a).not.toBe(b);
  });

  it('includes every parameter that changes the upstream response', () => {
    for (const override of [
      { satId: 20580 },
      { observerAlt: 300 },
      { days: 5 },
      { minVisibility: 60 },
    ]) {
      expect(visualPassesCacheKey({ ...LONDON, ...override })).not.toBe(
        visualPassesCacheKey(LONDON),
      );
    }
  });
});

describe('fetchVisualPassesCached', () => {
  it('calls N2YO once and serves every later request from the cache', async () => {
    const { deps, fetchN2yoVisualPasses } = depsWith(() => Promise.resolve(passes()));

    const first = await fetchVisualPassesCached(deps, LONDON, NOW);
    const second = await fetchVisualPassesCached(deps, LONDON, NOW);
    const third = await fetchVisualPassesCached(deps, LONDON, NOW);

    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('round-trips the payload through JSONB intact', async () => {
    const { deps } = depsWith(() => Promise.resolve(passes()));
    const live = await fetchVisualPassesCached(deps, LONDON, NOW);
    const cached = await fetchVisualPassesCached(deps, LONDON, NOW);

    expect(cached.satName).toBe(live.satName);
    expect(cached.passes?.[0]?.maxElevation).toBe(68.4);
    expect(cached.passes?.[0]?.startAzimuthCompass).toBe('SW');
  });

  it('does not let one observer read another observer’s passes', async () => {
    const { deps, fetchN2yoVisualPasses } = depsWith(() =>
      Promise.resolve(passes(`sat-${fetchN2yoVisualPasses.mock.calls.length}`)),
    );

    await fetchVisualPassesCached(deps, LONDON, NOW);
    const newYork = { ...LONDON, observerLat: 40.7128, observerLng: -74.006 };
    await fetchVisualPassesCached(deps, newYork, NOW);

    // Two positions, two upstream calls — the cache must not collapse them.
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(2);
  });

  it('refetches once the TTL has passed', async () => {
    const { deps, fetchN2yoVisualPasses } = depsWith(() => Promise.resolve(passes()));

    await fetchVisualPassesCached(deps, LONDON, NOW);
    const justInside = new Date(NOW.getTime() + VISUAL_PASSES_CACHE_TTL_MS - 1000);
    await fetchVisualPassesCached(deps, LONDON, justInside);
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(1);

    const past = new Date(NOW.getTime() + VISUAL_PASSES_CACHE_TTL_MS + 1000);
    await fetchVisualPassesCached(deps, LONDON, past);
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(2);
  });

  it('caps a single observer at 12 upstream calls an hour', async () => {
    // The number that matters against N2YO's 100/hr limit for this endpoint.
    const { deps, fetchN2yoVisualPasses } = depsWith(() => Promise.resolve(passes()));

    // One request a minute for an hour.
    for (let minute = 0; minute < 60; minute += 1) {
      await fetchVisualPassesCached(deps, LONDON, new Date(NOW.getTime() + minute * 60_000));
    }

    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(3600 / (VISUAL_PASSES_CACHE_TTL_MS / 1000));
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(12);
  });

  it('caches a failed fetch too, so an outage cannot burn the budget', async () => {
    // Uncached, a failing N2YO costs three attempts per page view and would
    // exhaust 100/hr in ~33 views. Caching the failure bounds it per TTL.
    const { deps, fetchN2yoVisualPasses } = depsWith(() => Promise.resolve(failure()));

    const first = await fetchVisualPassesCached(deps, LONDON, NOW);
    const second = await fetchVisualPassesCached(deps, LONDON, NOW);

    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(1);
    expect(first.passes).toBeNull();
    expect(second.passes).toBeNull();
  });

  it('recovers on the next request after the failure TTL lapses', async () => {
    let healthy = false;
    const { deps, fetchN2yoVisualPasses } = depsWith(() =>
      Promise.resolve(healthy ? passes() : failure()),
    );

    expect((await fetchVisualPassesCached(deps, LONDON, NOW)).passes).toBeNull();

    healthy = true;
    const afterTtl = new Date(NOW.getTime() + VISUAL_PASSES_CACHE_TTL_MS + 1000);
    expect((await fetchVisualPassesCached(deps, LONDON, afterTtl)).passes).not.toBeNull();
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(2);
  });

  it('serves the live result when the cache read throws', async () => {
    // A cache is an optimisation; one that can take down the page it
    // optimises is a liability.
    const { deps, fetchN2yoVisualPasses } = depsWith(() => Promise.resolve(passes()));
    const broken = {
      ...deps,
      prisma: {
        cache: {
          findUnique: () => Promise.reject(new Error('db down')),
          upsert: () => Promise.resolve(),
        },
      } as unknown as typeof prisma,
    };

    const result = await fetchVisualPassesCached(broken, LONDON, NOW);
    expect(result.passes).not.toBeNull();
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(1);
  });

  it('serves the live result when the cache write throws', async () => {
    const { deps, fetchN2yoVisualPasses } = depsWith(() => Promise.resolve(passes()));
    const broken = {
      ...deps,
      prisma: {
        cache: {
          findUnique: () => Promise.resolve(null),
          upsert: () => Promise.reject(new Error('db full')),
        },
      } as unknown as typeof prisma,
    };

    const result = await fetchVisualPassesCached(broken, LONDON, NOW);
    expect(result.passes).not.toBeNull();
    expect(fetchN2yoVisualPasses).toHaveBeenCalledTimes(1);
  });

  it('writes a row whose expiry is exactly one TTL out', async () => {
    const { deps } = depsWith(() => Promise.resolve(passes()));
    await fetchVisualPassesCached(deps, LONDON, NOW);

    const row = await prisma.cache.findUnique({ where: { key: visualPassesCacheKey(LONDON) } });
    expect(row).not.toBeNull();
    expect(row?.expiresAt.getTime()).toBe(NOW.getTime() + VISUAL_PASSES_CACHE_TTL_MS);
  });
});
