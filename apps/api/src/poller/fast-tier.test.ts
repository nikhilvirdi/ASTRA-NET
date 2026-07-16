import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runFastTierTick,
  startFastTierLoop,
  FAST_TIER_INTERVAL_MS,
  ISS_NORAD_ID,
  type FastTierClients,
} from './fast-tier.js';
import { getSourceState, resetStore } from './store.js';
import type { N2yoPositionsData } from '../clients/n2yo/index.js';
import type { SwpcData } from '../clients/swpc/index.js';

const NOW = new Date('2026-07-16T12:00:00.000Z');
const NOW_ISO = NOW.toISOString();
const LATER = new Date('2026-07-16T12:00:45.000Z');

const issSuccess: N2yoPositionsData = {
  satId: ISS_NORAD_ID,
  satName: 'ISS (ZARYA)',
  positions: [
    {
      latitude: 12.3,
      longitude: 45.6,
      altitude: 420,
      azimuth: 0,
      elevation: 0,
      ra: 0,
      dec: 0,
      timestamp: 1_752_664_800,
      eclipsed: false,
    },
  ],
  fetchedAt: NOW_ISO,
};

const issFailure: N2yoPositionsData = {
  satId: ISS_NORAD_ID,
  satName: 'Unknown',
  positions: null,
  fetchedAt: NOW_ISO,
};

const swpcHealthy: SwpcData = {
  kpCurrent: { timeTag: NOW_ISO, kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
  kpObserved: null,
  kpForecast: null,
  solarWind: null,
  rtswPlasma: null,
  fetchedAt: NOW_ISO,
};

const swpcTotalFailure: SwpcData = {
  kpCurrent: null,
  kpObserved: null,
  kpForecast: null,
  solarWind: null,
  rtswPlasma: null,
  fetchedAt: NOW_ISO,
};

function makeClients(overrides: Partial<FastTierClients> = {}): FastTierClients {
  return {
    fetchN2yoPositions: vi.fn().mockResolvedValue(issSuccess),
    fetchSwpc: vi.fn().mockResolvedValue(swpcHealthy),
    n2yoApiKey: 'TEST_KEY',
    ...overrides,
  };
}

describe('runFastTierTick', () => {
  beforeEach(() => {
    resetStore();
  });

  it('writes both sources fresh and healthy on full success', async () => {
    const clients = makeClients();

    await runFastTierTick(clients, NOW);

    expect(getSourceState('iss')).toEqual({ data: issSuccess, fetchedAt: NOW_ISO, healthy: true });
    expect(getSourceState('solarWind')).toEqual({
      data: swpcHealthy,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
  });

  it('calls fetchN2yoPositions with the ISS NORAD id and the injected apiKey/now', async () => {
    const clients = makeClients();

    await runFastTierTick(clients, NOW);

    expect(clients.fetchN2yoPositions).toHaveBeenCalledWith(
      expect.objectContaining({ satId: ISS_NORAD_ID }),
      'TEST_KEY',
      NOW,
    );
    expect(clients.fetchSwpc).toHaveBeenCalledWith(NOW);
  });

  it('marks ISS unhealthy with null-position data on failure, no prior data', async () => {
    const clients = makeClients({ fetchN2yoPositions: vi.fn().mockResolvedValue(issFailure) });

    await runFastTierTick(clients, NOW);

    expect(getSourceState('iss')).toEqual({ data: issFailure, fetchedAt: NOW_ISO, healthy: false });
  });

  it('does not preserve stale ISS data on failure (matches "position unavailable" fallback)', async () => {
    const clients = makeClients();
    await runFastTierTick(clients, NOW);
    expect(getSourceState('iss').healthy).toBe(true);

    const failingClients = makeClients({
      fetchN2yoPositions: vi.fn().mockResolvedValue(issFailure),
    });
    await runFastTierTick(failingClients, LATER);

    expect(getSourceState('iss')).toEqual({
      data: issFailure,
      fetchedAt: LATER.toISOString(),
      healthy: false,
    });
  });

  it('marks solar wind unhealthy with null data on total failure, no prior data', async () => {
    const clients = makeClients({ fetchSwpc: vi.fn().mockResolvedValue(swpcTotalFailure) });

    await runFastTierTick(clients, NOW);

    expect(getSourceState('solarWind')).toEqual({
      data: swpcTotalFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('preserves the last known-good solar wind data on a later total failure', async () => {
    const goodClients = makeClients();
    await runFastTierTick(goodClients, NOW);
    expect(getSourceState('solarWind').healthy).toBe(true);

    const failingClients = makeClients({
      fetchSwpc: vi.fn().mockResolvedValue(swpcTotalFailure),
    });
    await runFastTierTick(failingClients, LATER);

    expect(getSourceState('solarWind')).toEqual({
      data: swpcHealthy,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
  });

  it('treats a partial SWPC result (some fields populated) as healthy', async () => {
    const partial: SwpcData = { ...swpcTotalFailure, kpCurrent: swpcHealthy.kpCurrent };
    const clients = makeClients({ fetchSwpc: vi.fn().mockResolvedValue(partial) });

    await runFastTierTick(clients, NOW);

    expect(getSourceState('solarWind')).toEqual({
      data: partial,
      fetchedAt: NOW_ISO,
      healthy: true,
    });
  });

  it('one source failing does not affect the other (degradation contract)', async () => {
    const clients = makeClients({
      fetchN2yoPositions: vi.fn().mockResolvedValue(issFailure),
      fetchSwpc: vi.fn().mockResolvedValue(swpcHealthy),
    });

    await runFastTierTick(clients, NOW);

    expect(getSourceState('iss').healthy).toBe(false);
    expect(getSourceState('solarWind').healthy).toBe(true);
  });

  it('treats an unexpected N2YO rejection as a failed fetch instead of throwing', async () => {
    const clients = makeClients({
      fetchN2yoPositions: vi.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(runFastTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('iss')).toEqual({
      data: { satId: ISS_NORAD_ID, satName: 'Unknown', positions: null, fetchedAt: NOW_ISO },
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('solarWind').healthy).toBe(true);
  });

  it('treats an unexpected SWPC rejection as a total failure instead of throwing', async () => {
    const clients = makeClients({ fetchSwpc: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(runFastTierTick(clients, NOW)).resolves.toBeUndefined();
    expect(getSourceState('solarWind')).toEqual({
      data: swpcTotalFailure,
      fetchedAt: NOW_ISO,
      healthy: false,
    });
    expect(getSourceState('iss').healthy).toBe(true);
  });
});

describe('startFastTierLoop', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately, then again on each interval, and stops on demand', async () => {
    const clients = makeClients();

    const stop = startFastTierLoop(clients);
    await vi.advanceTimersByTimeAsync(0);
    expect(clients.fetchN2yoPositions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(FAST_TIER_INTERVAL_MS);
    expect(clients.fetchN2yoPositions).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(FAST_TIER_INTERVAL_MS * 2);
    expect(clients.fetchN2yoPositions).toHaveBeenCalledTimes(2);
  });

  it('does not throw out of the tick when a client rejects', async () => {
    const clients = makeClients({ fetchN2yoPositions: vi.fn().mockRejectedValue(new Error('x')) });

    expect(() => startFastTierLoop(clients)).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(getSourceState('iss').healthy).toBe(false);
  });
});
