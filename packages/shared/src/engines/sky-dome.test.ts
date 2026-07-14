import { describe, expect, it } from 'vitest';
import { equatorialToHorizontal, julianDay, localSiderealTimeDeg } from './sky-dome';

describe('julianDay', () => {
  it('matches the well-known J2000.0 epoch (2000-01-01T12:00:00Z -> JD 2451545.0)', () => {
    expect(julianDay(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(2_451_545.0, 6);
  });

  it('matches the Unix epoch (1970-01-01T00:00:00Z -> JD 2440587.5)', () => {
    expect(julianDay(new Date('1970-01-01T00:00:00Z'))).toBeCloseTo(2_440_587.5, 6);
  });
});

describe('localSiderealTimeDeg', () => {
  it('reduces to the base GMST term at JD2000.0, lon=0', () => {
    // d_UT1 = 0, so LST = 280.4606 mod 360.
    expect(localSiderealTimeDeg(2_451_545.0, 0)).toBeCloseTo(280.4606, 6);
  });

  it('wraps into [0, 360) for a longitude that pushes it over', () => {
    const lst = localSiderealTimeDeg(2_451_545.0, 100);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(360);
    expect(lst).toBeCloseTo((280.4606 + 100) % 360, 6);
  });
});

describe('equatorialToHorizontal', () => {
  it('places a star straight at zenith when dec == observer latitude and H == 0', () => {
    // At J2000.0 with lon chosen so LST == RA (H = 0), and dec = lat = 45.
    const jd = 2_451_545.0;
    const lst = localSiderealTimeDeg(jd, 0);
    const raDeg = lst; // forces H = LST - RA = 0
    const { altitudeDeg } = equatorialToHorizontal(raDeg, 45, 45, 0, jd);
    expect(altitudeDeg).toBeCloseTo(90, 6);
  });

  it('gives due-south azimuth (180 deg) for an object on the meridian south of zenith', () => {
    const jd = 2_451_545.0;
    const lst = localSiderealTimeDeg(jd, 0);
    const raDeg = lst; // H = 0 -> object on the meridian
    const { altitudeDeg, azimuthDeg } = equatorialToHorizontal(raDeg, 0, 45, 0, jd);
    expect(altitudeDeg).toBeCloseTo(45, 6);
    expect(azimuthDeg).toBeCloseTo(180, 6);
  });

  it('reduces altitude to declination at the north pole, independent of hour angle', () => {
    // At lat=90, sin(alt) = sin(dec)*1 + cos(dec)*0*cos(H) = sin(dec), for any H.
    const jd = 2_451_545.0;
    const { altitudeDeg: altAtH0 } = equatorialToHorizontal(30, 20, 90, 0, jd);
    const { altitudeDeg: altAtH100 } = equatorialToHorizontal(130, 20, 90, 0, jd);
    expect(altAtH0).toBeCloseTo(20, 6);
    expect(altAtH100).toBeCloseTo(20, 6);
  });
});
