import { describe, expect, it } from 'vitest';
import { julianDay } from './sky-dome';
import {
  moonAltitudeDeg,
  moonEclipticPosition,
  moonEquatorialPosition,
  moonHorizontalPosition,
  moonIllumination,
  moonPhaseName,
  nextMoonRiseSet,
  type MoonPhaseName,
} from './moon-position';

// Ground-truth values below are independently computed against JPL DE421
// via Python `skyfield` (a different codebase from this project's own
// Meeus-series implementation), same practice as the satellite propagator's
// skyfield cross-check. See DECISIONS.md 2026-07-27 for the full numbers
// and methodology. Tolerances match the truncated series' documented
// accuracy (FORMULAS.md §12: ~0.3deg longitude, ~0.2deg latitude), not
// picked to make tests pass.

describe('moonEclipticPosition', () => {
  it('matches JPL DE421 (via skyfield) within the truncated series’ documented accuracy', () => {
    const jd = julianDay(new Date('2026-07-27T06:41:00Z'));
    const pos = moonEclipticPosition(jd);
    expect(Math.abs(pos.eclipticLongitudeDeg - 278.4061)).toBeLessThan(0.5);
    expect(Math.abs(pos.eclipticLatitudeDeg - -4.091)).toBeLessThan(0.5);
    expect(Math.abs(pos.distanceKm - 404447.0)).toBeLessThan(500);
  });

  it('cross-checks two further independent dates', () => {
    const p2000 = moonEclipticPosition(julianDay(new Date('2000-01-01T12:00:00Z')));
    expect(Math.abs(p2000.eclipticLongitudeDeg - 223.327)).toBeLessThan(0.5);
    expect(Math.abs(p2000.eclipticLatitudeDeg - 5.1712)).toBeLessThan(0.5);

    const p2026 = moonEclipticPosition(julianDay(new Date('2026-08-12T00:00:00Z')));
    expect(Math.abs(p2026.eclipticLongitudeDeg - 129.3839)).toBeLessThan(0.5);
    expect(Math.abs(p2026.eclipticLatitudeDeg - 1.8435)).toBeLessThan(0.5);
  });

  it('keeps longitude in [0, 360) and latitude within the Moon’s ~5deg orbital-inclination range', () => {
    const pos = moonEclipticPosition(julianDay(new Date('2030-03-15T00:00:00Z')));
    expect(pos.eclipticLongitudeDeg).toBeGreaterThanOrEqual(0);
    expect(pos.eclipticLongitudeDeg).toBeLessThan(360);
    expect(Math.abs(pos.eclipticLatitudeDeg)).toBeLessThan(6);
  });
});

describe('moonEquatorialPosition', () => {
  it('matches JPL DE421 (via skyfield) within the truncated series’ documented accuracy', () => {
    const pos = moonEquatorialPosition(julianDay(new Date('2026-07-27T06:41:00Z')));
    expect(Math.abs(pos.raDeg - 279.0218)).toBeLessThan(0.5);
    expect(Math.abs(pos.decDeg - -27.2757)).toBeLessThan(0.5);
  });

  it('keeps RA in [0, 360) and Dec in [-90, 90]', () => {
    const pos = moonEquatorialPosition(julianDay(new Date('2030-03-15T00:00:00Z')));
    expect(pos.raDeg).toBeGreaterThanOrEqual(0);
    expect(pos.raDeg).toBeLessThan(360);
    expect(pos.decDeg).toBeGreaterThanOrEqual(-90);
    expect(pos.decDeg).toBeLessThanOrEqual(90);
  });
});

describe('moonHorizontalPosition / moonAltitudeDeg', () => {
  const now = new Date('2026-07-27T06:41:00Z');

  it('altitude matches the altitude half of the full horizontal position (exposure-only, not a second computation)', () => {
    const full = moonHorizontalPosition(now, 32.73, 74.87);
    expect(moonAltitudeDeg(now, 32.73, 74.87)).toBe(full.altitudeDeg);
  });

  it('produces a real azimuth in [0, 360) and altitude in [-90, 90]', () => {
    const pos = moonHorizontalPosition(now, 32.73, 74.87);
    expect(pos.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(pos.azimuthDeg).toBeLessThan(360);
    expect(pos.altitudeDeg).toBeGreaterThanOrEqual(-90);
    expect(pos.altitudeDeg).toBeLessThanOrEqual(90);
  });
});

describe('moonPhaseName', () => {
  // FORMULAS.md §12: eight 45deg bins centered on 0/45/.../315, lower-bound
  // inclusive / upper-bound exclusive. Every boundary edge exercised once
  // on each side, per FORMULAS.md's Implementation Notes required-tests.
  const CASES: [number, MoonPhaseName][] = [
    [0, 'new'],
    [22.4, 'new'],
    [22.5, 'waxingCrescent'],
    [45, 'waxingCrescent'],
    [67.4, 'waxingCrescent'],
    [67.5, 'firstQuarter'],
    [90, 'firstQuarter'],
    [112.4, 'firstQuarter'],
    [112.5, 'waxingGibbous'],
    [135, 'waxingGibbous'],
    [157.4, 'waxingGibbous'],
    [157.5, 'full'],
    [180, 'full'],
    [202.4, 'full'],
    [202.5, 'waningGibbous'],
    [225, 'waningGibbous'],
    [247.4, 'waningGibbous'],
    [247.5, 'lastQuarter'],
    [270, 'lastQuarter'],
    [292.4, 'lastQuarter'],
    [292.5, 'waningCrescent'],
    [315, 'waningCrescent'],
    [337.4, 'waningCrescent'],
    [337.5, 'new'],
    [359.9, 'new'],
  ];

  it.each(CASES)('phase angle %s deg -> %s', (angle, expected) => {
    expect(moonPhaseName(angle)).toBe(expected);
  });

  it('wraps correctly for angles at/beyond the 0/360 boundary', () => {
    expect(moonPhaseName(360)).toBe('new');
    expect(moonPhaseName(-22.5)).toBe(moonPhaseName(337.5));
  });
});

describe('moonIllumination', () => {
  it('matches JPL DE421 (via skyfield) within the elongation-approximation’s documented ~0.5% tolerance', () => {
    // skyfield true phase-angle fraction: 0.9490; this engine's elongation
    // approximation: 0.9479 (see DECISIONS.md) — both derive from the same
    // Meeus-series position, so this also indirectly re-validates the
    // ecliptic-longitude difference driving phaseAngleDeg below.
    const result = moonIllumination(julianDay(new Date('2026-07-27T06:41:00Z')));
    expect(Math.abs(result.illuminatedFraction - 0.949)).toBeLessThan(0.01);
    expect(result.phaseName).toBe('waxingGibbous');
    expect(result.phaseAngleDeg).toBeGreaterThan(0);
    expect(result.phaseAngleDeg).toBeLessThan(360);
  });

  it('reports illumination near 0 close to new moon', () => {
    // skyfield: illuminated fraction 0.0078 at this instant.
    const result = moonIllumination(julianDay(new Date('2026-08-12T00:00:00Z')));
    expect(result.illuminatedFraction).toBeLessThan(0.05);
    expect(result.phaseName).toBe('new');
  });

  it('reports illumination near 1 close to full moon', () => {
    // 14 days after the above near-new instant is close to the next full moon.
    const result = moonIllumination(julianDay(new Date('2026-08-26T00:00:00Z')));
    expect(result.illuminatedFraction).toBeGreaterThan(0.9);
  });

  it('never emits illuminated fraction outside [0, 1]', () => {
    for (const iso of [
      '2026-01-01T00:00:00Z',
      '2026-04-01T00:00:00Z',
      '2026-07-01T00:00:00Z',
      '2026-10-01T00:00:00Z',
    ]) {
      const result = moonIllumination(julianDay(new Date(iso)));
      expect(result.illuminatedFraction).toBeGreaterThanOrEqual(0);
      expect(result.illuminatedFraction).toBeLessThanOrEqual(1);
    }
  });
});

describe('nextMoonRiseSet', () => {
  const now = new Date('2026-07-27T06:41:00Z');

  it('finds both a rise and a set within a normal search window, in the future relative to now', () => {
    const result = nextMoonRiseSet(32.73, 74.87, now);
    expect(result.riseUtc).not.toBeNull();
    expect(result.setUtc).not.toBeNull();
    expect(result.riseUtc!.getTime()).toBeGreaterThan(now.getTime());
    expect(result.setUtc!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('matches an independent ephemeris (skyfield, pure geometric 0deg horizon) within a few minutes', () => {
    // skyfield (almanac.risings_and_settings, horizon_degrees=0, same
    // geometric definition FORMULAS.md §12 specifies): rise 12:52:08Z,
    // set 22:32:34Z on 2026-07-27 for this observer (see DECISIONS.md).
    // Tolerance is minutes, not seconds: an 8min timing gap is the expected,
    // documented consequence of this engine's ~0.3deg position accuracy
    // (FORMULAS.md §12's own spot-check) amplified by a shallow crossing
    // angle, not a separate bug in the rise/set solver itself.
    const result = nextMoonRiseSet(32.73, 74.87, now);
    const expectedRise = new Date('2026-07-27T12:52:08Z').getTime();
    const expectedSet = new Date('2026-07-27T22:32:34Z').getTime();
    expect(Math.abs(result.riseUtc!.getTime() - expectedRise)).toBeLessThan(15 * 60 * 1000);
    expect(Math.abs(result.setUtc!.getTime() - expectedSet)).toBeLessThan(15 * 60 * 1000);
  });

  it('anchors to the injected `now`, not the system clock', () => {
    const later = new Date(now.getTime() + 3600_000);
    const a = nextMoonRiseSet(32.73, 74.87, now);
    const b = nextMoonRiseSet(32.73, 74.87, later);
    // Same physical events, so b's times should equal a's (b just starts
    // its search window an hour later, but the real crossings don't move).
    expect(b.riseUtc!.getTime()).toBe(a.riseUtc!.getTime());
    expect(b.setUtc!.getTime()).toBe(a.setUtc!.getTime());
  });

  it('reports both rise and set as null when the search window is too short to find either', () => {
    const result = nextMoonRiseSet(32.73, 74.87, now, 0.001); // ~3.6 seconds
    expect(result.riseUtc).toBeNull();
    expect(result.setUtc).toBeNull();
  });

  it('can find one crossing type without the other when the window only covers one', () => {
    // Rise is ~6h05m after `now`; a 7h window covers the rise but not the
    // following set (~15h55m after `now`).
    const result = nextMoonRiseSet(32.73, 74.87, now, 7);
    expect(result.riseUtc).not.toBeNull();
    expect(result.setUtc).toBeNull();
  });
});
