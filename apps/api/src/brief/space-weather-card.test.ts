import { describe, expect, it } from 'vitest';
import { confidenceBand } from '@astranet/shared';
import { buildSpaceWeatherCard, selectNearestForecastEntry } from './space-weather-card';
import type { DonkiCmeEvent, NasaDonkiData } from '../clients/nasa/index.js';
import type { SwpcFastData, SwpcKpForecastEntry, SwpcSlowData } from '../clients/swpc/index.js';
import type { SourceState } from '../poller/store.js';

const NOW = new Date('2026-07-17T12:00:00Z');
const NEUTRAL_HISTORY = { hits: 0, trials: 0 };

function sourceState<T>(
  data: T | null,
  fetchedAt: string | null,
  healthy: boolean,
): SourceState<T> {
  return { data, fetchedAt, healthy };
}

function fastData(overrides: Partial<SwpcFastData> = {}): SwpcFastData {
  return {
    kpCurrent: { timeTag: NOW.toISOString(), kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
    rtswPlasma: {
      timeTag: NOW.toISOString(),
      source: 'DSCOVR',
      protonSpeed: 430,
      protonDensity: 5,
      protonTemperature: 100000,
      overallQuality: 0,
    },
    fetchedAt: NOW.toISOString(),
    ...overrides,
  };
}

function slowData(kpForecast: SwpcKpForecastEntry[] | null): SwpcSlowData {
  return {
    kpObserved: null,
    kpForecast,
    solarWind: [
      {
        timeTag: NOW.toISOString(),
        speed: 410,
        density: 4,
        temperature: 90000,
        bx: 0,
        by: 0,
        bz: -2,
        bt: 3,
        propagatedTimeTag: null,
      },
    ],
    fetchedAt: NOW.toISOString(),
  };
}

function forecastEntry(hoursFromNow: number, kp: number): SwpcKpForecastEntry {
  return {
    timeTag: new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString(),
    kp,
    status: 'predicted',
    noaaScale: null,
  };
}

function cmeEvent(activityId: string, startHoursAgo: number, speed: number | null): DonkiCmeEvent {
  return {
    activityId,
    startTime: new Date(NOW.getTime() - startHoursAgo * 3_600_000).toISOString(),
    note: null,
    link: null,
    analyses: [
      {
        isMostAccurate: true,
        time21_5: null,
        latitude: null,
        longitude: null,
        halfAngle: null,
        speed,
        type: 'C',
      },
    ],
  };
}

function donkiData(cmes: DonkiCmeEvent[]): NasaDonkiData {
  return { cmes, flares: null, fetchedAt: NOW.toISOString() };
}

describe('selectNearestForecastEntry', () => {
  it('returns null for an empty list', () => {
    expect(selectNearestForecastEntry([], NOW)).toBeNull();
  });

  it('picks the entry closest to now', () => {
    const far = forecastEntry(-9, 2);
    const near = forecastEntry(1, 4);
    const alsoFar = forecastEntry(12, 1);
    expect(selectNearestForecastEntry([far, near, alsoFar], NOW)).toBe(near);
  });
});

describe('buildSpaceWeatherCard', () => {
  it('composes a full headline and an active-CME-free aurora read when everything is healthy', () => {
    const card = buildSpaceWeatherCard(
      sourceState(fastData(), NOW.toISOString(), true),
      sourceState(slowData([forecastEntry(0, 4)]), NOW.toISOString(), true),
      sourceState(donkiData([]), NOW.toISOString(), true),
      45,
      -75,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.solarLine.headline).toBe('solar wind 430 km/s, Kp 4');
    expect(card.solarLine.live.healthy).toBe(true);
    expect(card.solarLine.forecast.healthy).toBe(true);
    expect(card.aurora).not.toBeNull();
    expect(card.aurora?.hasActiveCme).toBe(false);
    expect(card.aurora?.confidence).toBeNull();
    expect(card.aurora?.confidenceBand).toBeNull();
    expect(card.aurora?.factors).toBeNull();
    expect(card.aurora?.kpPredicted).toBe(4);
  });

  it('degrades honestly to "unavailable" when both solar-weather sources are down', () => {
    const card = buildSpaceWeatherCard(
      sourceState<SwpcFastData>(null, null, false),
      sourceState<SwpcSlowData>(null, null, false),
      sourceState<NasaDonkiData>(null, null, false),
      45,
      -75,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.solarLine.headline).toBe('space weather unavailable');
    expect(card.aurora).toBeNull();
  });

  it('still produces an aurora read from the forecast alone when the live tier is down', () => {
    const card = buildSpaceWeatherCard(
      sourceState<SwpcFastData>(null, null, false),
      sourceState(slowData([forecastEntry(0, 6)]), NOW.toISOString(), true),
      sourceState(donkiData([]), NOW.toISOString(), true),
      70,
      20,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.solarLine.live.speedKmS).toBeNull();
    expect(card.solarLine.headline).toBe('Kp 6');
    expect(card.aurora).not.toBeNull();
    expect(card.aurora?.kpPredicted).toBe(6);
  });

  it('attaches Causal Engine confidence when a CME is still incoming', () => {
    const card = buildSpaceWeatherCard(
      sourceState(fastData(), NOW.toISOString(), true),
      sourceState(slowData([forecastEntry(0, 5)]), NOW.toISOString(), true),
      sourceState(donkiData([cmeEvent('cme-1', 1, 800)]), NOW.toISOString(), true),
      65,
      -20,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.aurora?.hasActiveCme).toBe(true);
    expect(card.aurora?.cmeArrivalTime).not.toBeNull();
    expect(new Date(card.aurora!.cmeArrivalTime!).getTime()).toBeGreaterThan(NOW.getTime());
    expect(card.aurora?.confidence).not.toBeNull();
    expect(card.aurora?.confidenceBand).toBe(confidenceBand(card.aurora!.confidence!));
    expect(card.aurora?.factors).not.toBeNull();
    // Neutral Beta prior (FORMULAS.md §9) when the caller has no real history to feed in yet.
    expect(card.aurora?.factors?.history).toBeCloseTo(0.5, 10);
    expect(card.aurora?.cmeActivityId).toBe('cme-1');
    expect(card.aurora?.leadHours).not.toBeNull();
    expect(card.aurora?.leadHours).toBeCloseTo(
      (new Date(card.aurora!.cmeArrivalTime!).getTime() - NOW.getTime()) / 3_600_000,
      10,
    );
  });

  it('feeds real accuracy-loop history into f_hist instead of the neutral prior', () => {
    const card = buildSpaceWeatherCard(
      sourceState(fastData(), NOW.toISOString(), true),
      sourceState(slowData([forecastEntry(0, 5)]), NOW.toISOString(), true),
      sourceState(donkiData([cmeEvent('cme-1', 1, 800)]), NOW.toISOString(), true),
      65,
      -20,
      NOW,
      { hits: 3, trials: 4 },
    );

    // FORMULAS.md §8/§9: (hits + 2) / (trials + 4) = 5/8, not the naive 3/4.
    expect(card.aurora?.factors?.history).toBeCloseTo(5 / 8, 10);
  });

  it('reports no CME identity/lead-time when there is no active CME', () => {
    const card = buildSpaceWeatherCard(
      sourceState(fastData(), NOW.toISOString(), true),
      sourceState(slowData([forecastEntry(0, 4)]), NOW.toISOString(), true),
      sourceState(donkiData([]), NOW.toISOString(), true),
      45,
      -75,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.aurora?.cmeActivityId).toBeNull();
    expect(card.aurora?.leadHours).toBeNull();
  });

  it('treats a CME whose DBM-solved arrival has already passed as not active', () => {
    const card = buildSpaceWeatherCard(
      sourceState(fastData(), NOW.toISOString(), true),
      sourceState(slowData([forecastEntry(0, 5)]), NOW.toISOString(), true),
      sourceState(donkiData([cmeEvent('cme-old', 24 * 10, 800)]), NOW.toISOString(), true),
      65,
      -20,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.aurora?.hasActiveCme).toBe(false);
    expect(card.aurora?.confidence).toBeNull();
  });

  it('skips a CME analysis with no usable speed and falls through to an older, usable one', () => {
    const noSpeedCme = cmeEvent('cme-nospeed', 0.5, null);
    const usableCme = cmeEvent('cme-usable', 2, 700);

    const card = buildSpaceWeatherCard(
      sourceState(fastData(), NOW.toISOString(), true),
      sourceState(slowData([forecastEntry(0, 5)]), NOW.toISOString(), true),
      sourceState(donkiData([noSpeedCme, usableCme]), NOW.toISOString(), true),
      65,
      -20,
      NOW,
      NEUTRAL_HISTORY,
    );

    expect(card.aurora?.hasActiveCme).toBe(true);
  });
});
