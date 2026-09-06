import {
  julianDay,
  equatorialToHorizontal,
  localSiderealTimeDeg,
  degToRad,
  mod,
} from '@astranet/shared';
import { isAboveHorizon } from './semantic-zoom';

export interface ConstellationData {
  id: string;
  name: string;
  center: [number, number]; // [raDeg, decDeg]
  lines: [number, number][][]; // Array of line strips [[raDeg, decDeg], ...]
}

export const CONSTELLATION_LINE_RADIUS = 995;
export const CONSTELLATION_LABEL_RADIUS = 950;

/**
 * Earth's rotation axis, expressed in the local horizontal Cartesian frame
 * (X=East, Y=Up, Z=South). Matches StarField.tsx.
 */
export function celestialPoleAxis(observerLatDeg: number): { x: number; y: number; z: number } {
  const latRad = degToRad(observerLatDeg);
  return {
    x: 0,
    y: Math.sin(latRad),
    z: -Math.cos(latRad),
  };
}

/**
 * How far the celestial sphere has rotated about celestialPoleAxis
 * between referenceTime and currentTime. Matches StarField.tsx.
 */
export function siderealRotationAngleRad(referenceTime: Date, currentTime: Date): number {
  const deltaLstDeg = mod(
    localSiderealTimeDeg(julianDay(currentTime), 0) -
      localSiderealTimeDeg(julianDay(referenceTime), 0),
    360,
  );
  return -degToRad(deltaLstDeg);
}

/**
 * Converts altitude and azimuth in degrees to Cartesian (X=East, Y=Up, Z=South).
 * Exactly matches StarField.tsx and CelestialMarkers.tsx.
 */
export function altAzToCartesian(
  altDeg: number,
  azDeg: number,
  radius: number,
): [number, number, number] {
  const rAlt = altDeg * (Math.PI / 180);
  const rAz = azDeg * (Math.PI / 180);
  const x = radius * Math.cos(rAlt) * Math.sin(rAz);
  const y = radius * Math.sin(rAlt);
  const z = -radius * Math.cos(rAlt) * Math.cos(rAz);
  return [x, y, z];
}

/**
 * Builds a Float32Array of vertex pairs [x0, y0, z0, x1, y1, z1, ...] for THREE.LineSegments
 * from constellation lines, transformed at referenceTime.
 */
export function buildConstellationLinePositions(
  constellations: ConstellationData[],
  observerLatDeg: number,
  observerLonDeg: number,
  referenceTime: Date,
  radius = CONSTELLATION_LINE_RADIUS,
): Float32Array {
  const jd = julianDay(referenceTime);
  const positions: number[] = [];

  for (const constellation of constellations) {
    for (const strip of constellation.lines) {
      if (strip.length < 2) continue;

      for (let i = 0; i < strip.length - 1; i++) {
        const p0 = strip[i]!;
        const p1 = strip[i + 1]!;

        const h0 = equatorialToHorizontal(p0[0], p0[1], observerLatDeg, observerLonDeg, jd);
        const v0 = altAzToCartesian(h0.altitudeDeg, h0.azimuthDeg, radius);

        const h1 = equatorialToHorizontal(p1[0], p1[1], observerLatDeg, observerLonDeg, jd);
        const v1 = altAzToCartesian(h1.altitudeDeg, h1.azimuthDeg, radius);

        positions.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2]);
      }
    }
  }

  return new Float32Array(positions);
}

export interface VisibleConstellationLabel {
  id: string;
  name: string;
  position: [number, number, number];
  altitudeDeg: number;
  azimuthDeg: number;
}

/**
 * Computes labels for all constellations currently at least partially above the horizon.
 * Positioned at the constellation's anchor point (center if above horizon, or highest
 * above-horizon vertex if center is below horizon).
 */
export function computeVisibleConstellationLabels(
  constellations: ConstellationData[],
  observerLatDeg: number,
  observerLonDeg: number,
  currentTime: Date,
  radius = CONSTELLATION_LABEL_RADIUS,
): VisibleConstellationLabel[] {
  const jd = julianDay(currentTime);
  const visibleLabels: VisibleConstellationLabel[] = [];

  for (const c of constellations) {
    const centerH = equatorialToHorizontal(
      c.center[0],
      c.center[1],
      observerLatDeg,
      observerLonDeg,
      jd,
    );

    if (isAboveHorizon(centerH.altitudeDeg)) {
      // Center is above horizon: use center directly
      const pos = altAzToCartesian(centerH.altitudeDeg, centerH.azimuthDeg, radius);
      visibleLabels.push({
        id: c.id,
        name: c.name,
        position: pos,
        altitudeDeg: centerH.altitudeDeg,
        azimuthDeg: centerH.azimuthDeg,
      });
      continue;
    }

    // Center is below horizon: check if any line vertex is above horizon
    let maxAlt = -Infinity;
    let bestH = centerH;

    for (const strip of c.lines) {
      for (const pt of strip) {
        const h = equatorialToHorizontal(pt[0], pt[1], observerLatDeg, observerLonDeg, jd);
        if (h.altitudeDeg > maxAlt) {
          maxAlt = h.altitudeDeg;
          bestH = h;
        }
      }
    }

    if (isAboveHorizon(maxAlt)) {
      // At least one vertex is above horizon: place label at highest visible point
      const pos = altAzToCartesian(bestH.altitudeDeg, bestH.azimuthDeg, radius);
      visibleLabels.push({
        id: c.id,
        name: c.name,
        position: pos,
        altitudeDeg: bestH.altitudeDeg,
        azimuthDeg: bestH.azimuthDeg,
      });
    }
  }

  return visibleLabels;
}
