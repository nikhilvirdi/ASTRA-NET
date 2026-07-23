import { describe, expect, it } from 'vitest';
import {
  equatorialToHorizontal,
  julianDay,
  localSiderealTimeDeg,
  mod,
  sunEquatorialPosition,
  sunHorizontalPosition,
} from '@astranet/shared';
import { buildSkyAnchorCard, classifyTwilightPhase } from './sky-anchor-card';
import type { HorizonsRaDecData } from '../clients/jpl-horizons/index.js';
import type { SourceState } from '../poller/store.js';

const NO_JUPITER: SourceState<HorizonsRaDecData> = {
  data: null,
  fetchedAt: null,
  healthy: false,
};

function jupiterState(
  entries: HorizonsRaDecData['entries'],
  fetchedAt = '2026-07-17T00:00:00.000Z',
): SourceState<HorizonsRaDecData> {
  return { data: { entries, fetchedAt }, fetchedAt, healthy: true };
}

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
  it('never throws and always returns a resolved card, even with no Jupiter ephemeris', () => {
    const card = buildSkyAnchorCard(999, 999, new Date('2026-07-17T00:00:00Z'), NO_JUPITER);
    expect(card).toBeDefined();
    expect(Number.isFinite(card.sunAltitudeDeg)).toBe(true);
    expect(card.jupiter).toBeNull();
  });

  it('exposes the Sun azimuth alongside its altitude, from the same §3 horizontal position', () => {
    const now = new Date('2026-07-17T21:00:00Z');
    const latDeg = 34.08;
    const lonDeg = 74.8;

    const card = buildSkyAnchorCard(latDeg, lonDeg, now, NO_JUPITER);
    const expected = sunHorizontalPosition(now, latDeg, lonDeg);

    // Both halves come from the one Sun-position call — never null (pure math,
    // no external source), and the azimuth is a real bearing in [0, 360).
    expect(card.sunAltitudeDeg).toBe(expected.altitudeDeg);
    expect(card.sunAzimuthDeg).toBe(expected.azimuthDeg);
    expect(card.sunAzimuthDeg).toBeGreaterThanOrEqual(0);
    expect(card.sunAzimuthDeg).toBeLessThan(360);
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

    const card = buildSkyAnchorCard(decDeg, lonEastDeg, now, NO_JUPITER);
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

    const card = buildSkyAnchorCard(antipodalLatDeg, antipodalLonEastDeg, now, NO_JUPITER);
    expect(card.sunAltitudeDeg).toBeCloseTo(-90, 3);
    expect(card.twilightPhase).toBe('night');
    expect(card.isDarkEnoughForIssOrAurora).toBe(true);
    expect(card.isDarkEnoughForFaintStars).toBe(true);
  });

  it("computes Jupiter's alt/az by running the ephemeris RA/Dec through the shared FORMULAS.md §3 transform", () => {
    const now = new Date('2026-07-17T21:00:00Z');
    const latDeg = 34.08;
    const lonDeg = 74.8;
    const entry = { timestampUtcMs: now.getTime(), raDeg: 129.42611, decDeg: 18.09309 };

    const card = buildSkyAnchorCard(latDeg, lonDeg, now, jupiterState([entry]));

    const expected = equatorialToHorizontal(
      entry.raDeg,
      entry.decDeg,
      latDeg,
      lonDeg,
      julianDay(now),
    );
    expect(card.jupiter).toEqual(expected);
  });

  it('picks the ephemeris row nearest to now, regardless of row order', () => {
    const now = new Date('2026-07-17T21:20:00Z');
    const farEntry = {
      timestampUtcMs: now.getTime() + 5 * 3_600_000,
      raDeg: 200,
      decDeg: -5,
    };
    const nearEntry = {
      timestampUtcMs: now.getTime() - 20 * 60_000,
      raDeg: 129.4,
      decDeg: 18.1,
    };

    const card = buildSkyAnchorCard(34.08, 74.8, now, jupiterState([farEntry, nearEntry]));

    const expected = equatorialToHorizontal(
      nearEntry.raDeg,
      nearEntry.decDeg,
      34.08,
      74.8,
      julianDay(now),
    );
    expect(card.jupiter).toEqual(expected);
  });

  it('degrades jupiter to null when the ephemeris has null entries', () => {
    const card = buildSkyAnchorCard(34.08, 74.8, new Date(), jupiterState(null));
    expect(card.jupiter).toBeNull();
    expect(Number.isFinite(card.sunAltitudeDeg)).toBe(true);
  });
});
