/**
 * Horizon Band layout and culling (DESIGN_SPEC.md §9 — curved dome arc).
 */

import { describe, expect, it } from 'vitest';
import {
  ARC_VIEW_HEIGHT,
  ARC_VIEW_WIDTH,
  COMPASS_POINTS,
  DEFAULT_SWEEP,
  ULTRAWIDE_SWEEP,
  arcBaselineY,
  arcFillPath,
  arcGridlinePath,
  azAltToArcPercent,
  azAltToArcPoint,
  azimuthFraction,
  belongsOnBand,
  formatAltitude,
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

  it('spaces every point 45 degrees apart', () => {
    for (let i = 0; i < COMPASS_POINTS.length; i += 1) {
      expect(COMPASS_POINTS[i]!.deg).toBe(i * 45);
    }
  });
});

describe('belongsOnBand', () => {
  it('admits bodies above the horizon', () => {
    expect(belongsOnBand(45)).toBe(true);
    expect(belongsOnBand(0)).toBe(true);
  });

  it('rejects bodies genuinely below it', () => {
    expect(belongsOnBand(-14.2)).toBe(false);
    expect(belongsOnBand(-5)).toBe(false);
    expect(belongsOnBand(-90)).toBe(false);
  });

  it('allows the atmospheric refraction sliver, reusing the Explore threshold', () => {
    expect(belongsOnBand(-HORIZON_REFRACTION_DEG)).toBe(true);
    expect(belongsOnBand(-HORIZON_REFRACTION_DEG - 0.01)).toBe(false);
  });
});

describe('formatAltitude', () => {
  it('reports the real altitude rather than flooring it to zero', () => {
    expect(formatAltitude(22.4)).toBe('Alt 22.4°');
    expect(formatAltitude(0)).toBe('Alt 0.0°');
  });

  it('keeps a decimal place, so a low body is not rounded to the horizon', () => {
    expect(formatAltitude(0.4)).toBe('Alt 0.4°');
  });
});

describe('azimuthFraction', () => {
  it('maps the sweep start to 0 and the far edge to 1', () => {
    expect(azimuthFraction(0, DEFAULT_SWEEP)).toBe(0);
    expect(azimuthFraction(240, DEFAULT_SWEEP)).toBe(1);
    expect(azimuthFraction(120, DEFAULT_SWEEP)).toBeCloseTo(0.5, 10);
  });

  it('rejects an azimuth outside the current window', () => {
    expect(azimuthFraction(241, DEFAULT_SWEEP)).toBeNull();
    expect(azimuthFraction(300, DEFAULT_SWEEP)).toBeNull();
  });

  it('admits every azimuth at the ultrawide (full 360deg) sweep', () => {
    expect(azimuthFraction(0, ULTRAWIDE_SWEEP)).toBe(0);
    expect(azimuthFraction(359.9, ULTRAWIDE_SWEEP)).toBeCloseTo(1, 3);
    expect(azimuthFraction(180, ULTRAWIDE_SWEEP)).toBeCloseTo(0.5, 10);
  });

  it('handles wraparound at 0deg/360deg for a window that crosses N', () => {
    const sweep = { startDeg: 350, sweepDeg: 20 };
    // 5deg is 15deg past the 350deg start, wrapping through 360/0.
    expect(azimuthFraction(5, sweep)).toBeCloseTo(15 / 20, 10);
    // 340deg is behind the start (350deg outside the 20deg window).
    expect(azimuthFraction(340, sweep)).toBeNull();
    // The far edge, 10deg, is exactly in-window.
    expect(azimuthFraction(10, sweep)).toBeCloseTo(1, 10);
  });
});

describe('arcBaselineY', () => {
  it('is lowest (largest y) at the two edges and highest at the center', () => {
    const edge = arcBaselineY(0);
    const center = arcBaselineY(0.5);
    expect(arcBaselineY(1)).toBeCloseTo(edge, 10);
    expect(center).toBeLessThan(edge);
  });
});

describe('azAltToArcPoint', () => {
  it('places a horizon body (0deg altitude) exactly on the baseline arc', () => {
    const f = 0.3;
    const az = DEFAULT_SWEEP.sweepDeg * f;
    const p = azAltToArcPoint(az, 0, DEFAULT_SWEEP);
    expect(p).not.toBeNull();
    expect(p!.y).toBeCloseTo(arcBaselineY(f), 6);
  });

  it('places every zenith body (90deg altitude) at the same height regardless of azimuth', () => {
    const atCenter = azAltToArcPoint(120, 90, DEFAULT_SWEEP);
    const atEdge = azAltToArcPoint(0, 90, DEFAULT_SWEEP);
    // Same altitude extrusion (150 units) subtracted from each azimuth's
    // own baseline — the center is higher (baseline peaks there), but both
    // sit the identical 150-unit rise above their local baseline.
    expect(atCenter).not.toBeNull();
    expect(atEdge).not.toBeNull();
    expect(arcBaselineY(0.5) - atCenter!.y).toBeCloseTo(arcBaselineY(0) - atEdge!.y, 10);
  });

  it('is null for an azimuth outside the current sweep — absent, not faked', () => {
    expect(azAltToArcPoint(300, 45, DEFAULT_SWEEP)).toBeNull();
  });

  it('clamps altitude to [0, 90] without relocating a culled below-horizon body', () => {
    const withinRefraction = azAltToArcPoint(0, -HORIZON_REFRACTION_DEG, DEFAULT_SWEEP);
    const atHorizon = azAltToArcPoint(0, 0, DEFAULT_SWEEP);
    expect(withinRefraction!.y).toBeCloseTo(atHorizon!.y, 6);
  });

  it('stays within the viewBox for the full domain', () => {
    for (let az = 0; az <= 240; az += 15) {
      for (let alt = 0; alt <= 90; alt += 15) {
        const p = azAltToArcPoint(az, alt, DEFAULT_SWEEP)!;
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(ARC_VIEW_WIDTH);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(ARC_VIEW_HEIGHT);
      }
    }
  });
});

describe('azAltToArcPercent', () => {
  it('agrees with azAltToArcPoint, expressed as percentages of the viewBox', () => {
    const point = azAltToArcPoint(60, 30, DEFAULT_SWEEP)!;
    const pct = azAltToArcPercent(60, 30, DEFAULT_SWEEP)!;
    expect(pct.leftPercent).toBeCloseTo((point.x / ARC_VIEW_WIDTH) * 100, 10);
    expect(pct.topPercent).toBeCloseTo((point.y / ARC_VIEW_HEIGHT) * 100, 10);
  });

  it('is null outside the sweep, same as the point form', () => {
    expect(azAltToArcPercent(300, 10, DEFAULT_SWEEP)).toBeNull();
  });
});

describe('arcGridlinePath / arcFillPath', () => {
  it('produces a well-formed SVG path string starting with M', () => {
    const path = arcGridlinePath(45);
    expect(path.startsWith('M ')).toBe(true);
    expect(path).toContain('L ');
  });

  it('the 0deg gridline matches arcBaselineY at each sampled fraction', () => {
    const samples = 4;
    const path = arcGridlinePath(0, samples);
    const command = path.split(' ');
    // "M x0 y0 L x1 y1 ..." — every third token starting at index 2 is a y.
    const y0 = Number(command[2]);
    expect(y0).toBeCloseTo(arcBaselineY(0), 1);
  });

  it('the fill path closes back to its start (Z)', () => {
    expect(arcFillPath().endsWith('Z')).toBe(true);
  });
});
