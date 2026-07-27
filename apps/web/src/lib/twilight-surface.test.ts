import { describe, expect, it } from 'vitest';
import {
  computeSurfaceColor,
  computeSurfaceRGB,
  computeOnSurfaceRGB,
  contrastRatio,
} from './twilight-surface';

describe('twilight-surface', () => {
  it('returns Day surface (sky-100: rgb(238, 241, 241)) when value <= 0', () => {
    expect(computeSurfaceColor(0)).toBe('rgb(238, 241, 241)');
    expect(computeSurfaceColor(-1)).toBe('rgb(238, 241, 241)');
  });

  it('returns Civil twilight boundary surface (sky-400: rgb(139, 152, 152)) at value = 1', () => {
    expect(computeSurfaceColor(1)).toBe('rgb(139, 152, 152)');
  });

  it('returns Nautical twilight boundary surface (sky-600: rgb(62, 74, 74)) at value = 2', () => {
    expect(computeSurfaceColor(2)).toBe('rgb(62, 74, 74)');
  });

  it('returns Night surface (sky-900: rgb(17, 24, 24)) when value >= 3', () => {
    expect(computeSurfaceColor(3)).toBe('rgb(17, 24, 24)');
    expect(computeSurfaceColor(5)).toBe('rgb(17, 24, 24)');
  });

  it('interpolates surface linearly between boundaries', () => {
    expect(computeSurfaceColor(0.5)).toBe('rgb(189, 197, 197)');
  });

  describe('WCAG 2.1 AA Contrast Ratio Verification (DESIGN_SPEC.md L548)', () => {
    const boundaryPoints = [
      { name: 'Day boundary (v = 0.0)', value: 0.0 },
      { name: 'Civil twilight boundary (v = 1.0)', value: 1.0 },
      { name: 'Nautical twilight boundary (v = 2.0)', value: 2.0 },
      { name: 'Astronomical/Night boundary (v = 3.0)', value: 3.0 },
    ];

    const midpointPoints = [
      { name: 'Early Civil twilight midpoint (v = 0.25)', value: 0.25 },
      { name: 'Mid Civil twilight midpoint (v = 0.50)', value: 0.5 },
      { name: 'Late Civil twilight midpoint (v = 0.75)', value: 0.75 },
      { name: 'Early Nautical twilight midpoint (v = 1.25)', value: 1.25 },
      { name: 'Mid Nautical twilight transition point (v = 1.40)', value: 1.4 },
      { name: 'Mid Nautical twilight midpoint (v = 1.50)', value: 1.5 },
      { name: 'Late Nautical twilight midpoint (v = 1.75)', value: 1.75 },
      { name: 'Early Astronomical twilight midpoint (v = 2.25)', value: 2.25 },
      { name: 'Mid Astronomical twilight midpoint (v = 2.50)', value: 2.5 },
      { name: 'Late Astronomical twilight midpoint (v = 2.75)', value: 2.75 },
    ];

    boundaryPoints.forEach(({ name, value }) => {
      it(`meets WCAG AA (>= 4.5:1) contrast at boundary: ${name}`, () => {
        const surf = computeSurfaceRGB(value);
        const text = computeOnSurfaceRGB(value);
        const ratio = contrastRatio(surf, text);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    midpointPoints.forEach(({ name, value }) => {
      it(`meets WCAG AA (>= 4.5:1) contrast at midpoint: ${name}`, () => {
        const surf = computeSurfaceRGB(value);
        const text = computeOnSurfaceRGB(value);
        const ratio = contrastRatio(surf, text);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('meets WCAG AA (>= 4.5:1) contrast continuously across all step values from 0.0 to 3.0 in 0.05 increments', () => {
      for (let v = 0; v <= 3.01; v += 0.05) {
        const value = Math.round(v * 100) / 100;
        const surf = computeSurfaceRGB(value);
        const text = computeOnSurfaceRGB(value);
        const ratio = contrastRatio(surf, text);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
