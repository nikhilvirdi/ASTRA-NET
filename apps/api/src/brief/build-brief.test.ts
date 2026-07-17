import { describe, expect, it } from 'vitest';
import { buildBrief } from './build-brief';
import type { PollerState, SourceState } from '../poller/store.js';

const NOW = new Date('2026-07-17T12:00:00Z');

function empty<T>(): SourceState<T> {
  return { data: null, fetchedAt: null, healthy: false };
}

function emptyPollerState(): PollerState {
  return {
    iss: empty(),
    solarWind: empty(),
    spaceWeatherForecast: empty(),
    donki: empty(),
    neows: empty(),
    gibs: empty(),
    horizons: empty(),
  };
}

function fullPollerState(): PollerState {
  const state = emptyPollerState();
  state.solarWind = {
    data: {
      kpCurrent: { timeTag: NOW.toISOString(), kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
      rtswPlasma: {
        timeTag: NOW.toISOString(),
        source: 'DSCOVR',
        protonSpeed: 420,
        protonDensity: 5,
        protonTemperature: 100000,
        overallQuality: 0,
      },
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.spaceWeatherForecast = {
    data: {
      kpObserved: null,
      kpForecast: [{ timeTag: NOW.toISOString(), kp: 4, status: 'predicted', noaaScale: null }],
      solarWind: null,
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.donki = {
    data: { cmes: [], flares: null, fetchedAt: NOW.toISOString() },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  return state;
}

describe('buildBrief — degradation contract (ARCHITECTURE.md §5)', () => {
  it('full-data case: every available card resolves', () => {
    const brief = buildBrief(fullPollerState(), 45, -75, NOW);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.skyAnchor.data).not.toBeNull();
    expect(brief.spaceWeather.status).toBe('ok');
    expect(brief.spaceWeather.data?.solarLine.headline).toBe('solar wind 420 km/s, Kp 4');
    expect(brief.spaceWeather.data?.aurora).not.toBeNull();
    expect(brief.learningMoment.length).toBeGreaterThan(0);
  });

  it('partial-outage case: one source down blanks only its own card', () => {
    const state = fullPollerState();
    // Simulate DONKI down — space weather (SWPC-driven) must still resolve.
    state.donki = empty();

    const brief = buildBrief(state, 45, -75, NOW);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.spaceWeather.status).toBe('ok');
    expect(brief.spaceWeather.data?.aurora?.hasActiveCme).toBe(false);
  });

  it('partial-outage case: SWPC entirely down blanks only the space-weather card', () => {
    const state = fullPollerState();
    state.solarWind = empty();
    state.spaceWeatherForecast = empty();

    const brief = buildBrief(state, 45, -75, NOW);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.skyAnchor.data).not.toBeNull();
    expect(brief.spaceWeather.status).toBe('unavailable');
    expect(brief.spaceWeather.data).toBeNull();
  });

  it('total-outage case: the Brief still renders because Sky Anchor never fails', () => {
    const brief = buildBrief(emptyPollerState(), 45, -75, NOW);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.skyAnchor.data).not.toBeNull();
    expect(brief.spaceWeather.status).toBe('unavailable');
    expect(brief.spaceWeather.data).toBeNull();
    expect(brief.learningMoment.length).toBeGreaterThan(0);
  });
});
