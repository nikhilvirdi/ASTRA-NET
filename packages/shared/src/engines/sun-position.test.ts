import { describe, expect, it } from 'vitest';
import { mod } from '../math-utils';
import { julianDay, localSiderealTimeDeg } from './sky-dome';
import {
  isDarkEnoughForFaintStars,
  isDarkEnoughForIssOrAurora,
  sunAltitudeDeg,
  sunEquatorialPosition,
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
