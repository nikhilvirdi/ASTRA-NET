/**
 * Phase 3 Definition of Done, verified at the orchestration level
 * (WORKPLAN.md): "Poller runs continuously, /stream emits live fast-tier
 * data with correct freshness tags, and killing one source leaves the rest
 * healthy." The per-loop unit tests (`fast-tier.test.ts`, `slow-tier.test.ts`)
 * already prove degradation within a single tier; this file proves it holds
 * with *both* loops actually running together and served over real HTTP
 * through `createApp()`, not just asserted against the in-memory store
 * directly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import type { HealthPayload } from '../routes/health.js';
import type { FastTierStreamPayload } from '../routes/stream.js';
import {
  startFastTierLoop,
  FAST_TIER_INTERVAL_MS,
  type FastTierClients,
} from '../poller/fast-tier.js';
import {
  startSlowTierLoop,
  SLOW_TIER_INTERVAL_MS,
  type SlowTierClients,
} from '../poller/slow-tier.js';
import { getSourceState, resetStore } from '../poller/store.js';
import type { N2yoPositionsData } from '../clients/n2yo/index.js';
import type { NasaDonkiData, NasaNeowsData } from '../clients/nasa/index.js';
import type { HorizonsData, HorizonsRaDecData } from '../clients/jpl-horizons/index.js';
import type { SwpcSlowData } from '../clients/swpc/index.js';
import type { CelestrakTleData } from '../clients/celestrak/index.js';

// Never connects: this file exercises routes that don't touch the DB,
// and Prisma only opens a connection on first query.
const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');

const issSuccess: N2yoPositionsData = {
  satId: 25544,
  satName: 'ISS (ZARYA)',
  positions: [
    {
      latitude: 1,
      longitude: 2,
      altitude: 420,
      azimuth: 0,
      elevation: 0,
      ra: 0,
      dec: 0,
      timestamp: 1,
      eclipsed: false,
    },
  ],
  fetchedAt: 't',
};

const donkiSuccess: NasaDonkiData = { cmes: [], flares: [], fetchedAt: 't' };
const neowsSuccess: NasaNeowsData = { elementCount: 0, objects: [], fetchedAt: 't' };
const horizonsSuccess: HorizonsData = { ephemerisLines: ['line'], fetchedAt: 't' };
const horizonsJupiterSuccess: HorizonsRaDecData = {
  entries: [{ timestampUtcMs: 1, raDeg: 129.4, decDeg: 18.1 }],
  fetchedAt: 't',
};
const swpcSlowSuccess: SwpcSlowData = {
  kpObserved: [{ timeTag: 't', kp: 3, aRunning: 12, stationCount: 8 }],
  kpForecast: null,
  solarWind: null,
  fetchedAt: 't',
};
const satellitesSuccess: CelestrakTleData = {
  records: [
    {
      name: 'ISS (ZARYA)',
      noradCatId: 25544,
      line1: '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
      line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
    },
  ],
  fetchedAt: 't',
};

function makeFastClients(overrides: Partial<FastTierClients> = {}): FastTierClients {
  return {
    fetchN2yoPositions: vi.fn().mockResolvedValue(issSuccess),
    fetchSwpcFast: vi.fn().mockRejectedValue(new Error('SWPC down')),
    n2yoApiKey: 'TEST_KEY',
    ...overrides,
  };
}

function makeSlowClients(overrides: Partial<SlowTierClients> = {}): SlowTierClients {
  return {
    fetchNasaDonki: vi.fn().mockResolvedValue(donkiSuccess),
    fetchNasaNeows: vi.fn().mockResolvedValue(neowsSuccess),
    fetchHorizons: vi.fn().mockResolvedValue(horizonsSuccess),
    fetchHorizonsRaDec: vi.fn().mockResolvedValue(horizonsJupiterSuccess),
    fetchSwpcSlow: vi.fn().mockResolvedValue(swpcSlowSuccess),
    fetchCelestrakTle: vi.fn().mockResolvedValue(satellitesSuccess),
    nasaApiKey: 'TEST_KEY',
    ...overrides,
  };
}

describe('Phase 3 orchestration: both loops running together, served over real HTTP', () => {
  let server: http.Server;
  let stopFast: (() => void) | undefined;
  let stopSlow: (() => void) | undefined;

  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    stopFast?.();
    stopSlow?.();
    stopFast = undefined;
    stopSlow = undefined;
    vi.useRealTimers();
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('one source failing (SWPC) leaves every other source healthy in both /health and /stream', async () => {
    stopFast = startFastTierLoop(makeFastClients());
    stopSlow = startSlowTierLoop(makeSlowClients());
    await vi.advanceTimersByTimeAsync(0);

    // Real socket I/O needs the real event loop from here on.
    vi.useRealTimers();

    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const healthRes = await request(server).get('/health');
    const health = healthRes.body as HealthPayload;

    expect(health.sources.solarWind.healthy).toBe(false);
    expect(health.sources.iss.healthy).toBe(true);
    expect(health.sources.donki.healthy).toBe(true);
    expect(health.sources.neows.healthy).toBe(true);
    expect(health.sources.gibs.healthy).toBe(true);
    expect(health.sources.horizons.healthy).toBe(true);
    expect(health.sources.horizonsJupiter.healthy).toBe(true);
    expect(health.sources.horizonsVenus.healthy).toBe(true);
    expect(health.sources.horizonsMars.healthy).toBe(true);
    expect(health.sources.horizonsSaturn.healthy).toBe(true);
    expect(health.sources.horizonsMercury.healthy).toBe(true);
    expect(health.sources.spaceWeatherForecast.healthy).toBe(true);
    expect(health.sources.satellites.healthy).toBe(true);

    const streamChunk = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://localhost:${String(port)}/stream`, (res) => {
        res.on('data', (data: Buffer) => {
          resolve(data.toString());
          req.destroy();
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
    const streamed = JSON.parse(streamChunk.slice('data: '.length).trim()) as FastTierStreamPayload;

    expect(streamed.solarWind.healthy).toBe(false);
    expect(streamed.iss.healthy).toBe(true);
    expect(streamed).not.toHaveProperty('donki');
  });

  it("the fast and slow tiers run on distinct, correctly-ordered intervals within ARCHITECTURE.md §4's documented windows", () => {
    expect(FAST_TIER_INTERVAL_MS).toBeGreaterThanOrEqual(30_000);
    expect(FAST_TIER_INTERVAL_MS).toBeLessThanOrEqual(60_000);
    expect(SLOW_TIER_INTERVAL_MS).toBeGreaterThanOrEqual(5 * 60_000);
    expect(SLOW_TIER_INTERVAL_MS).toBeLessThanOrEqual(15 * 60_000);
    // A slow source can never end up polling at the fast tier's cadence or faster.
    expect(SLOW_TIER_INTERVAL_MS).toBeGreaterThan(FAST_TIER_INTERVAL_MS);
  });

  it('starting the slow-tier loop alone never writes fast-tier keys, and vice versa', async () => {
    stopSlow = startSlowTierLoop(makeSlowClients());
    await vi.advanceTimersByTimeAsync(0);

    expect(getSourceState('iss')).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(getSourceState('solarWind')).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(getSourceState('donki').healthy).toBe(true);
    expect(getSourceState('spaceWeatherForecast').healthy).toBe(true);
    expect(getSourceState('satellites').healthy).toBe(true);

    stopFast = startFastTierLoop(makeFastClients());
    await vi.advanceTimersByTimeAsync(0);

    // Slow-tier sources are untouched by the fast-tier loop starting/ticking.
    expect(getSourceState('donki').healthy).toBe(true);
    expect(getSourceState('neows').healthy).toBe(true);
    expect(getSourceState('gibs').healthy).toBe(true);
    expect(getSourceState('horizons').healthy).toBe(true);
    expect(getSourceState('horizonsJupiter').healthy).toBe(true);
    expect(getSourceState('horizonsVenus').healthy).toBe(true);
    expect(getSourceState('horizonsMars').healthy).toBe(true);
    expect(getSourceState('horizonsSaturn').healthy).toBe(true);
    expect(getSourceState('horizonsMercury').healthy).toBe(true);
    expect(getSourceState('spaceWeatherForecast').healthy).toBe(true);
    expect(getSourceState('satellites').healthy).toBe(true);
    expect(getSourceState('iss').healthy).toBe(true);
  });

  it('the fast-tier loop never fetches SWPC slow-tier products, and the slow-tier loop never fetches SWPC fast-tier products (no tier promotion)', async () => {
    const fastClients = makeFastClients();
    const slowClients = makeSlowClients();

    stopFast = startFastTierLoop(fastClients);
    stopSlow = startSlowTierLoop(slowClients);
    await vi.advanceTimersByTimeAsync(0);

    expect(fastClients.fetchSwpcFast).toHaveBeenCalled();
    expect(slowClients.fetchSwpcSlow).toHaveBeenCalled();
    // Neither loop's client set even exposes the other tier's SWPC fetcher —
    // this assertion documents the contract at the object-shape level too.
    expect(fastClients).not.toHaveProperty('fetchSwpcSlow');
    expect(slowClients).not.toHaveProperty('fetchSwpcFast');
  });
});
