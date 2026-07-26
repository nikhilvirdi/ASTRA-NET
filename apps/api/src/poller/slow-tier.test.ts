import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runSlowTierTick,
  startSlowTierLoop,
  SLOW_TIER_INTERVAL_MS,
  type SlowTierClients,
} from './slow-tier.js';
import { getSourceState, resetStore } from './store.js';
import type { NasaDonkiData, NasaNeowsData } from '../clients/nasa/index.js';
import type { HorizonsData, HorizonsRaDecData } from '../clients/jpl-horizons/index.js';
import type { SwpcSlowData } from '../clients/swpc/index.js';
import type { CelestrakTleData } from '../clients/celestrak/index.js';

const NOW = new Date('2026-07-16T12:00:00.000Z');
const NOW_ISO = NOW.toISOString();
const LATER = new Date('2026-07-16T12:10:00.000Z');

const donkiSuccess: NasaDonkiData = {
  cmes: [
    {
      activityId: '2026-07-15-CME-001',
      startTime: '2026-07-15T08:00Z',
      note: null,
      link: null,
      analyses: [],
    },
  ],
  flares: null,
  fetchedAt: NOW_ISO,
};

const donkiTotalFailure: NasaDonkiData = { cmes: null, flares: null, fetchedAt: NOW_ISO };

const neowsSuccess: NasaNeowsData = {
  elementCount: 1,
  objects: [
    {
      id: '2000433',
      name: '433 Eros',
      nasaJplUrl: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=433',
      absoluteMagnitudeH: 10.4,
      estimatedDiameterMinKm: 16.8,
      estimatedDiameterMaxKm: 37.6,
      isPotentiallyHazardous: false,
      isSentryObject: false,
      closeApproaches: [],
    },
  ],
  fetchedAt: NOW_ISO,
};

const neowsFailure: NasaNeowsData = { elementCount: 0, objects: null, fetchedAt: NOW_ISO };

const horizonsSuccess: HorizonsData = {
  ephemerisLines: ['2461234.500000000 = A.D. 2026-Jul-16 00:00:00.0000 TDB'],
  fetchedAt: NOW_ISO,
};

const horizonsFailure: HorizonsData = { ephemerisLines: null, fetchedAt: NOW_ISO };

const horizonsRaDecSuccess: HorizonsRaDecData = {
  entries: [{ timestampUtcMs: NOW.getTime(), raDeg: 129.4, decDeg: 18.1 }],
  fetchedAt: NOW_ISO,
};

const horizonsRaDecFailure: HorizonsRaDecData = { entries: null, fetchedAt: NOW_ISO };

/**
 * The five bodies fed by `fetchHorizonsRaDec`, one call per tick each —
 * command codes verified live against the real JPL Horizons API (see
 * DECISIONS.md), not assumed. Used to parametrize the per-body tests below
 * rather than five near-duplicate copies of the same test.
 */
const RA_DEC_BODIES = [
  { name: 'Jupiter', command: '599', key: 'horizonsJupiter' },
  { name: 'Venus', command: '299', key: 'horizonsVenus' },
  { name: 'Mars', command: '499', key: 'horizonsMars' },
  { name: 'Saturn', command: '699', key: 'horizonsSaturn' },
  { name: 'Mercury', command: '199', key: 'horizonsMercury' },
] as const;

/**
 * A `fetchHorizonsRaDec` mock that fails only the one body named by
 * `failingCommand` (matched against the request's own `command`) and
 * succeeds for every other body — needed because all five bodies now share
 * the one client function, called once per body per tick.
 */
function raDecMockFailingOnly(failingCommand: string | null): ReturnType<typeof vi.fn> {
  return vi
    .fn()
    .mockImplementation((params: { command: string }) =>
      Promise.resolve(
        params.command === failingCommand ? horizonsRaDecFailure : horizonsRaDecSuccess,
      ),
    );
}

const swpcSlowSuccess: SwpcSlowData = {
  kpObserved: [{ timeTag: NOW_ISO, kp: 3, aRunning: 12, stationCount: 8 }],
  kpForecast: [{ timeTag: NOW_ISO, kp: 3, status: 'predicted', noaaScale: null }],
  solarWind: [
    {
      timeTag: NOW_ISO,
      speed: 400,
      density: 5,
      temperature: 100000,
      bx: 1,
      by: 1,
      bz: -2,
      bt: 3,
      propagatedTimeTag: NOW_ISO,
    },
  ],
  fetchedAt: NOW_ISO,
};

const swpcSlowTotalFailure: SwpcSlowData = {
  kpObserved: null,
  kpForecast: null,
  solarWind: null,
  fetchedAt: NOW_ISO,
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
  fetchedAt: NOW_ISO,
};

const satellitesFailure: CelestrakTleData = { records: null, fetchedAt: NOW_ISO };

function makeClients(overrides: Partial<SlowTierClients> = {}): SlowTierClients {
  return {
    fetchNasaDonki: vi.fn().mockResolvedValue(donkiSuccess),
    fetchNasaNeows: vi.fn().mockResolvedValue(neowsSuccess),
    fetchHorizons: vi.fn().mockResolvedValue(horizonsSuccess),
    fetchHorizonsRaDec: vi.fn().mockResolvedValue(horizonsRaDecSuccess),
    fetchSwpcSlow: vi.fn().mockResolvedValue(swpcSlowSuccess),
    fetchCelestrakTle: vi.fn().mockResolvedValue(satellitesSuccess),
    nasaApiKey: 'TEST_KEY',
    ...overrides,
  };
}

describe('runSlowTierTick', () => {
  beforeEach(() => {
    resetStore();
  });

  it('writes all eleven sources fresh and healthy on full success', async () => {
    const clients = makeClients();

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('donki')).toEqual({
      data: donkiSuccess,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
    expect(getSourceState('neows')).toEqual({
      data: neowsSuccess,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
    expect(getSourceState('horizons')).toEqual({
      data: horizonsSuccess,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
    for (const { key } of RA_DEC_BODIES) {
      expect(getSourceState(key)).toEqual({
        data: horizonsRaDecSuccess,
        fetchedAt: NOW_ISO,
        healthy: true,
      });
    }
    expect(getSourceState('spaceWeatherForecast')).toEqual({
      data: swpcSlowSuccess,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
    const gibs = getSourceState('gibs');
    expect(gibs.healthy).toBe(true);
    expect(gibs.fetchedAt).toBe(NOW_ISO);
    expect(gibs.data).toEqual({
      layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
      date: '2026-07-15',
    });
    expect(getSourceState('satellites')).toEqual({
      data: satellitesSuccess,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
  });

  it('calls each client with the injected apiKey/now and a real date window', async () => {
    const clients = makeClients();

    await runSlowTierTick(clients, NOW);

    expect(clients.fetchNasaDonki).toHaveBeenCalledWith(
      { startDate: '2026-07-09', endDate: '2026-07-16' },
      'TEST_KEY',
      NOW,
    );
    expect(clients.fetchNasaNeows).toHaveBeenCalledWith(
      { startDate: '2026-07-16', endDate: '2026-07-23' },
      'TEST_KEY',
      NOW,
    );
    expect(clients.fetchHorizons).toHaveBeenCalledWith(
      expect.objectContaining({ command: '10', startTime: '2026-07-16', stopTime: '2026-07-17' }),
      NOW,
    );
    expect(clients.fetchHorizonsRaDec).toHaveBeenCalledTimes(RA_DEC_BODIES.length);
    for (const { command } of RA_DEC_BODIES) {
      expect(clients.fetchHorizonsRaDec).toHaveBeenCalledWith(
        expect.objectContaining({
          command,
          startTime: '2026-07-16',
          stopTime: '2026-07-17',
          stepSize: '1 h',
          center: '500@399',
        }),
        NOW,
      );
    }
    expect(clients.fetchSwpcSlow).toHaveBeenCalledWith(NOW);
    expect(clients.fetchCelestrakTle).toHaveBeenCalledWith({ group: 'visual' }, NOW);
  });

  it('marks NeoWs unhealthy with null-objects data on failure, no prior data', async () => {
    const clients = makeClients({ fetchNasaNeows: vi.fn().mockResolvedValue(neowsFailure) });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('neows')).toEqual({
      data: neowsFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('does not preserve stale NeoWs data on failure (matches "unavailable" fallback)', async () => {
    const clients = makeClients();
    await runSlowTierTick(clients, NOW);
    expect(getSourceState('neows').healthy).toBe(true);

    const failingClients = makeClients({ fetchNasaNeows: vi.fn().mockResolvedValue(neowsFailure) });
    await runSlowTierTick(failingClients, LATER);

    expect(getSourceState('neows')).toEqual({
      data: neowsFailure,
      fetchedAt: LATER.toISOString(),
      healthy: false,
    });
  });

  it('marks DONKI unhealthy with null data on total failure, no prior data', async () => {
    const clients = makeClients({ fetchNasaDonki: vi.fn().mockResolvedValue(donkiTotalFailure) });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('donki')).toEqual({
      data: donkiTotalFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('preserves the last known-good DONKI data on a later total failure', async () => {
    const goodClients = makeClients();
    await runSlowTierTick(goodClients, NOW);
    expect(getSourceState('donki').healthy).toBe(true);

    const failingClients = makeClients({
      fetchNasaDonki: vi.fn().mockResolvedValue(donkiTotalFailure),
    });
    await runSlowTierTick(failingClients, LATER);

    expect(getSourceState('donki')).toEqual({
      data: donkiSuccess,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('treats a partial DONKI result (one product populated) as healthy', async () => {
    const partial: NasaDonkiData = { ...donkiTotalFailure, flares: [] };
    const clients = makeClients({ fetchNasaDonki: vi.fn().mockResolvedValue(partial) });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('donki')).toEqual({ data: partial, fetchedAt: NOW_ISO, healthy: true });
  });

  it('marks Horizons unhealthy with null ephemeris on failure, no prior data', async () => {
    const clients = makeClients({ fetchHorizons: vi.fn().mockResolvedValue(horizonsFailure) });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('horizons')).toEqual({
      data: horizonsFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('preserves the last known-good Horizons data on a later failure', async () => {
    const goodClients = makeClients();
    await runSlowTierTick(goodClients, NOW);
    expect(getSourceState('horizons').healthy).toBe(true);

    const failingClients = makeClients({
      fetchHorizons: vi.fn().mockResolvedValue(horizonsFailure),
    });
    await runSlowTierTick(failingClients, LATER);

    expect(getSourceState('horizons')).toEqual({
      data: horizonsSuccess,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  describe.each(RA_DEC_BODIES)('$name ephemeris ($key)', ({ command, key }) => {
    it('marks it unhealthy with null entries on failure, no prior data, other bodies unaffected', async () => {
      const clients = makeClients({ fetchHorizonsRaDec: raDecMockFailingOnly(command) });

      await runSlowTierTick(clients, NOW);

      expect(getSourceState(key)).toEqual({
        data: horizonsRaDecFailure,
        fetchedAt: NOW_ISO,
        healthy: false,
      });
      for (const other of RA_DEC_BODIES) {
        if (other.key !== key) expect(getSourceState(other.key).healthy).toBe(true);
      }
    });

    it('preserves the last known-good ephemeris on a later failure', async () => {
      const goodClients = makeClients();
      await runSlowTierTick(goodClients, NOW);
      expect(getSourceState(key).healthy).toBe(true);

      const failingClients = makeClients({ fetchHorizonsRaDec: raDecMockFailingOnly(command) });
      await runSlowTierTick(failingClients, LATER);

      expect(getSourceState(key)).toEqual({
        data: horizonsRaDecSuccess,
        fetchedAt: NOW_ISO,
        healthy: false,
      });
    });

    it('treats an unexpected rejection as a failed fetch instead of throwing, other bodies unaffected', async () => {
      const clients = makeClients({
        fetchHorizonsRaDec: vi
          .fn()
          .mockImplementation((params: { command: string }) =>
            params.command === command
              ? Promise.reject(new Error('boom'))
              : Promise.resolve(horizonsRaDecSuccess),
          ),
      });

      await expect(runSlowTierTick(clients, NOW)).resolves.toBeUndefined();
      expect(getSourceState(key)).toEqual({
        data: { entries: null, fetchedAt: NOW_ISO },
        fetchedAt: NOW_ISO,
        healthy: false,
      });
      expect(getSourceState('horizons').healthy).toBe(true);
      for (const other of RA_DEC_BODIES) {
        if (other.key !== key) expect(getSourceState(other.key).healthy).toBe(true);
      }
    });
  });

  it('marks spaceWeatherForecast unhealthy with null data on total failure, no prior data', async () => {
    const clients = makeClients({ fetchSwpcSlow: vi.fn().mockResolvedValue(swpcSlowTotalFailure) });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('spaceWeatherForecast')).toEqual({
      data: swpcSlowTotalFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('preserves the last known-good spaceWeatherForecast data on a later total failure', async () => {
    const goodClients = makeClients();
    await runSlowTierTick(goodClients, NOW);
    expect(getSourceState('spaceWeatherForecast').healthy).toBe(true);

    const failingClients = makeClients({
      fetchSwpcSlow: vi.fn().mockResolvedValue(swpcSlowTotalFailure),
    });
    await runSlowTierTick(failingClients, LATER);

    expect(getSourceState('spaceWeatherForecast')).toEqual({
      data: swpcSlowSuccess,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('treats a partial spaceWeatherForecast result (one product populated) as healthy', async () => {
    const partial: SwpcSlowData = {
      ...swpcSlowTotalFailure,
      kpForecast: swpcSlowSuccess.kpForecast,
    };
    const clients = makeClients({ fetchSwpcSlow: vi.fn().mockResolvedValue(partial) });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('spaceWeatherForecast')).toEqual({
      data: partial,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
  });

  it('treats an unexpected SWPC (slow) rejection as a total failure instead of throwing', async () => {
    const clients = makeClients({ fetchSwpcSlow: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(runSlowTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('spaceWeatherForecast')).toEqual({
      data: { kpObserved: null, kpForecast: null, solarWind: null, fetchedAt: NOW_ISO },
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('donki').healthy).toBe(true);
  });

  it('marks satellites unhealthy with null records on failure, no prior data', async () => {
    const clients = makeClients({
      fetchCelestrakTle: vi.fn().mockResolvedValue(satellitesFailure),
    });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('satellites')).toEqual({
      data: satellitesFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('preserves the last known-good satellite population on a later failure', async () => {
    const goodClients = makeClients();
    await runSlowTierTick(goodClients, NOW);
    expect(getSourceState('satellites').healthy).toBe(true);

    const failingClients = makeClients({
      fetchCelestrakTle: vi.fn().mockResolvedValue(satellitesFailure),
    });
    await runSlowTierTick(failingClients, LATER);

    expect(getSourceState('satellites')).toEqual({
      data: satellitesSuccess,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('caps the satellite population at MAX_SATELLITES on a successful fetch', async () => {
    const oversized: CelestrakTleData = {
      records: Array.from({ length: 250 }, (_, i) => ({
        name: `SAT ${i}`,
        noradCatId: i,
        line1: satellitesSuccess.records![0]!.line1,
        line2: satellitesSuccess.records![0]!.line2,
      })),
      fetchedAt: NOW_ISO,
    };
    const clients = makeClients({ fetchCelestrakTle: vi.fn().mockResolvedValue(oversized) });

    await runSlowTierTick(clients, NOW);

    const stored = getSourceState('satellites');
    expect(stored.healthy).toBe(true);
    expect(stored.data?.records).toHaveLength(200);
  });

  it('treats an unexpected CelesTrak rejection as a failed fetch instead of throwing', async () => {
    const clients = makeClients({
      fetchCelestrakTle: vi.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(runSlowTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('satellites')).toEqual({
      data: { records: null, fetchedAt: NOW_ISO },
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('donki').healthy).toBe(true);
  });

  it('one source failing does not affect the others (degradation contract)', async () => {
    const clients = makeClients({
      fetchNasaDonki: vi.fn().mockResolvedValue(donkiTotalFailure),
      fetchNasaNeows: vi.fn().mockResolvedValue(neowsFailure),
    });

    await runSlowTierTick(clients, NOW);

    expect(getSourceState('donki').healthy).toBe(false);
    expect(getSourceState('neows').healthy).toBe(false);
    expect(getSourceState('horizons').healthy).toBe(true);
    for (const { key } of RA_DEC_BODIES) {
      expect(getSourceState(key).healthy).toBe(true);
    }
    expect(getSourceState('spaceWeatherForecast').healthy).toBe(true);
    expect(getSourceState('gibs').healthy).toBe(true);
    expect(getSourceState('satellites').healthy).toBe(true);
  });

  it('treats an unexpected DONKI rejection as a total failure instead of throwing', async () => {
    const clients = makeClients({ fetchNasaDonki: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(runSlowTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('donki')).toEqual({
      data: { cmes: null, flares: null, fetchedAt: NOW_ISO },
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('neows').healthy).toBe(true);
    expect(getSourceState('horizons').healthy).toBe(true);
  });

  it('treats an unexpected NeoWs rejection as a failed fetch instead of throwing', async () => {
    const clients = makeClients({ fetchNasaNeows: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(runSlowTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('neows')).toEqual({
      data: { elementCount: 0, objects: null, fetchedAt: NOW_ISO },
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('donki').healthy).toBe(true);
  });

  it('treats an unexpected Horizons rejection as a failed fetch instead of throwing', async () => {
    const clients = makeClients({ fetchHorizons: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(runSlowTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('horizons')).toEqual({
      data: { ephemerisLines: null, fetchedAt: NOW_ISO },
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('donki').healthy).toBe(true);
  });
});

describe('startSlowTierLoop', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately, then again on each interval, and stops on demand', async () => {
    const clients = makeClients();

    const stop = startSlowTierLoop(clients);
    await vi.advanceTimersByTimeAsync(0);
    expect(clients.fetchNasaDonki).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SLOW_TIER_INTERVAL_MS);
    expect(clients.fetchNasaDonki).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(SLOW_TIER_INTERVAL_MS * 2);
    expect(clients.fetchNasaDonki).toHaveBeenCalledTimes(2);
  });

  it('does not throw out of the tick when a client rejects', async () => {
    const clients = makeClients({ fetchNasaDonki: vi.fn().mockRejectedValue(new Error('x')) });

    expect(() => startSlowTierLoop(clients)).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(getSourceState('donki').healthy).toBe(false);
  });
});
