/**
 * Shared fixtures for the `src/share` tests (WORKPLAN.md Phase 11).
 *
 * Two builders, both deliberately *complete* by default and narrowed by the
 * caller: a `DailyBrief` for the pure snapshot core, and a `ShareSnapshot`
 * for everything downstream of it. Tests that care about one missing source
 * override that one field rather than assembling a brief from scratch, so a
 * later field added to `DailyBrief` breaks one place instead of eight.
 *
 * Lives under `__fixtures__/` for the same reason the client tests' fixtures
 * do: it is test scaffolding, not shipped code, and is excluded from the
 * coverage instrumentation in `vitest.config.ts`.
 */

import type { DailyBrief } from '../../brief/build-brief.js';
import { SHARE_SNAPSHOT_SCHEMA_VERSION, type ShareSnapshot } from '../share.schemas.js';

/** The Brief moment every fixture freezes — astronomical twilight over London. */
export const CAPTURED_AT = '2026-07-17T21:40:00.000Z';
export const CREATED_AT = '2026-07-17T21:41:30.000Z';

/** Passes `SHARE_ID_PATTERN`: 12 URL-safe characters. */
export const FIXTURE_SHARE_ID = 'Ab3-_xY9zQ7w';

export const LONDON_LAT = 51.5072;
export const LONDON_LON = -0.1276;

/** Start of the ISS pass, as seconds since epoch — same UTC day as `CAPTURED_AT`. */
export const PASS_START_UTC = Date.parse('2026-07-17T22:14:00.000Z') / 1000;

export function makeDailyBrief(overrides: Partial<DailyBrief> = {}): DailyBrief {
  return {
    observer: { latDeg: LONDON_LAT, lonDeg: LONDON_LON },
    generatedAt: CAPTURED_AT,
    status: 'ok',
    skyAnchor: {
      status: 'ok',
      data: {
        // -14.2deg: inside DESIGN_SPEC.md §2's astronomical band, so the
        // fixture exercises a real interpolated surface rather than a stop.
        sunAltitudeDeg: -14.2,
        sunAzimuthDeg: 318.4,
        twilightPhase: 'night',
        isDarkEnoughForIssOrAurora: true,
        isDarkEnoughForFaintStars: false,
        jupiter: { altitudeDeg: 22.4, azimuthDeg: 104.2 },
        venus: { altitudeDeg: -8.1, azimuthDeg: 291.7 },
        mars: { altitudeDeg: 5.4, azimuthDeg: 247.9 },
        saturn: { altitudeDeg: 41.8, azimuthDeg: 142.3 },
        mercury: null,
        moon: {
          altitudeDeg: 12.7,
          azimuthDeg: 201.5,
          phaseName: 'waxingGibbous',
          illuminatedFraction: 0.734,
          phaseAngleDeg: 72.1,
          nextRiseUtc: '2026-07-18T14:02:00.000Z',
          nextSetUtc: '2026-07-18T01:18:00.000Z',
        },
      },
    },
    iss: {
      status: 'ok',
      data: {
        position: null,
        nextPass: {
          startUtc: PASS_START_UTC,
          maxUtc: PASS_START_UTC + 180,
          endUtc: PASS_START_UTC + 360,
          maxElevationDeg: 68.4,
          magnitude: -3.2,
          durationSeconds: 360,
          startAzimuthDeg: 218.0,
          startAzimuthCompass: 'SW',
          maxAzimuthDeg: 142.0,
          maxAzimuthCompass: 'SE',
          endAzimuthDeg: 71.0,
          endAzimuthCompass: 'ENE',
        },
      },
    },
    spaceWeather: {
      status: 'ok',
      data: {
        solarLine: {
          headline: 'Solar wind steady.',
          live: { speedKmS: 428.6, kp: 3, fetchedAt: CAPTURED_AT, healthy: true },
          forecast: { kp: 4, status: 'predicted', fetchedAt: CAPTURED_AT, healthy: true },
        },
        aurora: {
          kpPredicted: 4,
          kpForecastStatus: 'predicted',
          kpForecastTimeTag: CAPTURED_AT,
          visible: false,
          strengthDeg: 2.5,
          strengthFactor: 0.5,
          geomagneticLatitudeDeg: 54.2,
          auroraOvalBoundaryDeg: 61.3,
          hasActiveCme: false,
          cmeArrivalTime: null,
          cmeActivityId: null,
          confidence: null,
          confidenceBand: null,
          factors: null,
          leadHours: null,
        },
      },
    },
    neoImagery: {
      status: 'ok',
      data: {
        neo: {
          id: '3542519',
          name: '(2010 PK9)',
          nasaJplUrl: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3542519',
          isPotentiallyHazardous: false,
          diameterKm: 0.34,
          closeApproachDate: '2026-07-18',
          missDistanceKm: 7_480_000,
          missDistanceLunarDistances: 19.4,
          velocityKmS: 12.8,
        },
        imagery: null,
      },
    },
    learningMoment: 'Astronomical twilight is the last of the three.',
    ...overrides,
  };
}

/**
 * A snapshot matching `makeDailyBrief()`'s output, hand-written rather than
 * produced by `buildShareSnapshot` — the downstream tests must not depend on
 * the very function whose output they stand in for, or a bug in it would
 * make its own consumers' tests agree with it.
 */
export function makeShareSnapshot(overrides: Partial<ShareSnapshot> = {}): ShareSnapshot {
  return {
    schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
    id: FIXTURE_SHARE_ID,
    createdAt: CREATED_AT,
    capturedAt: CAPTURED_AT,
    observer: { latDeg: LONDON_LAT, lonDeg: LONDON_LON, label: '51.51°N 0.13°W' },
    sky: {
      sunAltitudeDeg: -14.2,
      sunAzimuthDeg: 318.4,
      twilightPhase: 'night',
      twilightBand: 'astronomical',
      twilightValue: 2 + 2.2 / 6,
      surfaceHex: '#182020',
    },
    headline: 'The ISS crosses your sky at 22:14 UTC, almost directly overhead.',
    facts: [
      { label: 'NEXT ISS PASS', value: '22:14 UTC' },
      { label: 'KP FORECAST', value: '4.0' },
      { label: 'SOLAR WIND', value: '429 km/s' },
    ],
    horizon: {
      markers: [
        {
          id: 'sun',
          label: 'SUN',
          sublabel: 'ALT −14.2°',
          type: 'sun',
          azimuthDeg: 318.4,
          altitudeDeg: -14.2,
        },
        {
          id: 'moon',
          label: 'MOON',
          sublabel: '73% LIT',
          type: 'moon',
          azimuthDeg: 201.5,
          altitudeDeg: 12.7,
        },
        {
          id: 'mars',
          label: 'MARS',
          sublabel: 'ALT +5°',
          type: 'planet',
          azimuthDeg: 247.9,
          altitudeDeg: 5.4,
        },
        {
          id: 'jupiter',
          label: 'JUPITER',
          sublabel: 'ALT +22°',
          type: 'planet',
          azimuthDeg: 104.2,
          altitudeDeg: 22.4,
        },
        {
          id: 'saturn',
          label: 'SATURN',
          sublabel: 'ALT +42°',
          type: 'planet',
          azimuthDeg: 142.3,
          altitudeDeg: 41.8,
        },
        {
          id: 'iss',
          label: 'ISS',
          sublabel: 'PASS 22:14 UTC',
          type: 'iss',
          azimuthDeg: 142.0,
          altitudeDeg: 68.4,
        },
      ],
    },
    availability: {
      brief: 'ok',
      skyAnchor: 'ok',
      iss: 'ok',
      spaceWeather: 'ok',
      neoImagery: 'ok',
    },
    ...overrides,
  };
}
