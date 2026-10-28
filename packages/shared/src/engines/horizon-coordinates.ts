import { clamp, degToRad, mod, radToDeg } from '../math-utils.js';

export const DEFAULT_DOME_RADIUS = 10;
export const EPSILON = 1e-10;

export type CartesianVector3 = [number, number, number];

export interface HorizonCoordinates {
  altitudeDeg: number;
  azimuthDeg: number;
}

/**
 * Normalizes any azimuth angle in degrees into the canonical [0, 360) range.
 */
export function normalizeAzimuthDeg(azimuthDeg: number): number {
  if (!Number.isFinite(azimuthDeg)) return 0;
  const normalized = mod(azimuthDeg, 360);
  return normalized >= 360 - EPSILON ? 0 : normalized;
}

/**
 * Clamps an altitude angle in degrees to the valid [-90, +90] range.
 */
export function clampAltitudeDeg(altitudeDeg: number): number {
  if (!Number.isFinite(altitudeDeg)) return 0;
  return clamp(altitudeDeg, -90, 90);
}

/**
 * Validates whether raw coordinates are finite numbers within physical bounds.
 */
export function isValidHorizonCoordinates(coords: HorizonCoordinates): boolean {
  return (
    Number.isFinite(coords.altitudeDeg) &&
    Number.isFinite(coords.azimuthDeg) &&
    coords.altitudeDeg >= -90 &&
    coords.altitudeDeg <= 90
  );
}

/**
 * Converts topocentric horizontal coordinates (Altitude, Azimuth) into Three.js
 * right-handed Cartesian coordinates (X, Y, Z):
 *
 * - Observer Origin: (0, 0, 0)
 * - Horizon Plane:   XZ plane (Y = 0)
 * - Zenith (+90°):   +Y (0, +R, 0)
 * - Nadir (-90°):    -Y (0, -R, 0)
 * - North (Az 0°):   -Z (0, 0, -R)
 * - East  (Az 90°):  +X (+R, 0, 0)
 * - South (Az 180°): +Z (0, 0, +R)
 * - West  (Az 270°): -X (-R, 0, 0)
 *
 * Basis: x = R*cos(alt)*sin(az), y = R*sin(alt), z = -R*cos(alt)*cos(az)
 */
export function horizontalToCartesian(
  altitudeDeg: number,
  azimuthDeg: number,
  radius: number = DEFAULT_DOME_RADIUS,
): CartesianVector3 {
  const alt = degToRad(clampAltitudeDeg(altitudeDeg));
  const az = degToRad(normalizeAzimuthDeg(azimuthDeg));

  const cosAlt = Math.cos(alt);
  const sinAlt = Math.sin(alt);
  const sinAz = Math.sin(az);
  const cosAz = Math.cos(az);

  const x = radius * cosAlt * sinAz;
  const y = radius * sinAlt;
  const z = -radius * cosAlt * cosAz;

  return [
    Math.abs(x) < EPSILON ? 0 : x,
    Math.abs(y) < EPSILON ? 0 : y,
    Math.abs(z) < EPSILON ? 0 : z,
  ];
}

/**
 * Projects a celestial coordinate onto the horizon plane (Y = 0) preserving
 * its planar azimuth distance (R * cos(alt)), or projected to the outer rim (R).
 */
export function horizontalToHorizonProjection(
  altitudeDeg: number,
  azimuthDeg: number,
  radius: number = DEFAULT_DOME_RADIUS,
  projectToOuterRing = false,
): CartesianVector3 {
  const alt = degToRad(clampAltitudeDeg(altitudeDeg));
  const az = degToRad(normalizeAzimuthDeg(azimuthDeg));
  const rHoriz = projectToOuterRing ? radius : radius * Math.cos(alt);

  const x = rHoriz * Math.sin(az);
  const z = -rHoriz * Math.cos(az);

  return [Math.abs(x) < EPSILON ? 0 : x, 0, Math.abs(z) < EPSILON ? 0 : z];
}

/**
 * Inverse transformation: converts a 3D Cartesian point on/in a sphere
 * back into local horizontal coordinates (altitudeDeg, azimuthDeg).
 */
export function cartesianToHorizontal(x: number, y: number, z: number): HorizonCoordinates {
  const r = Math.hypot(x, y, z);
  if (r < EPSILON) {
    return { altitudeDeg: 0, azimuthDeg: 0 };
  }

  const sinAlt = clamp(y / r, -1, 1);
  const altitudeDeg = radToDeg(Math.asin(sinAlt));

  // At exact Zenith or Nadir, azimuth is indeterminate; default to 0°
  if (Math.abs(x) < EPSILON && Math.abs(z) < EPSILON) {
    return { altitudeDeg, azimuthDeg: 0 };
  }

  // With x = r*cos(alt)*sin(az) and -z = r*cos(alt)*cos(az)
  const azimuthRad = Math.atan2(x, -z);
  const azimuthDeg = normalizeAzimuthDeg(radToDeg(azimuthRad));

  return { altitudeDeg, azimuthDeg };
}

/**
 * Shortest-path angular interpolation for azimuth angles in degrees [0, 360).
 */
export function lerpAzimuthDeg(currentAzDeg: number, targetAzDeg: number, t: number): number {
  const a = normalizeAzimuthDeg(currentAzDeg);
  const b = normalizeAzimuthDeg(targetAzDeg);
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return normalizeAzimuthDeg(a + delta * t);
}

/**
 * Generates vertices for a constant-altitude parallel ring (almucantar).
 */
export function buildAltitudeRingPoints(
  altitudeDeg: number,
  radius: number = DEFAULT_DOME_RADIUS,
  segments = 96,
): CartesianVector3[] {
  const points: CartesianVector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const az = (i / segments) * 360;
    points.push(horizontalToCartesian(altitudeDeg, az, radius));
  }
  return points;
}

/**
 * Generates vertices for a vertical meridian arc at a fixed azimuth between startAlt and endAlt.
 */
export function buildAltitudeArcPoints(
  azimuthDeg: number,
  startAltDeg: number,
  endAltDeg: number,
  radius: number = DEFAULT_DOME_RADIUS,
  segments = 48,
): CartesianVector3[] {
  const points: CartesianVector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const alt = startAltDeg + (endAltDeg - startAltDeg) * u;
    points.push(horizontalToCartesian(alt, azimuthDeg, radius));
  }
  return points;
}

/**
 * Generates vertices for a clockwise azimuth arc on the horizon plane (Y = 0)
 * from True North (0°) to targetAzimuthDeg.
 */
export function buildAzimuthArcPoints(
  targetAzimuthDeg: number,
  arcRadius: number,
  segments = 64,
): CartesianVector3[] {
  const normAz = normalizeAzimuthDeg(targetAzimuthDeg);
  const points: CartesianVector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const az = (i / segments) * normAz;
    points.push(horizontalToCartesian(0, az, arcRadius));
  }
  return points;
}

/**
 * Returns the 8-point compass cardinal/intercardinal abbreviation for a given azimuth.
 */
export function getCompassBearingLabel(azimuthDeg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const norm = normalizeAzimuthDeg(azimuthDeg);
  const index = Math.round(norm / 45) % 8;
  return directions[index] ?? 'N';
}

/**
 * Formats an altitude angle with explicit sign (e.g. "+42.5°", "-12.0°").
 */
export function formatAltitudeDeg(altitudeDeg: number, decimals = 1): string {
  const clamped = clampAltitudeDeg(altitudeDeg);
  const sign = clamped > 0 ? '+' : '';
  return `${sign}${clamped.toFixed(decimals)}°`;
}

/**
 * Formats an azimuth angle with zero-padded degrees and optional cardinal sector.
 */
export function formatAzimuthDeg(azimuthDeg: number, decimals = 1, includeCardinal = true): string {
  const norm = normalizeAzimuthDeg(azimuthDeg);
  const padLen = decimals > 0 ? 4 + decimals : 3;
  const degStr = `${norm.toFixed(decimals).padStart(padLen, '0')}°`;
  return includeCardinal ? `${degStr} ${getCompassBearingLabel(norm)}` : degStr;
}
