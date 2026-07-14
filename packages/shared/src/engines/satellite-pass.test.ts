import { describe, expect, it } from 'vitest';
import { R_EARTH_KM } from '../constants';
import { isSatelliteSunlit, isVisiblePass } from './satellite-pass';

const SUN_DIRECTION = { x: 1, y: 0, z: 0 };

describe('isSatelliteSunlit', () => {
  it('is sunlit on the day side of Earth (r dot s_hat >= 0)', () => {
    expect(isSatelliteSunlit({ x: 10_000, y: 0, z: 0 }, SUN_DIRECTION)).toBe(true);
  });

  it('is in shadow when directly behind Earth at typical ISS altitude (~6771 km geocentric)', () => {
    const issAltitudeGeocentric = R_EARTH_KM + 400;
    expect(isSatelliteSunlit({ x: -issAltitudeGeocentric, y: 0, z: 0 }, SUN_DIRECTION)).toBe(false);
  });

  it('is sunlit on the night side if offset far enough to clear the shadow cylinder', () => {
    // Night-side (r dot s_hat < 0) but perpendicular offset (10,000 km) exceeds R_EARTH.
    expect(isSatelliteSunlit({ x: -10_000, y: 10_000, z: 0 }, SUN_DIRECTION)).toBe(true);
  });

  it('is sunlit exactly at the shadow-cylinder edge (perpendicular distance == R_EARTH, strict <)', () => {
    expect(isSatelliteSunlit({ x: -1000, y: R_EARTH_KM, z: 0 }, SUN_DIRECTION)).toBe(true);
  });
});

describe('isVisiblePass', () => {
  const sunlitPosition = { x: 10_000, y: 0, z: 0 };
  const eclipsedPosition = { x: -(R_EARTH_KM + 400), y: 0, z: 0 };

  it('is visible when all three conditions hold', () => {
    expect(isVisiblePass(45, -10, sunlitPosition, SUN_DIRECTION)).toBe(true);
  });

  it('rejects elevation exactly at the 10deg threshold minus an epsilon', () => {
    expect(isVisiblePass(9.99, -10, sunlitPosition, SUN_DIRECTION)).toBe(false);
  });

  it('accepts elevation exactly at the 10deg threshold (inclusive >=)', () => {
    expect(isVisiblePass(10, -10, sunlitPosition, SUN_DIRECTION)).toBe(true);
  });

  it('rejects when the observer is not yet in darkness (sun_alt exactly -6, strict <)', () => {
    expect(isVisiblePass(45, -6, sunlitPosition, SUN_DIRECTION)).toBe(false);
  });

  it('accepts when the observer is just past the darkness threshold', () => {
    expect(isVisiblePass(45, -6.01, sunlitPosition, SUN_DIRECTION)).toBe(true);
  });

  it('rejects when the satellite itself is eclipsed, even if elevation/darkness are fine', () => {
    expect(isVisiblePass(45, -10, eclipsedPosition, SUN_DIRECTION)).toBe(false);
  });
});
