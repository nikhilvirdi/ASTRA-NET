import { isAboveHorizon, HORIZON_REFRACTION_DEG } from './semantic-zoom';

/**
 * Sampling parameters for Sun & Moon orbit trails in Explore.
 * 24-hour total span (-12h to +12h centered on now), sampled every 15 minutes.
 * 15 minutes yields 97 sample points (smooth ~3.75° arc increments) while passing
 * through offset 0 (now) exactly.
 */
export const TRAIL_WINDOW_HOURS = 12;
export const TRAIL_STEP_MINUTES = 15;

export type HorizontalPositionFn = (
  time: Date,
  latDeg: number,
  lonEastDeg: number,
) => { altitudeDeg: number; azimuthDeg: number };

export type AltAzToVector3Fn<T = { x: number; y: number; z: number }> = (
  altDeg: number,
  azDeg: number,
) => T;

export interface SamplePoint {
  time: Date;
  altitudeDeg: number;
  azimuthDeg: number;
  isAbove: boolean;
}

/**
 * Samples a body's horizontal position across a time window centered on `currentTime`.
 */
export function sampleTrailPoints(
  currentTime: Date,
  observerLatDeg: number,
  observerLonDeg: number,
  posFn: HorizontalPositionFn,
  windowHours = TRAIL_WINDOW_HOURS,
  stepMinutes = TRAIL_STEP_MINUTES,
): SamplePoint[] {
  const totalMinutes = windowHours * 2 * 60;
  const steps = Math.floor(totalMinutes / stepMinutes);
  const startOffsetMinutes = -windowHours * 60;

  const samples: SamplePoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const offsetMs = (startOffsetMinutes + i * stepMinutes) * 60_000;
    const sampleTime = new Date(currentTime.getTime() + offsetMs);
    const pos = posFn(sampleTime, observerLatDeg, observerLonDeg);
    const isAbove = isAboveHorizon(pos.altitudeDeg);
    samples.push({
      time: sampleTime,
      altitudeDeg: pos.altitudeDeg,
      azimuthDeg: pos.azimuthDeg,
      isAbove,
    });
  }

  return samples;
}

/**
 * Computes line-segment vertex positions [x1, y1, z1, x2, y2, z2, ...] for an orbit
 * trail across the sky dome.
 *
 * Option 2 (Horizon-culled arc):
 * Only points where `isAboveHorizon` (altitudeDeg >= -34/60°) are kept.
 * Where the body crosses the horizon (rising or setting), the segment is clipped
 * to the exact horizon altitude (-34/60°) with interpolated azimuth.
 * If no segments are above the horizon across the entire window, returns null.
 */
export function computeOrbitTrailPositions(
  currentTime: Date,
  observerLatDeg: number,
  observerLonDeg: number,
  posFn: HorizontalPositionFn,
  toVector3: AltAzToVector3Fn,
  windowHours = TRAIL_WINDOW_HOURS,
  stepMinutes = TRAIL_STEP_MINUTES,
): Float32Array | null {
  const samples = sampleTrailPoints(
    currentTime,
    observerLatDeg,
    observerLonDeg,
    posFn,
    windowHours,
    stepMinutes,
  );

  const positions: number[] = [];
  const horizonAlt = -HORIZON_REFRACTION_DEG;

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!;
    const b = samples[i + 1]!;

    if (a.isAbove && b.isAbove) {
      const vA = toVector3(a.altitudeDeg, a.azimuthDeg);
      const vB = toVector3(b.altitudeDeg, b.azimuthDeg);
      positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
    } else if (a.isAbove && !b.isAbove) {
      // Setting: crossing from above to below
      const denom = b.altitudeDeg - a.altitudeDeg;
      const frac = denom !== 0 ? (horizonAlt - a.altitudeDeg) / denom : 0;
      if (frac > 1e-4) {
        let dAz = b.azimuthDeg - a.azimuthDeg;
        if (dAz > 180) dAz -= 360;
        if (dAz < -180) dAz += 360;
        const crossAz = (a.azimuthDeg + frac * dAz + 360) % 360;

        const vA = toVector3(a.altitudeDeg, a.azimuthDeg);
        const vCross = toVector3(horizonAlt, crossAz);
        positions.push(vA.x, vA.y, vA.z, vCross.x, vCross.y, vCross.z);
      }
    } else if (!a.isAbove && b.isAbove) {
      // Rising: crossing from below to above
      const denom = b.altitudeDeg - a.altitudeDeg;
      const frac = denom !== 0 ? (horizonAlt - a.altitudeDeg) / denom : 0;
      if (frac < 1 - 1e-4) {
        let dAz = b.azimuthDeg - a.azimuthDeg;
        if (dAz > 180) dAz -= 360;
        if (dAz < -180) dAz += 360;
        const crossAz = (a.azimuthDeg + frac * dAz + 360) % 360;

        const vCross = toVector3(horizonAlt, crossAz);
        const vB = toVector3(b.altitudeDeg, b.azimuthDeg);
        positions.push(vCross.x, vCross.y, vCross.z, vB.x, vB.y, vB.z);
      }
    }
    // If !a.isAbove && !b.isAbove, both are below horizon -> omit completely.
  }

  if (positions.length === 0) {
    return null;
  }

  return new Float32Array(positions);
}
