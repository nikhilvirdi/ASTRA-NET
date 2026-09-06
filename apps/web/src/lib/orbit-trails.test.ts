import { describe, expect, it } from 'vitest';
import { sunHorizontalPosition, moonHorizontalPosition } from '@astranet/shared';
import { HORIZON_REFRACTION_DEG } from './semantic-zoom';
import {
  computeOrbitTrailPositions,
  computeOrbitTrailRuns,
  sampleTrailPoints,
  TRAIL_STEP_MINUTES,
  TRAIL_WINDOW_HOURS,
} from './orbit-trails';

// Simple Vector3-like mock converter
const mockAltAzToVector3 = (altDeg: number, azDeg: number) => {
  const rAlt = altDeg * (Math.PI / 180);
  const rAz = azDeg * (Math.PI / 180);
  const r = 950;
  return {
    x: r * Math.cos(rAlt) * Math.sin(rAz),
    y: r * Math.sin(rAlt),
    z: -r * Math.cos(rAlt) * Math.cos(rAz),
  };
};

describe('sampleTrailPoints', () => {
  it('samples a window centered on now with step 15m yielding 97 samples', () => {
    const now = new Date('2026-09-06T12:00:00Z');
    const samples = sampleTrailPoints(
      now,
      32.73,
      74.87,
      () => ({ altitudeDeg: 10, azimuthDeg: 180 }),
      TRAIL_WINDOW_HOURS,
      TRAIL_STEP_MINUTES,
    );

    expect(samples.length).toBe(97); // (24 * 60) / 15 + 1
    // First sample is 12 hours before
    expect(samples[0]?.time.getTime()).toBe(now.getTime() - 12 * 3600 * 1000);
    // Middle sample (index 48) is exactly now
    expect(samples[48]?.time.getTime()).toBe(now.getTime());
    // Last sample is 12 hours after
    expect(samples[96]?.time.getTime()).toBe(now.getTime() + 12 * 3600 * 1000);
  });
});

describe('computeOrbitTrailPositions & computeOrbitTrailRuns', () => {
  it('returns null if the body is below the horizon across the entire window', () => {
    const now = new Date('2026-09-06T12:00:00Z');
    const result = computeOrbitTrailPositions(
      now,
      32.73,
      74.87,
      () => ({ altitudeDeg: -15, azimuthDeg: 100 }),
      mockAltAzToVector3,
    );

    expect(result).toBeNull();
  });

  it('generates a single continuous polyline run when body is always above the horizon', () => {
    const now = new Date('2026-09-06T12:00:00Z');
    const result = computeOrbitTrailPositions(
      now,
      32.73,
      74.87,
      (t) => {
        // Continuous movement above horizon
        const hours = (t.getTime() - now.getTime()) / (3600 * 1000);
        return { altitudeDeg: 20 + hours, azimuthDeg: 180 + hours * 10 };
      },
      mockAltAzToVector3,
    );

    expect(result).not.toBeNull();
    // 1 continuous run of 97 sequential vertices -> 97 * 3 = 291 floats
    expect(result?.length).toBe(1);
    expect(result?.[0]?.length).toBe(97 * 3);
  });

  it('clips trail to the horizon threshold when body rises and sets', () => {
    const now = new Date('2026-09-06T12:00:00Z');
    // Function that rises above horizon around index 24 and sets around index 72
    const result = computeOrbitTrailPositions(
      now,
      32.73,
      74.87,
      (t) => {
        const hours = (t.getTime() - now.getTime()) / (3600 * 1000); // -12 to +12
        // Parabolic arc peaking at noon: altitude = 40 - hours^2
        return { altitudeDeg: 40 - hours * hours, azimuthDeg: 180 + hours * 10 };
      },
      mockAltAzToVector3,
    );

    expect(result).not.toBeNull();
    expect(result?.length).toBe(1);

    const run = result![0]!;
    expect(run.length % 3).toBe(0);

    // Verify all vertex altitudes (y coordinates) are at or above the horizon threshold
    // y = 950 * sin(alt). For alt >= -HORIZON_REFRACTION_DEG:
    const minY = 950 * Math.sin((-HORIZON_REFRACTION_DEG * Math.PI) / 180);
    for (let i = 1; i < run.length; i += 3) {
      const y = run[i]!;
      expect(y).toBeGreaterThanOrEqual(minY - 1e-2);
    }
  });

  it('produces two disjoint runs when body sets and rises again within 24h', () => {
    const now = new Date('2026-09-06T18:00:00Z'); // Nighttime
    const runs = computeOrbitTrailRuns(
      now,
      32.73,
      74.87,
      sunHorizontalPosition,
      mockAltAzToVector3,
    );

    // At night in Jammu, the Sun was up earlier (setting run) and rises tomorrow morning (rising run)
    expect(runs.length).toBe(2);
    expect(runs[0]!.length).toBeGreaterThanOrEqual(6);
    expect(runs[1]!.length).toBeGreaterThanOrEqual(6);

    // Each run has valid vertices with coordinates at or above horizon
    const minY = 950 * Math.sin((-HORIZON_REFRACTION_DEG * Math.PI) / 180);
    for (const run of runs) {
      expect(run.length % 3).toBe(0);
      for (let i = 1; i < run.length; i += 3) {
        expect(run[i]!).toBeGreaterThanOrEqual(minY - 1e-2);
      }
    }
  });

  it('computes real Sun trail for Jammu coordinates cleanly', () => {
    const now = new Date('2026-09-06T15:35:00Z');
    const result = computeOrbitTrailPositions(
      now,
      32.73,
      74.87,
      sunHorizontalPosition,
      mockAltAzToVector3,
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    for (const run of result!) {
      expect(run.length % 3).toBe(0);
      for (let i = 0; i < run.length; i++) {
        expect(Number.isFinite(run[i])).toBe(true);
      }
    }
  });

  it('computes real Moon trail for Jammu coordinates cleanly', () => {
    const now = new Date('2026-09-06T15:35:00Z');
    const result = computeOrbitTrailPositions(
      now,
      32.73,
      74.87,
      moonHorizontalPosition,
      mockAltAzToVector3,
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    for (const run of result!) {
      expect(run.length % 3).toBe(0);
      for (let i = 0; i < run.length; i++) {
        expect(Number.isFinite(run[i])).toBe(true);
      }
    }
  });
});
