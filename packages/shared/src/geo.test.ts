import { describe, it, expect } from 'vitest';
import { haversineDistanceKm, destinationPoint } from './geo.js';
import { R_EARTH_KM } from './constants.js';

/**
 * Reference values were produced independently of this implementation, via
 * the spherical law of cosines (a different formula from the haversine
 * under test) on the same R_EARTH_KM, and sanity-checked against published
 * great-circle distances — NYC->LA is the well-known ~3936 km, and one
 * degree of longitude at the equator is the standard 111.19 km.
 */
describe('haversineDistanceKm', () => {
  it('matches an independent reference for a short regional hop', () => {
    // Jammu -> Srinagar
    const d = haversineDistanceKm(
      { latDeg: 32.7266, lonDeg: 74.857 },
      { latDeg: 34.0837, lonDeg: 74.7973 },
    );
    expect(d).toBeCloseTo(151.004345, 3);
  });

  it('matches an independent reference for a continental distance', () => {
    // NYC -> LA, the standard ~3936 km great-circle figure.
    const d = haversineDistanceKm(
      { latDeg: 40.7128, lonDeg: -74.006 },
      { latDeg: 34.0522, lonDeg: -118.2437 },
    );
    expect(d).toBeCloseTo(3935.746255, 3);
  });

  it('gives the standard 111.19 km for one degree of longitude at the equator', () => {
    const d = haversineDistanceKm({ latDeg: 0, lonDeg: 0 }, { latDeg: 0, lonDeg: 1 });
    expect(d).toBeCloseTo(111.194927, 5);
  });

  it('is zero for identical points', () => {
    expect(
      haversineDistanceKm({ latDeg: 32.7, lonDeg: 74.8 }, { latDeg: 32.7, lonDeg: 74.8 }),
    ).toBe(0);
  });

  it('is symmetric', () => {
    const a = { latDeg: 12.34, lonDeg: -56.78 };
    const b = { latDeg: -43.21, lonDeg: 87.65 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });

  it('handles the antipodal case without NaN from asin overflow', () => {
    // Pole to pole is exactly half the great circle: pi * R.
    const d = haversineDistanceKm({ latDeg: 90, lonDeg: 0 }, { latDeg: -90, lonDeg: 0 });
    expect(d).toBeCloseTo(Math.PI * R_EARTH_KM, 6);
    expect(Number.isNaN(d)).toBe(false);
  });

  it('measures across the antimeridian the short way, not the long way', () => {
    const d = haversineDistanceKm({ latDeg: 0, lonDeg: 179.5 }, { latDeg: 0, lonDeg: -179.5 });
    expect(d).toBeCloseTo(111.194927, 5);
  });
});

describe('destinationPoint', () => {
  const jammu = { latDeg: 32.7266, lonDeg: 74.857 };

  it.each([
    [0, 33.176261, 74.857],
    [90, 32.725466, 75.391504],
    [180, 32.276939, 74.857],
    [270, 32.725466, 74.322496],
  ])('matches an independent reference at bearing %i', (bearing, expectedLat, expectedLon) => {
    const p = destinationPoint(jammu, bearing, 50);
    expect(p.latDeg).toBeCloseTo(expectedLat, 6);
    expect(p.lonDeg).toBeCloseTo(expectedLon, 6);
  });

  it('round-trips: the haversine distance back to the origin is the distance travelled', () => {
    for (const bearing of [0, 45, 137, 250, 359]) {
      for (const distanceKm of [1, 25, 60, 500]) {
        const p = destinationPoint(jammu, bearing, distanceKm);
        expect(haversineDistanceKm(jammu, p)).toBeCloseTo(distanceKm, 6);
      }
    }
  });

  it('returns the origin for zero distance', () => {
    const p = destinationPoint(jammu, 42, 0);
    expect(p.latDeg).toBeCloseTo(jammu.latDeg, 10);
    expect(p.lonDeg).toBeCloseTo(jammu.lonDeg, 10);
  });

  it('normalises longitude into [-180, 180) when crossing the antimeridian', () => {
    const p = destinationPoint({ latDeg: 0, lonDeg: 179.9 }, 90, 50);
    expect(p.lonDeg).toBeCloseTo(-179.650339, 6);
    expect(p.lonDeg).toBeGreaterThanOrEqual(-180);
    expect(p.lonDeg).toBeLessThan(180);
  });

  it('stays a valid coordinate when travelling past the pole', () => {
    const p = destinationPoint({ latDeg: 89, lonDeg: 0 }, 0, 500);
    expect(p.latDeg).toBeLessThanOrEqual(90);
    expect(p.latDeg).toBeGreaterThanOrEqual(-90);
    expect(Number.isNaN(p.lonDeg)).toBe(false);
  });
});
