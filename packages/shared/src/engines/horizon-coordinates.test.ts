import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOME_RADIUS,
  buildAltitudeArcPoints,
  buildAltitudeRingPoints,
  buildAzimuthArcPoints,
  cartesianToHorizontal,
  clampAltitudeDeg,
  formatAltitudeDeg,
  formatAzimuthDeg,
  getCompassBearingLabel,
  horizontalToCartesian,
  horizontalToHorizonProjection,
  isValidHorizonCoordinates,
  lerpAzimuthDeg,
  normalizeAzimuthDeg,
} from './horizon-coordinates.js';

describe('normalizeAzimuthDeg', () => {
  it('keeps angles in [0, 360) unchanged', () => {
    expect(normalizeAzimuthDeg(0)).toBe(0);
    expect(normalizeAzimuthDeg(180)).toBe(180);
    expect(normalizeAzimuthDeg(359.9)).toBeCloseTo(359.9, 5);
  });

  it('normalizes 360 to 0', () => {
    expect(normalizeAzimuthDeg(360)).toBe(0);
    expect(normalizeAzimuthDeg(720)).toBe(0);
  });

  it('wraps negative angles into [0, 360)', () => {
    expect(normalizeAzimuthDeg(-90)).toBe(270);
    expect(normalizeAzimuthDeg(-360)).toBe(0);
    expect(normalizeAzimuthDeg(-450)).toBe(270);
  });

  it('handles non-finite values safely', () => {
    expect(normalizeAzimuthDeg(NaN)).toBe(0);
    expect(normalizeAzimuthDeg(Infinity)).toBe(0);
  });
});

describe('clampAltitudeDeg', () => {
  it('retains angles in [-90, 90]', () => {
    expect(clampAltitudeDeg(0)).toBe(0);
    expect(clampAltitudeDeg(45)).toBe(45);
    expect(clampAltitudeDeg(-30)).toBe(-30);
  });

  it('clamps values beyond physical extremes', () => {
    expect(clampAltitudeDeg(105)).toBe(90);
    expect(clampAltitudeDeg(-120)).toBe(-90);
  });

  it('handles non-finite values safely', () => {
    expect(clampAltitudeDeg(NaN)).toBe(0);
  });
});

describe('isValidHorizonCoordinates', () => {
  it('validates coordinates within standard bounds', () => {
    expect(isValidHorizonCoordinates({ altitudeDeg: 45, azimuthDeg: 180 })).toBe(true);
    expect(isValidHorizonCoordinates({ altitudeDeg: -90, azimuthDeg: 0 })).toBe(true);
    expect(isValidHorizonCoordinates({ altitudeDeg: 90, azimuthDeg: 359 })).toBe(true);
  });

  it('rejects out of bound or non-finite coordinates', () => {
    expect(isValidHorizonCoordinates({ altitudeDeg: 91, azimuthDeg: 180 })).toBe(false);
    expect(isValidHorizonCoordinates({ altitudeDeg: -91, azimuthDeg: 180 })).toBe(false);
    expect(isValidHorizonCoordinates({ altitudeDeg: NaN, azimuthDeg: 0 })).toBe(false);
    expect(isValidHorizonCoordinates({ altitudeDeg: 0, azimuthDeg: Infinity })).toBe(false);
  });
});

describe('horizontalToCartesian', () => {
  const R = DEFAULT_DOME_RADIUS;

  it('maps True North (Az 0°, Alt 0°) to -Z', () => {
    const [x, y, z] = horizontalToCartesian(0, 0, R);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-R, 6);
  });

  it('maps East (Az 90°, Alt 0°) to +X', () => {
    const [x, y, z] = horizontalToCartesian(0, 90, R);
    expect(x).toBeCloseTo(R, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('maps South (Az 180°, Alt 0°) to +Z', () => {
    const [x, y, z] = horizontalToCartesian(0, 180, R);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(R, 6);
  });

  it('maps West (Az 270°, Alt 0°) to -X', () => {
    const [x, y, z] = horizontalToCartesian(0, 270, R);
    expect(x).toBeCloseTo(-R, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('maps Zenith (+90° Alt) to +Y regardless of azimuth', () => {
    const [x, y, z] = horizontalToCartesian(90, 45, R);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(R, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('maps Nadir (-90° Alt) to -Y regardless of azimuth', () => {
    const [x, y, z] = horizontalToCartesian(-90, 220, R);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(-R, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('computes expected intermediate coordinate values (Alt 45°, Az 45°)', () => {
    const [x, y, z] = horizontalToCartesian(45, 45, R);
    const expectedCos45 = Math.cos(Math.PI / 4);
    const expectedSin45 = Math.sin(Math.PI / 4);
    expect(x).toBeCloseTo(R * expectedCos45 * expectedSin45, 5);
    expect(y).toBeCloseTo(R * expectedSin45, 5);
    expect(z).toBeCloseTo(-R * expectedCos45 * expectedCos45, 5);
  });
});

describe('horizontalToHorizonProjection', () => {
  const R = DEFAULT_DOME_RADIUS;

  it('projects coordinate onto Y = 0 plane with r*cos(alt)', () => {
    const [x, y, z] = horizontalToHorizonProjection(60, 90, R, false);
    expect(x).toBeCloseTo(R * 0.5, 6);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0, 6);
  });

  it('projects coordinate onto outer ring when projectToOuterRing is true', () => {
    const [x, y, z] = horizontalToHorizonProjection(60, 90, R, true);
    expect(x).toBeCloseTo(R, 6);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0, 6);
  });
});

describe('cartesianToHorizontal (inverse transform)', () => {
  const R = DEFAULT_DOME_RADIUS;

  it('recovers cardinal azimuths accurately at zero altitude', () => {
    expect(cartesianToHorizontal(0, 0, -R)).toEqual({ altitudeDeg: 0, azimuthDeg: 0 }); // North
    expect(cartesianToHorizontal(R, 0, 0)).toEqual({ altitudeDeg: 0, azimuthDeg: 90 }); // East
    expect(cartesianToHorizontal(0, 0, R)).toEqual({ altitudeDeg: 0, azimuthDeg: 180 }); // South
    expect(cartesianToHorizontal(-R, 0, 0)).toEqual({ altitudeDeg: 0, azimuthDeg: 270 }); // West
  });

  it('recovers Zenith (+90°) and Nadir (-90°)', () => {
    const zenith = cartesianToHorizontal(0, R, 0);
    expect(zenith.altitudeDeg).toBeCloseTo(90, 5);
    expect(zenith.azimuthDeg).toBe(0);

    const nadir = cartesianToHorizontal(0, -R, 0);
    expect(nadir.altitudeDeg).toBeCloseTo(-90, 5);
    expect(nadir.azimuthDeg).toBe(0);
  });

  it('performs lossless roundtrip conversion for arbitrary angles', () => {
    const testCases: [number, number][] = [
      [30, 45],
      [15, 135],
      [-25, 210],
      [75, 315],
      [0.5, 0.5],
      [-40, 350],
    ];

    for (const [alt, az] of testCases) {
      const [x, y, z] = horizontalToCartesian(alt, az, R);
      const recovered = cartesianToHorizontal(x, y, z);
      expect(recovered.altitudeDeg).toBeCloseTo(alt, 4);
      expect(recovered.azimuthDeg).toBeCloseTo(az, 4);
    }
  });

  it('safely handles origin (0, 0, 0)', () => {
    expect(cartesianToHorizontal(0, 0, 0)).toEqual({ altitudeDeg: 0, azimuthDeg: 0 });
  });
});

describe('lerpAzimuthDeg', () => {
  it('interpolates along standard direction when delta <= 180', () => {
    expect(lerpAzimuthDeg(10, 50, 0.5)).toBeCloseTo(30, 5);
    expect(lerpAzimuthDeg(180, 200, 0.5)).toBeCloseTo(190, 5);
  });

  it('interpolates via the shortest arc across the 0°/360° discontinuity', () => {
    // 350° to 10°: delta is +20° clockwise across 0°
    expect(lerpAzimuthDeg(350, 10, 0.5)).toBeCloseTo(0, 5);
    expect(lerpAzimuthDeg(10, 350, 0.5)).toBeCloseTo(0, 5);
    expect(lerpAzimuthDeg(350, 10, 0.25)).toBeCloseTo(355, 5);
    expect(lerpAzimuthDeg(350, 10, 0.75)).toBeCloseTo(5, 5);
  });
});

describe('geometry generators', () => {
  it('generates closed altitude ring with expected segment count', () => {
    const segments = 16;
    const points = buildAltitudeRingPoints(30, 10, segments);
    expect(points).toHaveLength(segments + 1);
    // Closed ring: first and last point match
    expect(points[0][0]).toBeCloseTo(points[segments][0], 5);
    expect(points[0][1]).toBeCloseTo(points[segments][1], 5);
    expect(points[0][2]).toBeCloseTo(points[segments][2], 5);
  });

  it('generates vertical meridian arc between start and end altitudes', () => {
    const segments = 10;
    const points = buildAltitudeArcPoints(90, 0, 90, 10, segments);
    expect(points).toHaveLength(segments + 1);
    // At Az 90, start is East horizon: [10, 0, 0]
    expect(points[0][0]).toBeCloseTo(10, 5);
    expect(points[0][1]).toBeCloseTo(0, 5);
    // End is Zenith: [0, 10, 0]
    expect(points[segments][0]).toBeCloseTo(0, 5);
    expect(points[segments][1]).toBeCloseTo(10, 5);
  });

  it('generates azimuth arc on the horizon plane', () => {
    const segments = 20;
    const points = buildAzimuthArcPoints(90, 10, segments);
    expect(points).toHaveLength(segments + 1);
    // Starts at True North [0, 0, -10]
    expect(points[0][0]).toBeCloseTo(0, 5);
    expect(points[0][1]).toBe(0);
    expect(points[0][2]).toBeCloseTo(-10, 5);
    // Ends at East [10, 0, 0]
    expect(points[segments][0]).toBeCloseTo(10, 5);
    expect(points[segments][1]).toBe(0);
    expect(points[segments][2]).toBeCloseTo(0, 5);
  });
});

describe('formatting and compass labels', () => {
  it('returns correct 8-point compass labels', () => {
    expect(getCompassBearingLabel(0)).toBe('N');
    expect(getCompassBearingLabel(44)).toBe('NE');
    expect(getCompassBearingLabel(90)).toBe('E');
    expect(getCompassBearingLabel(135)).toBe('SE');
    expect(getCompassBearingLabel(180)).toBe('S');
    expect(getCompassBearingLabel(225)).toBe('SW');
    expect(getCompassBearingLabel(270)).toBe('W');
    expect(getCompassBearingLabel(315)).toBe('NW');
    expect(getCompassBearingLabel(355)).toBe('N');
  });

  it('formats altitude with explicit sign', () => {
    expect(formatAltitudeDeg(42.5)).toBe('+42.5°');
    expect(formatAltitudeDeg(-12)).toBe('-12.0°');
    expect(formatAltitudeDeg(0)).toBe('0.0°');
  });

  it('formats azimuth with padding and cardinal indicator', () => {
    expect(formatAzimuthDeg(45, 1, true)).toBe('045.0° NE');
    expect(formatAzimuthDeg(45, 1, false)).toBe('045.0°');
    expect(formatAzimuthDeg(270.4, 1, true)).toBe('270.4° W');
  });
});
