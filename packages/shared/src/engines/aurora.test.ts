import { describe, expect, it } from 'vitest';
import {
  auroralOvalBoundaryDeg,
  auroraStrengthToFactor,
  auroraVisibility,
  geomagneticLatitudeDeg,
} from './aurora';

describe('geomagneticLatitudeDeg', () => {
  it('returns exactly 90deg when the observer stands at the geomagnetic pole itself', () => {
    // phi == phi_p, theta == theta_p -> sin(lambda_m) = sin^2(phi_p) + cos^2(phi_p) = 1.
    expect(geomagneticLatitudeDeg(80.7, -72.8)).toBeCloseTo(90, 6);
  });
});

describe('auroralOvalBoundaryDeg', () => {
  it('is 66deg at Kp=0 and 48deg at Kp=9, per lambda_b = 66 - 2*Kp', () => {
    expect(auroralOvalBoundaryDeg(0)).toBe(66);
    expect(auroralOvalBoundaryDeg(9)).toBe(48);
  });
});

describe('auroraVisibility', () => {
  it('kp_zero_no_aurora_at_equator', () => {
    // At Kp=0, boundary-margin = 66-4 = 62deg geomagnetic. The equator's
    // geomagnetic latitude (even near the pole's own meridian) is only a
    // few degrees, nowhere near 62 -- no aurora, by a wide margin.
    const result = auroraVisibility(0, 0, 0);
    expect(result.visible).toBe(false);
    expect(result.strength).toBeLessThan(0);
  });

  it('kp_nine_aurora_visible_at_mid_latitude', () => {
    // Kp=9, observer at 45N directly under the geomagnetic pole's meridian
    // (lon = pole's lon, so cos(theta-theta_p)=1 and lambda_m simplifies to
    // 90 - angular separation from the pole): lambda_m ~= 54.3deg.
    // boundary - margin = 48 - 4 = 44deg. 54.3 >= 44 -> visible.
    // This matches real reports of the Kp9 October 2024 storm being seen
    // down to mid-US latitudes.
    const result = auroraVisibility(45, -72.8, 9);
    expect(result.visible).toBe(true);
    expect(result.strength).toBeGreaterThan(0);
    expect(geomagneticLatitudeDeg(45, -72.8)).toBeCloseTo(54.3, 0);
  });

  it('observer_at_geomagnetic_pole', () => {
    // Numerical-stability case: sin(lambda_m) can float-round to slightly
    // above 1 without the clamp in geomagneticLatitudeDeg, which would make
    // asin() return NaN. Confirm it resolves cleanly to a visible result
    // for any Kp, since 90deg always clears the boundary-margin (max 62deg at Kp=0).
    const result = auroraVisibility(80.7, -72.8, 0);
    expect(Number.isNaN(result.strength)).toBe(false);
    expect(result.visible).toBe(true);
  });

  it('a higher Kp widens visibility at a fixed mid-latitude', () => {
    const lowKp = auroraVisibility(45, -72.8, 3);
    const highKp = auroraVisibility(45, -72.8, 9);
    expect(highKp.strength).toBeGreaterThan(lowKp.strength);
  });
});

describe('auroraStrengthToFactor', () => {
  it('is 0 at strength=0 (exactly at the visibility threshold)', () => {
    expect(auroraStrengthToFactor(0)).toBe(0);
  });

  it('is 1 at strength=20 (the saturation point)', () => {
    expect(auroraStrengthToFactor(20)).toBe(1);
  });

  it('is 0.5 at strength=10 (linear midpoint)', () => {
    expect(auroraStrengthToFactor(10)).toBe(0.5);
  });

  it('clamps to 1 past saturation, e.g. strength=30', () => {
    expect(auroraStrengthToFactor(30)).toBe(1);
  });

  it('clamps negative input to 0 (precondition: only called when visible)', () => {
    expect(auroraStrengthToFactor(-5)).toBe(0);
  });
});
