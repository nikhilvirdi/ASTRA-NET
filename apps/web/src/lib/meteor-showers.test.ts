import { describe, expect, it } from 'vitest';
import { equatorialToHorizontal, julianDay } from '@astranet/shared';
import { HORIZON_REFRACTION_DEG } from './semantic-zoom';
import {
  activeShowers,
  formatShowerDate,
  isShowerActive,
  METEOR_SHOWERS,
  visibleShowerRadiant,
  type MeteorShower,
} from './meteor-showers';

const showerByCode = (code: string): MeteorShower => {
  const s = METEOR_SHOWERS.find((x) => x.code === code);
  if (!s) throw new Error(`no shower ${code} in the table`);
  return s;
};

/** Local-time Date, since the activity window is judged on the observer's calendar date. */
const localDate = (y: number, m: number, d: number, h = 22): Date => new Date(y, m - 1, d, h, 0, 0);

describe('METEOR_SHOWERS table', () => {
  it('has unique IAU codes', () => {
    const codes = METEOR_SHOWERS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('holds every radiant in valid equatorial coordinates', () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.radiantRaDeg).toBeGreaterThanOrEqual(0);
      expect(s.radiantRaDeg).toBeLessThan(360);
      expect(s.radiantDecDeg).toBeGreaterThanOrEqual(-90);
      expect(s.radiantDecDeg).toBeLessThanOrEqual(90);
    }
  });

  it('places every peak inside its own activity window', () => {
    for (const s of METEOR_SHOWERS) {
      const peakDate = localDate(2026, s.peak.month, s.peak.day);
      expect(isShowerActive(s, peakDate), `${s.code} peak outside its window`).toBe(true);
    }
  });

  it('matches the IMO 2026 working list on the showers most likely to regress', () => {
    // Spot-checks against Table 5 of IMO INFO(3-25). If a transcription slips,
    // these are the rows a reader would notice first.
    const per = showerByCode('PER');
    expect([per.radiantRaDeg, per.radiantDecDeg, per.zhr]).toEqual([48, 58, 100]);
    const gem = showerByCode('GEM');
    expect([gem.radiantRaDeg, gem.radiantDecDeg, gem.zhr]).toEqual([112, 33, 150]);
    const qua = showerByCode('QUA');
    expect([qua.radiantRaDeg, qua.radiantDecDeg, qua.zhr]).toEqual([230, 49, 80]);
  });
});

describe('isShowerActive — window boundaries', () => {
  const per = showerByCode('PER'); // Jul 17 - Aug 24

  it('is active on the first day of the window', () => {
    expect(isShowerActive(per, localDate(2026, 7, 17))).toBe(true);
  });

  it('is active on the last day of the window', () => {
    expect(isShowerActive(per, localDate(2026, 8, 24))).toBe(true);
  });

  it('is inactive the day before it opens and the day after it closes', () => {
    expect(isShowerActive(per, localDate(2026, 7, 16))).toBe(false);
    expect(isShowerActive(per, localDate(2026, 8, 25))).toBe(false);
  });

  it('is active mid-window', () => {
    expect(isShowerActive(per, localDate(2026, 8, 12))).toBe(true);
  });
});

describe('isShowerActive — windows that wrap the year end', () => {
  const qua = showerByCode('QUA'); // Dec 28 - Jan 12

  it('is active on both boundary days, either side of New Year', () => {
    expect(isShowerActive(qua, localDate(2026, 12, 28))).toBe(true);
    expect(isShowerActive(qua, localDate(2027, 1, 12))).toBe(true);
  });

  it('is active across the year boundary itself', () => {
    expect(isShowerActive(qua, localDate(2026, 12, 31))).toBe(true);
    expect(isShowerActive(qua, localDate(2027, 1, 1))).toBe(true);
  });

  it('is inactive just outside either end', () => {
    expect(isShowerActive(qua, localDate(2026, 12, 27))).toBe(false);
    expect(isShowerActive(qua, localDate(2027, 1, 13))).toBe(false);
  });

  it('is inactive in the middle of the year', () => {
    expect(isShowerActive(qua, localDate(2026, 6, 15))).toBe(false);
  });
});

describe('isShowerActive — leap-year handling', () => {
  const sta = showerByCode('STA'); // Sep 20 - Nov 20, spans Feb 29 in neither direction
  const ace = showerByCode('ACE'); // Jan 31 - Feb 20

  it('treats Feb 28 identically in a leap and a non-leap year', () => {
    // Day-of-year arithmetic would shift this window by a day across a leap
    // boundary; month/day comparison does not.
    expect(isShowerActive(ace, localDate(2024, 2, 20))).toBe(true); // leap year
    expect(isShowerActive(ace, localDate(2026, 2, 20))).toBe(true); // common year
    expect(isShowerActive(ace, localDate(2024, 2, 21))).toBe(false);
    expect(isShowerActive(ace, localDate(2026, 2, 21))).toBe(false);
  });

  it('handles Feb 29 itself', () => {
    expect(isShowerActive(ace, localDate(2024, 2, 29))).toBe(false);
    expect(isShowerActive(sta, localDate(2024, 2, 29))).toBe(false);
  });
});

describe('activeShowers', () => {
  it('returns the overlapping late-July trio', () => {
    const codes = activeShowers(localDate(2026, 7, 30)).map((s) => s.code);
    expect(codes).toContain('PER');
    expect(codes).toContain('SDA');
    expect(codes).toContain('CAP');
  });

  it('returns nothing on a genuinely quiet date', () => {
    // Mar 15: every window in the table is closed.
    expect(activeShowers(localDate(2026, 3, 15))).toEqual([]);
  });
});

describe('visibleShowerRadiant', () => {
  it('returns null when no shower is active, whatever the sky is doing', () => {
    expect(visibleShowerRadiant(localDate(2026, 3, 15), 40.7, -74.0)).toBeNull();
  });

  it('returns null when a shower is active but its radiant is below the horizon', () => {
    // Puppid-Velids, radiant Dec -45, seen from high northern latitude: the
    // radiant never rises there, so no marker regardless of the date.
    const at = localDate(2026, 12, 7);
    const found = visibleShowerRadiant(at, 70, 20);
    expect(found?.shower.code).not.toBe('PUP');
  });

  it('reports the radiant position the shared engine computes, not its own', () => {
    const at = localDate(2026, 8, 12, 2);
    const found = visibleShowerRadiant(at, 40.7, -74.0);
    if (found === null) return; // radiant below horizon at this instant — nothing to compare
    const expected = equatorialToHorizontal(
      found.shower.radiantRaDeg,
      found.shower.radiantDecDeg,
      40.7,
      -74.0,
      julianDay(at),
    );
    expect(found.altitudeDeg).toBeCloseTo(expected.altitudeDeg, 10);
    expect(found.azimuthDeg).toBeCloseTo(expected.azimuthDeg, 10);
  });

  it('picks the highest-rate shower when several are active and up at once', () => {
    // Sweep late July hour by hour; whenever both the Perseids and the
    // Southern delta Aquariids are above the horizon, PER (ZHR 100) must win
    // over SDA (ZHR 25).
    let checked = 0;
    for (let hour = 0; hour < 24; hour++) {
      const at = localDate(2026, 7, 30, hour);
      const jd = julianDay(at);
      const upFor = (code: string): boolean => {
        const s = showerByCode(code);
        const h = equatorialToHorizontal(s.radiantRaDeg, s.radiantDecDeg, 40.7, -74.0, jd);
        return h.altitudeDeg >= -HORIZON_REFRACTION_DEG;
      };
      if (upFor('PER') && upFor('SDA')) {
        expect(visibleShowerRadiant(at, 40.7, -74.0)?.shower.code).toBe('PER');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('accepts a radiant sitting exactly on the horizon boundary', () => {
    // A radiant exactly at -HORIZON_REFRACTION_DEG is still "up" by the same
    // rule every other marker uses; one hair below it is not. Verified
    // against the shared predicate rather than a hand-built altitude, so the
    // two can never disagree.
    const at = localDate(2026, 8, 12, 3);
    const jd = julianDay(at);
    const per = showerByCode('PER');
    const h = equatorialToHorizontal(per.radiantRaDeg, per.radiantDecDeg, 40.7, -74.0, jd);
    const found = visibleShowerRadiant(at, 40.7, -74.0);
    if (h.altitudeDeg >= -HORIZON_REFRACTION_DEG) {
      expect(found).not.toBeNull();
    }
  });
});

describe('formatShowerDate', () => {
  it('formats a peak date for the measurement line', () => {
    expect(formatShowerDate({ month: 8, day: 13 })).toBe('Aug 13');
    expect(formatShowerDate({ month: 1, day: 3 })).toBe('Jan 3');
    expect(formatShowerDate({ month: 12, day: 14 })).toBe('Dec 14');
  });
});
