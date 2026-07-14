import { describe, expect, it } from 'vitest';
import {
  bvFromGaiaBpRp,
  colorTemperatureKelvin,
  distanceFromParallaxPc,
  starBrightness,
  starCartesianPosition,
  starPointSize,
  yearsAgo,
} from './star-position';

describe('distanceFromParallaxPc', () => {
  it('handles_negative_parallax', () => {
    // FORMULAS.md §1 decision: negative parallax is invalid -> pinned to the 100 kpc shell.
    expect(distanceFromParallaxPc(-5)).toBe(100_000);
  });

  it('handles_parallax_below_0.2mas', () => {
    // FORMULAS.md §1 decision: parallax_mas <= 0.2 is invalid -> pinned to the 100 kpc shell.
    expect(distanceFromParallaxPc(0.1)).toBe(100_000);
    expect(distanceFromParallaxPc(0.2)).toBe(100_000);
  });

  it('computes distance for a valid parallax (Proxima Centauri, ~768.5 mas -> ~1.30 pc)', () => {
    expect(distanceFromParallaxPc(768.5)).toBeCloseTo(1.301, 2);
  });
});

describe('starCartesianPosition', () => {
  it('places a star on the RA=0, Dec=0 axis at its distance', () => {
    const pos = starCartesianPosition({ raRad: 0, decRad: 0 }, 10);
    expect(pos.x).toBeCloseTo(10, 10);
    expect(pos.y).toBeCloseTo(0, 10);
    expect(pos.z).toBeCloseTo(0, 10);
  });

  it('places a star at the pole (Dec=90 deg) purely on the z-axis', () => {
    const pos = starCartesianPosition({ raRad: Math.PI / 3, decRad: Math.PI / 2 }, 5);
    expect(pos.x).toBeCloseTo(0, 10);
    expect(pos.y).toBeCloseTo(0, 10);
    expect(pos.z).toBeCloseTo(5, 10);
  });
});

describe('yearsAgo', () => {
  it('converts parsec distance to light-travel years', () => {
    expect(yearsAgo(1)).toBeCloseTo(3.26156, 5);
  });
});

describe('starBrightness', () => {
  it('is 1.0 exactly at the reference magnitude (m_ref = 6.0)', () => {
    expect(starBrightness(6.0)).toBeCloseTo(1, 10);
  });

  it('clamps bright stars (low/negative magnitude) to 1.0', () => {
    // Sirius, m ~= -1.46 -- far brighter than the m_ref=6 reference point.
    expect(starBrightness(-1.46)).toBe(1);
  });

  it('produces sub-1 brightness for a faint star past the reference magnitude', () => {
    expect(starBrightness(10)).toBeCloseTo(10 ** (-0.4 * 4), 10);
  });
});

describe('starPointSize', () => {
  it('returns the base size unchanged at the limiting magnitude (6.5)', () => {
    expect(starPointSize(10, 6.5)).toBeCloseTo(10, 10);
  });

  it('scales up point size for brighter (lower-magnitude) stars', () => {
    expect(starPointSize(10, 0)).toBeCloseTo(32.75, 6);
  });
});

describe('bvFromGaiaBpRp / colorTemperatureKelvin', () => {
  it('converts Gaia bp_rp to B-V', () => {
    expect(bvFromGaiaBpRp(1)).toBeCloseTo(0.85, 10);
  });

  it('matches the Sun (B-V ~= 0.65) to its known ~5778K effective temperature', () => {
    expect(colorTemperatureKelvin(0.65)).toBeCloseTo(5778, -1);
  });
});
