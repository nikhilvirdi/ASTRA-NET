import { describe, it, expect } from 'vitest';
import {
  buildConstellationLinePositions,
  computeVisibleConstellationLabels,
  altAzToCartesian,
  celestialPoleAxis,
  siderealRotationAngleRad,
  type ConstellationData,
  CONSTELLATION_LINE_RADIUS,
} from './constellation-lines';
import { isAboveHorizon } from './semantic-zoom';

describe('constellation-lines', () => {
  const mockConstellations: ConstellationData[] = [
    {
      id: 'Ori',
      name: 'Orion',
      center: [84.0, 13.0],
      lines: [
        // Strip 1: 3 points -> 2 segments
        [
          [80.0, 10.0],
          [84.0, 13.0],
          [88.0, 16.0],
        ],
        // Strip 2: 2 points -> 1 segment
        [
          [82.0, -1.0],
          [85.0, -2.0],
        ],
      ],
    },
    {
      id: 'Cru',
      name: 'Southern Cross',
      center: [186.0, -60.0],
      lines: [
        // 2 points -> 1 segment
        [
          [186.0, -57.0],
          [186.0, -63.0],
        ],
      ],
    },
  ];

  it('altAzToCartesian maps coordinates correctly to 3D Cartesian coordinates', () => {
    const r = 1000;
    // Zenith: alt = 90 -> x = 0, y = 1000, z = 0
    const [zx, zy, zz] = altAzToCartesian(90, 0, r);
    expect(zx).toBeCloseTo(0);
    expect(zy).toBeCloseTo(1000);
    expect(zz).toBeCloseTo(0);

    // North horizon: alt = 0, az = 0 -> x = 0, y = 0, z = -1000
    const [nx, ny, nz] = altAzToCartesian(0, 0, r);
    expect(nx).toBeCloseTo(0);
    expect(ny).toBeCloseTo(0);
    expect(nz).toBeCloseTo(-1000);

    // East horizon: alt = 0, az = 90 -> x = 1000, y = 0, z = 0
    const [ex, ey, ez] = altAzToCartesian(0, 90, r);
    expect(ex).toBeCloseTo(1000);
    expect(ey).toBeCloseTo(0);
    expect(ez).toBeCloseTo(0);

    // South horizon: alt = 0, az = 180 -> x = 0, y = 0, z = 1000
    const [sx, sy, sz] = altAzToCartesian(0, 180, r);
    expect(sx).toBeCloseTo(0);
    expect(sy).toBeCloseTo(0);
    expect(sz).toBeCloseTo(1000);

    // West horizon: alt = 0, az = 270 -> x = -1000, y = 0, z = 0
    const [wx, wy, wz] = altAzToCartesian(0, 270, r);
    expect(wx).toBeCloseTo(-1000);
    expect(wy).toBeCloseTo(0);
    expect(wz).toBeCloseTo(0);
  });

  it('buildConstellationLinePositions builds valid Float32Array vertex pairs', () => {
    const observerLat = 40.71;
    const observerLon = -74.01;
    const now = new Date('2026-09-06T18:30:00Z');

    const positions = buildConstellationLinePositions(
      mockConstellations,
      observerLat,
      observerLon,
      now,
    );

    // Orion has 2 + 1 = 3 segments. Crux has 1 segment. Total = 4 segments.
    // 4 segments * 2 vertices per segment = 8 vertices.
    // 8 vertices * 3 floats (x, y, z) = 24 floats.
    expect(positions).toBeInstanceOf(Float32Array);
    expect(positions.length).toBe(24);

    // All positions should be on the radius shell (distance from origin == CONSTELLATION_LINE_RADIUS)
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!;
      const y = positions[i + 1]!;
      const z = positions[i + 2]!;
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(CONSTELLATION_LINE_RADIUS, 1);
    }
  });

  it('celestialPoleAxis computes correct unit axis for observer latitude', () => {
    const axisEquator = celestialPoleAxis(0);
    expect(axisEquator.x).toBeCloseTo(0);
    expect(axisEquator.y).toBeCloseTo(0);
    expect(axisEquator.z).toBeCloseTo(-1);

    const axisNorthPole = celestialPoleAxis(90);
    expect(axisNorthPole.x).toBeCloseTo(0);
    expect(axisNorthPole.y).toBeCloseTo(1);
    expect(axisNorthPole.z).toBeCloseTo(0);
  });

  it('siderealRotationAngleRad computes delta angle matching elapsed time', () => {
    const t0 = new Date('2026-09-06T00:00:00Z');
    const t1 = new Date('2026-09-06T01:00:00Z'); // 1 hour later
    const angle = siderealRotationAngleRad(t0, t1);
    // In 1 hour, Earth rotates ~15 degrees = ~0.2618 rad
    expect(Math.abs(angle)).toBeGreaterThan(0.25);
    expect(Math.abs(angle)).toBeLessThan(0.27);
  });

  it('computeVisibleConstellationLabels filters out constellations fully below the horizon', () => {
    // In the North (Lat 60°N), the Southern Cross (Dec -60°) is never above horizon
    const observerLat = 60.0;
    const observerLon = 0.0;
    const now = new Date('2026-09-06T18:30:00Z');

    const labels = computeVisibleConstellationLabels(
      mockConstellations,
      observerLat,
      observerLon,
      now,
    );

    const cruxLabel = labels.find((l) => l.id === 'Cru');
    expect(cruxLabel).toBeUndefined();

    // All returned labels must be above the horizon
    for (const label of labels) {
      expect(isAboveHorizon(label.altitudeDeg)).toBe(true);
    }
  });

  it('computeVisibleConstellationLabels includes constellations when above horizon', () => {
    // In Sydney (Lat -33.86°), the Southern Cross (Dec -60°) is circumpolar and visible
    const observerLat = -33.86;
    const observerLon = 151.21;
    const now = new Date('2026-09-06T12:00:00Z');

    const labels = computeVisibleConstellationLabels(
      mockConstellations,
      observerLat,
      observerLon,
      now,
    );

    const cruxLabel = labels.find((l) => l.id === 'Cru');
    expect(cruxLabel).toBeDefined();
    expect(cruxLabel?.name).toBe('Southern Cross');
    expect(isAboveHorizon(cruxLabel!.altitudeDeg)).toBe(true);
  });
});
