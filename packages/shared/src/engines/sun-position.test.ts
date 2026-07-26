import { describe, expect, it } from 'vitest';
import { mod } from '../math-utils';
import { julianDay, localSiderealTimeDeg } from './sky-dome';
import {
  isDarkEnoughForFaintStars,
  isDarkEnoughForIssOrAurora,
  sunAltitudeDeg,
  sunEquatorialPosition,
  sunHorizontalPosition,
} from './sun-position';

describe('sunEquatorialPosition', () => {
  it('matches the known J2000.0 solar position (RA ~281.3deg / Dec ~-23.0deg)', () => {
    // Well-documented reference: at the J2000.0 epoch the Sun sits near
    // RA 18h45m (~281.3deg), Dec ~-23.0deg (approaching the December solstice).
    const { raDeg, decDeg } = sunEquatorialPosition(2_451_545.0);
    expect(raDeg).toBeCloseTo(281.3, 0);
    expect(decDeg).toBeCloseTo(-23.0, 0);
  });
});

describe('sunAltitudeDeg', () => {
  it('places the sun at zenith (90deg) at its own subsolar point', () => {
    // By definition, the subsolar point observer (lat = sun's dec, lon chosen
    // so the hour angle is 0) always sees the sun directly overhead.
    const now = new Date('2000-01-01T12:00:00Z');
    const jd = julianDay(now);
    const { raDeg, decDeg } = sunEquatorialPosition(jd);
    const lstBase = localSiderealTimeDeg(jd, 0);
    const lonEastDeg = mod(raDeg - lstBase, 360);

    expect(sunAltitudeDeg(now, decDeg, lonEastDeg)).toBeCloseTo(90, 3);
  });
});

describe('sunHorizontalPosition', () => {
  it('exposes the azimuth the §3 transform already computes, and its altitude matches sunAltitudeDeg', () => {
    const now = new Date('2026-07-17T21:00:00Z');
    // Arbitrary fixture coordinates — this engine is generic over any lat/lon;
    // not tied to apps/web's DEFAULT_OBSERVER_LOCATION (Jammu since 2026-07-27).
    const latDeg = 34.08;
    const lonDeg = 74.8;

    const pos = sunHorizontalPosition(now, latDeg, lonDeg);

    // Altitude is identical to what sunAltitudeDeg returns — proving the
    // refactor is exposure-only, not a second computation path.
    expect(pos.altitudeDeg).toBe(sunAltitudeDeg(now, latDeg, lonDeg));
    // Azimuth is a real bearing in [0, 360).
    expect(Number.isFinite(pos.azimuthDeg)).toBe(true);
    expect(pos.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(pos.azimuthDeg).toBeLessThan(360);
  });

  it('puts the sun due south for an observer north of the subsolar point (hour angle 0)', () => {
    // With the sun on the observer's meridian (H=0) but the observer 20deg
    // north of the sun's declination, the sun sits due south (azimuth 180deg)
    // at altitude 70deg — a hand-verifiable geometric anchor for the azimuth.
    const now = new Date('2000-01-01T12:00:00Z');
    const jd = julianDay(now);
    const { raDeg, decDeg } = sunEquatorialPosition(jd);
    const subsolarLonEastDeg = mod(raDeg - localSiderealTimeDeg(jd, 0), 360);

    const pos = sunHorizontalPosition(now, decDeg + 20, subsolarLonEastDeg);
    expect(pos.altitudeDeg).toBeCloseTo(70, 3);
    expect(pos.azimuthDeg).toBeCloseTo(180, 3);
  });
});

describe('isDarkEnoughForIssOrAurora', () => {
  it('is false at exactly the -6deg threshold (strict less-than)', () => {
    expect(isDarkEnoughForIssOrAurora(-6)).toBe(false);
  });

  it('is true just past the -6deg threshold', () => {
    expect(isDarkEnoughForIssOrAurora(-6.01)).toBe(true);
  });
});

describe('isDarkEnoughForFaintStars', () => {
  it('is false at exactly the -18deg threshold (strict less-than)', () => {
    expect(isDarkEnoughForFaintStars(-18)).toBe(false);
  });

  it('is true just past the -18deg threshold', () => {
    expect(isDarkEnoughForFaintStars(-18.01)).toBe(true);
  });
});
