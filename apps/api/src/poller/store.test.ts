import { describe, it, expect, beforeEach } from 'vitest';
import { getSourceState, getAllSourceStates, setSourceState, resetStore } from './store.js';
import type { NasaDonkiData } from '../clients/nasa/index.js';
import type { SwpcFastData } from '../clients/swpc/index.js';

describe('poller store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts every source empty and unhealthy', () => {
    const all = getAllSourceStates();
    expect(all.iss).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.solarWind).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.spaceWeatherForecast).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.donki).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.neows).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.gibs).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.horizons).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(all.horizonsJupiter).toEqual({ data: null, fetchedAt: null, healthy: false });
  });

  it('writes and reads back a source by key', () => {
    const donki: NasaDonkiData = {
      cmes: [],
      flares: null,
      fetchedAt: '2026-07-16T00:00:00.000Z',
    };

    setSourceState('donki', donki, '2026-07-16T00:00:05.000Z', true);

    expect(getSourceState('donki')).toEqual({
      data: donki,
      fetchedAt: '2026-07-16T00:00:05.000Z',
      healthy: true,
    });
  });

  it('updates one source without disturbing the others', () => {
    setSourceState('donki', { cmes: [], flares: [], fetchedAt: 't' }, 't1', true);
    setSourceState('neows', { elementCount: 0, objects: [], fetchedAt: 't' }, 't2', true);

    expect(getSourceState('donki').healthy).toBe(true);
    expect(getSourceState('neows').healthy).toBe(true);
    expect(getSourceState('iss')).toEqual({ data: null, fetchedAt: null, healthy: false });
  });

  it('records an unhealthy write (failed fetch) with null data', () => {
    setSourceState('solarWind', null, '2026-07-16T00:01:00.000Z', false);

    expect(getSourceState('solarWind')).toEqual({
      data: null,
      fetchedAt: '2026-07-16T00:01:00.000Z',
      healthy: false,
    });
  });

  it('overwrites a previous value on the same key', () => {
    const first: SwpcFastData = {
      kpCurrent: null,
      rtswPlasma: null,
      fetchedAt: 't1',
    };
    const second: SwpcFastData = { ...first, fetchedAt: 't2' };

    setSourceState('solarWind', first, 't1', true);
    setSourceState('solarWind', second, 't2', true);

    expect(getSourceState('solarWind').data).toEqual(second);
    expect(getSourceState('solarWind').fetchedAt).toBe('t2');
  });

  it('getAllSourceStates returns a snapshot, not a live reference', () => {
    const snapshot = getAllSourceStates();
    setSourceState(
      'iss',
      { satId: 25544, satName: 'ISS', positions: null, fetchedAt: 't' },
      't',
      true,
    );

    expect(snapshot.iss).toEqual({ data: null, fetchedAt: null, healthy: false });
    expect(getSourceState('iss').healthy).toBe(true);
  });
});
