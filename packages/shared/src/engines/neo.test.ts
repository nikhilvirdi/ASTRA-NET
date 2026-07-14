import { describe, expect, it } from 'vitest';
import { missDistanceInLunarDistances, neoDiameterKm } from './neo';

describe('neoDiameterKm', () => {
  it('diameter_from_h_matches_reference_value', () => {
    // 99942 Apophis, H = 19.7 (JPL small-body database). Hand-derived via
    // FORMULAS.md §10: D = (1329/sqrt(0.14)) * 10^(-0.2*19.7)
    //   1329/sqrt(0.14) ~= 3551.9
    //   10^(-3.94) ~= 1.14818e-4
    //   D ~= 3551.9 * 1.14818e-4 ~= 0.408 km
    // (This is the formula's assumed-albedo estimate, not Apophis's measured
    // diameter -- its actual albedo differs from the assumed 0.14, which is
    // exactly why the formula is documented as an approximation.)
    expect(neoDiameterKm(19.7)).toBeCloseTo(0.408, 2);
  });
});

describe('missDistanceInLunarDistances', () => {
  it('converts exactly one lunar distance to 1.0 LD', () => {
    expect(missDistanceInLunarDistances(384_400)).toBeCloseTo(1.0, 10);
  });

  it('scales linearly with distance', () => {
    expect(missDistanceInLunarDistances(192_200)).toBeCloseTo(0.5, 10);
  });
});
