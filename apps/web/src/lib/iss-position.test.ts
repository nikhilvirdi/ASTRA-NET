import { describe, it, expect } from 'vitest';
import { computeIssTopocentricPosition } from './iss-position';

// Real fixture ISS position (apps/api's n2yo_positions.json fixture) — a
// genuine N2YO sample, not an invented coordinate.
const ISS_LAT = 49.21118744;
const ISS_LON = 50.48970805;
const ISS_ALT_KM = 429.56;

// Expected values below were computed by running satellite.js's own
// geodeticToEcf/ecfToLookAngles directly against these inputs (not derived
// by hand), the same way `computeIssTopocentricPosition` itself does — this
// test therefore checks the function wires satellite.js correctly, not that
// satellite.js's own orbital math is correct (that's the library's concern).
describe('computeIssTopocentricPosition', () => {
  it('is straight overhead (90°) for an observer directly below the ISS', () => {
    const pos = computeIssTopocentricPosition(ISS_LAT, ISS_LON, ISS_ALT_KM, ISS_LAT, ISS_LON);
    expect(pos.altitudeDeg).toBeCloseTo(90, 6);
    expect(Number.isFinite(pos.azimuthDeg)).toBe(true);
  });

  it('is well below the horizon for a real observer far from the sub-satellite point', () => {
    // New York — thousands of km from this ISS fixture's ground track.
    const pos = computeIssTopocentricPosition(ISS_LAT, ISS_LON, ISS_ALT_KM, 40.7128, -74.006);
    expect(pos.altitudeDeg).toBeCloseTo(-36.5366, 3);
    expect(pos.azimuthDeg).toBeCloseTo(33.4589, 3);
  });

  it('is high but not exactly overhead 1° of latitude from the sub-satellite point, due south', () => {
    const pos = computeIssTopocentricPosition(ISS_LAT, ISS_LON, ISS_ALT_KM, ISS_LAT + 1, ISS_LON);
    expect(pos.altitudeDeg).toBeCloseTo(74.5156, 3);
    expect(pos.azimuthDeg).toBeCloseTo(180, 3); // observer moved north of the ISS -> ISS is due south
  });

  it('places the ISS to the west when the observer is east of the sub-satellite point', () => {
    const pos = computeIssTopocentricPosition(ISS_LAT, ISS_LON, ISS_ALT_KM, ISS_LAT, ISS_LON + 5);
    expect(pos.altitudeDeg).toBeCloseTo(47.1267, 3);
    expect(pos.azimuthDeg).toBeCloseTo(271.8933, 3); // roughly west
  });

  it("matches useSatellites.ts's own real-satellite altitude/azimuth convention (0-360°, degrees)", () => {
    const pos = computeIssTopocentricPosition(ISS_LAT, ISS_LON, ISS_ALT_KM, 40.7128, -74.006);
    expect(pos.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(pos.azimuthDeg).toBeLessThan(360);
  });
});
