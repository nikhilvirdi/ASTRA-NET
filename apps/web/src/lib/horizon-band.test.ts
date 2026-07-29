/**
 * Horizon Band layout and culling (DESIGN_SPEC.md §9).
 *
 * Both blocks below cover defects that shipped and were invisible from the
 * component: a compass rose that disagreed with its own azimuths, and
 * markers drawn at positions their bodies were not in.
 */

import { describe, expect, it } from 'vitest';
import {
  COMPASS_POINTS,
  belongsOnBand,
  compassPointLeftPercent,
  formatAltitude,
  markerBandPosition,
} from './horizon-band';
import { HORIZON_REFRACTION_DEG } from './semantic-zoom';

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
    for (const point of COMPASS_POINTS) {
      expect(markerBandPosition(point.deg, 30).leftPercent).toBeCloseTo(
        compassPointLeftPercent(point.deg),
        10,
      );
    }
  });
});

describe('belongsOnBand', () => {
  it('admits bodies above the horizon', () => {
    expect(belongsOnBand(45)).toBe(true);
    expect(belongsOnBand(0)).toBe(true);
  });

  it('rejects bodies genuinely below it', () => {
    // The case that was being drawn on the horizon rule instead.
    expect(belongsOnBand(-14.2)).toBe(false);
    expect(belongsOnBand(-5)).toBe(false);
    expect(belongsOnBand(-90)).toBe(false);
  });

  it('allows the atmospheric refraction sliver, reusing the Explore threshold', () => {
    // Not a second, independently-invented threshold: this is the same
    // isAboveHorizon the 3D scene culls with, so the two surfaces cannot
    // disagree about what is visible.
    expect(belongsOnBand(-HORIZON_REFRACTION_DEG)).toBe(true);
    expect(belongsOnBand(-HORIZON_REFRACTION_DEG - 0.01)).toBe(false);
  });
});

describe('markerBandPosition', () => {
  it('maps the horizon to the bottom and the zenith to the top', () => {
    expect(markerBandPosition(0, 0).topPercent).toBe(100);
    expect(markerBandPosition(0, 90).topPercent).toBe(0);
    expect(markerBandPosition(0, 45).topPercent).toBeCloseTo(50, 10);
  });

  it('only ever clamps the refraction sliver, never a below-horizon body', () => {
    // Callers cull first, so the clamp cannot relocate anything real. A body
    // inside the refraction band is genuinely at the horizon.
    expect(markerBandPosition(0, -HORIZON_REFRACTION_DEG).topPercent).toBe(100);
    expect(belongsOnBand(-HORIZON_REFRACTION_DEG)).toBe(true);
  });
});

describe('formatAltitude', () => {
  it('reports the real altitude rather than flooring it to zero', () => {
    // The shipped sublabel used Math.max(0, alt), so a Jupiter at -5deg
    // announced "Alt 0°" — a measurement that was not taken.
    expect(formatAltitude(22.4)).toBe('Alt 22.4°');
    expect(formatAltitude(0)).toBe('Alt 0.0°');
  });

  it('keeps a decimal place, so a low body is not rounded to the horizon', () => {
    expect(formatAltitude(0.4)).toBe('Alt 0.4°');
  });
});
