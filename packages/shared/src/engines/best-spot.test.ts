import { describe, expect, it } from 'vitest';
import {
  bestSpotScore,
  bestSpotScoreAurora,
  clarityFromCloudFraction,
  darknessFromBortle,
  travelDecay,
} from './best-spot';

describe('clarityFromCloudFraction', () => {
  it('is 1.0 at zero cloud cover and 0.0 at total overcast', () => {
    expect(clarityFromCloudFraction(0)).toBe(1);
    expect(clarityFromCloudFraction(1)).toBe(0);
  });
});

describe('darknessFromBortle', () => {
  it('is 1.0 at Bortle 1 (darkest) and 0.0 at Bortle 9 (brightest)', () => {
    expect(darknessFromBortle(1)).toBe(1);
    expect(darknessFromBortle(9)).toBe(0);
  });
});

describe('travelDecay', () => {
  it('is 1.0 at zero distance', () => {
    expect(travelDecay(0)).toBe(1);
  });

  it('travel_decay_at_large_distance', () => {
    expect(travelDecay(1000)).toBeLessThan(1e-5);
  });
});

describe('bestSpotScore', () => {
  it('zero_clarity_kills_score', () => {
    // Total overcast (cloud_fraction=1) zeros the score regardless of how
    // dark or close the site otherwise is.
    expect(bestSpotScore(1, 1, 0)).toBe(0);
  });

  it('zero_darkness_kills_score', () => {
    // Bortle 9 (brightest possible sky) zeros the score regardless of
    // clarity or distance.
    expect(bestSpotScore(0, 9, 0)).toBe(0);
  });

  it('multiplies all three factors for a genuinely good spot', () => {
    // clarity=1 (no cloud), darkness=1 (Bortle 1), distance=0 -> travel=1.
    expect(bestSpotScore(0, 1, 0)).toBeCloseTo(1, 10);
  });
});

describe('bestSpotScoreAurora', () => {
  it('multiplies the base score by the normalized aurora factor', () => {
    expect(bestSpotScoreAurora(0.5, 0.4)).toBeCloseTo(0.2, 10);
  });

  it('zeroes out when the aurora factor is 0 (not visible)', () => {
    expect(bestSpotScoreAurora(0.9, 0)).toBe(0);
  });
});
