/**
 * Horizon Band layout (DESIGN_SPEC.md §9).
 *
 * Covers a compass rose that shipped disagreeing with its own azimuths —
 * invisible from the component, because the table and the layout that drew
 * it were both inside unassertable JSX.
 */

import { describe, expect, it } from 'vitest';
import { COMPASS_POINTS, compassPointLeftPercent } from './horizon-band';

describe('COMPASS_POINTS', () => {
  it('names all eight principal points exactly once', () => {
    expect(COMPASS_POINTS.map((p) => p.label)).toEqual([
      'N',
      'NE',
      'E',
      'SE',
      'S',
      'SW',
      'W',
      'NW',
    ]);
  });

  it('includes NW, which was missing, and does not duplicate N', () => {
    // The shipped table read N,NE,E,SE,S,SW,W,N — NW absent, N twice at
    // 0deg and 360deg.
    const labels = COMPASS_POINTS.map((p) => p.label);
    expect(labels).toContain('NW');
    expect(labels.filter((l) => l === 'N').length).toBe(1);
  });

  it('spaces every point 45 degrees apart', () => {
    for (let i = 0; i < COMPASS_POINTS.length; i += 1) {
      expect(COMPASS_POINTS[i]!.deg).toBe(i * 45);
    }
  });

  it('stops before 360 so no point is drawn on top of N', () => {
    expect(Math.max(...COMPASS_POINTS.map((p) => p.deg))).toBe(315);
  });
});

describe('compassPointLeftPercent', () => {
  it('maps azimuth linearly across the band', () => {
    expect(compassPointLeftPercent(0)).toBe(0);
    expect(compassPointLeftPercent(90)).toBe(25);
    expect(compassPointLeftPercent(180)).toBe(50);
    expect(compassPointLeftPercent(315)).toBeCloseTo(87.5, 10);
  });

  it('places the marks at even 12.5% intervals', () => {
    // The old flexbox layout spaced eight items evenly while the last gap
    // covered 90deg of sky, so every mark from S rightward pointed at the
    // wrong azimuth. Positioning from `deg` is what makes this hold.
    const positions = COMPASS_POINTS.map((p) => compassPointLeftPercent(p.deg));
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]! - positions[i - 1]!).toBeCloseTo(12.5, 10);
    }
  });

  it('agrees with where a marker at the same azimuth is drawn', () => {
    // The whole point of the fix: a body due west must sit under the W mark.
    // The band draws markers at (azimuth / 360) * 100 percent.
    for (const point of COMPASS_POINTS) {
      expect((point.deg / 360) * 100).toBeCloseTo(compassPointLeftPercent(point.deg), 10);
    }
  });
});
