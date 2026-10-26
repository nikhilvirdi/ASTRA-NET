import { describe, expect, it } from 'vitest';
import { extractHorizonObjects } from './celestial-horizon-data';
import type { DailyBrief } from './api';

function createMockBrief(overrides: Partial<DailyBrief> = {}): DailyBrief {
  return {
    observer: { latDeg: 28.6139, lonDeg: 77.209 }, // Delhi
    generatedAt: '2026-10-27T18:00:00Z',
    status: 'ok',
    skyAnchor: {
      status: 'ok',
      data: {
        sunAltitudeDeg: -15.4,
        sunAzimuthDeg: 260.2,
        twilightPhase: 'twilight',
        isDarkEnoughForIssOrAurora: true,
        isDarkEnoughForFaintStars: false,
        jupiter: { altitudeDeg: 42.1, azimuthDeg: 135.0 },
        venus: { altitudeDeg: -8.0, azimuthDeg: 275.5 },
        mars: null,
        saturn: { altitudeDeg: 12.5, azimuthDeg: 210.0 },
        mercury: null,
        moon: {
          altitudeDeg: 35.8,
          azimuthDeg: 110.2,
          phaseName: 'Waxing Gibbous',
          illuminatedFraction: 0.82,
          phaseAngleDeg: 45.0,
          nextRiseUtc: null,
          nextSetUtc: null,
        },
        cloudCover: null,
        skyQualityBortle: 5,
      },
    },
    iss: {
      status: 'ok',
      data: {
        position: null,
        nextPass: null,
      },
    },
    spaceWeather: {
      status: 'ok',
      data: {
        solarLine: {
          headline: 'Nominal solar wind',
          live: { speedKmS: 410, kp: 2.1, fetchedAt: '2026-10-27T18:00:00Z', healthy: true },
          forecast: { kp: 2.0, status: 'stable', fetchedAt: '2026-10-27T18:00:00Z', healthy: true },
        },
        aurora: null,
      },
    },
    neoImagery: {
      status: 'ok',
      data: {
        neo: null,
        imagery: null,
      },
    },
    learningMoment: 'The celestial horizon divides the visible dome from the nadir sphere.',
    ...overrides,
  };
}

describe('extractHorizonObjects', () => {
  it('returns an empty array when brief is null', () => {
    expect(extractHorizonObjects({ brief: null })).toEqual([]);
  });

  it('extracts real Sun and Moon positions from skyAnchor', () => {
    const brief = createMockBrief();
    const objects = extractHorizonObjects({ brief, includeBelowHorizon: true });

    const sun = objects.find((o) => o.id === 'sun');
    expect(sun).toBeDefined();
    expect(sun?.altitudeDeg).toBe(-15.4);
    expect(sun?.azimuthDeg).toBeCloseTo(260.2, 5);
    expect(sun?.isAboveHorizon).toBe(false);

    const moon = objects.find((o) => o.id === 'moon');
    expect(moon).toBeDefined();
    expect(moon?.altitudeDeg).toBe(35.8);
    expect(moon?.azimuthDeg).toBeCloseTo(110.2, 5);
    expect(moon?.isAboveHorizon).toBe(true);
  });

  it('filters out below-horizon objects when includeBelowHorizon is false', () => {
    const brief = createMockBrief();
    const objects = extractHorizonObjects({ brief, includeBelowHorizon: false });

    // Sun at -15.4 and Venus at -8.0 should be excluded
    expect(objects.find((o) => o.id === 'sun')).toBeUndefined();
    expect(objects.find((o) => o.id === 'venus')).toBeUndefined();

    // Jupiter at +42.1, Moon at +35.8, Saturn at +12.5 should remain
    expect(objects.find((o) => o.id === 'jupiter')).toBeDefined();
    expect(objects.find((o) => o.id === 'moon')).toBeDefined();
    expect(objects.find((o) => o.id === 'saturn')).toBeDefined();
  });

  it('gracefully omits unavailable planets without fabricating coordinates', () => {
    const brief = createMockBrief();
    const objects = extractHorizonObjects({ brief });

    // In mock, Mars and Mercury are null
    expect(objects.find((o) => o.id === 'mars')).toBeUndefined();
    expect(objects.find((o) => o.id === 'mercury')).toBeUndefined();

    // Jupiter and Saturn are present
    expect(objects.find((o) => o.id === 'jupiter')).toBeDefined();
    expect(objects.find((o) => o.id === 'saturn')).toBeDefined();
  });

  it('extracts ISS from live SSE position when provided', () => {
    const brief = createMockBrief();
    const issLivePos = {
      latitudeDeg: 28.0,
      longitudeDeg: 77.0,
      altitudeKm: 420,
      timestampUtc: 1729987200,
    };

    const objects = extractHorizonObjects({
      brief,
      issLivePosition: issLivePos,
    });

    const iss = objects.find((o) => o.id === 'iss');
    expect(iss).toBeDefined();
    expect(iss?.category).toBe('satellite');
    expect(iss?.sourceNote).toContain('Live');
  });

  it('gracefully omits ISS when no live position or pass exists', () => {
    const brief = createMockBrief();
    const objects = extractHorizonObjects({
      brief,
      issLivePosition: null,
    });

    const iss = objects.find((o) => o.id === 'iss');
    expect(iss).toBeUndefined();
  });
});
