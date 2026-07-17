import { describe, expect, it } from 'vitest';
import { julianDay, localSiderealTimeDeg, mod, sunEquatorialPosition } from '@astranet/shared';
import { buildSkyAnchorCard, classifyTwilightPhase } from './sky-anchor-card';

describe('classifyTwilightPhase', () => {
  it('is "day" at and above the -6deg threshold', () => {
    expect(classifyTwilightPhase(0)).toBe('day');
    expect(classifyTwilightPhase(-6)).toBe('day');
  });

  it('is "twilight" between -6deg (exclusive) and -18deg (inclusive)', () => {
    expect(classifyTwilightPhase(-6.01)).toBe('twilight');
    expect(classifyTwilightPhase(-18)).toBe('twilight');
  });

  it('is "night" below -18deg', () => {
    expect(classifyTwilightPhase(-18.01)).toBe('night');
    expect(classifyTwilightPhase(-90)).toBe('night');
  });
});

describe('buildSkyAnchorCard', () => {
  it('never throws and always returns a resolved card, given only lat/lon/now', () => {
    const card = buildSkyAnchorCard(999, 999, new Date('2026-07-17T00:00:00Z'));
    expect(card).toBeDefined();
    expect(Number.isFinite(card.sunAltitudeDeg)).toBe(true);
  });

  it('reports "day" for an observer at the subsolar point (sun at zenith)', () => {
    // Same construction as sun-position.test.ts's own subsolar-point anchor:
    // an observer at lat = sun's declination, with longitude chosen so the
    // hour angle is 0, always sees the sun directly overhead.
    const now = new Date('2000-01-01T12:00:00Z');
    const jd = julianDay(now);
    const { raDeg, decDeg } = sunEquatorialPosition(jd);
    const lstBase = localSiderealTimeDeg(jd, 0);
    const lonEastDeg = mod(raDeg - lstBase, 360);

    const card = buildSkyAnchorCard(decDeg, lonEastDeg, now);
    expect(card.sunAltitudeDeg).toBeCloseTo(90, 3);
    expect(card.twilightPhase).toBe('day');
    expect(card.isDarkEnoughForIssOrAurora).toBe(false);
    expect(card.isDarkEnoughForFaintStars).toBe(false);
  });

  it('reports "night" for the antipodal observer (sun at nadir)', () => {
    const now = new Date('2000-01-01T12:00:00Z');
    const jd = julianDay(now);
    const { raDeg, decDeg } = sunEquatorialPosition(jd);
    const lstBase = localSiderealTimeDeg(jd, 0);
    const subsolarLonEastDeg = mod(raDeg - lstBase, 360);

    // Antipodal point: opposite latitude, longitude rotated 180deg.
    const antipodalLatDeg = -decDeg;
    const antipodalLonEastDeg = mod(subsolarLonEastDeg + 180, 360);

    const card = buildSkyAnchorCard(antipodalLatDeg, antipodalLonEastDeg, now);
    expect(card.sunAltitudeDeg).toBeCloseTo(-90, 3);
    expect(card.twilightPhase).toBe('night');
    expect(card.isDarkEnoughForIssOrAurora).toBe(true);
    expect(card.isDarkEnoughForFaintStars).toBe(true);
  });
});
