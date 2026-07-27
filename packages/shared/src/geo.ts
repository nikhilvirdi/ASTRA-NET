/**
 * Spherical-Earth geodesy helpers — great-circle distance and
 * destination-point offset.
 *
 * FORMULAS.md §11's travel term is `exp(-distance_km / 50)`, but the doc
 * never states *which* metric produces `distance_km`, and it specifies no
 * candidate-site generation strategy at all. Both are required by
 * `/api/best-spot` (WORKPLAN.md Phase 9), so they are pinned down here,
 * once, rather than being re-derived per caller.
 *
 * These are standard spherical geodesy over §0's already-frozen
 * `R_EARTH_KM`, not a new physical model and not a new FORMULAS.md
 * section — see DECISIONS.md for why that call was made and what a
 * FORMULAS.md clarification would need to say. Spherical (not ellipsoidal)
 * is deliberate: the ~0.3% WGS84 disagreement is far below the resolution
 * of anything §11 consumes, since the travel term decays over a 50 km
 * scale and the Bortle grid it is scored against is itself ~11 km-resolution.
 */

import { R_EARTH_KM } from './constants.js';
import { clamp, degToRad, mod, radToDeg } from './math-utils.js';

export interface GeoPoint {
  latDeg: number;
  lonDeg: number;
}

/**
 * Great-circle distance in km between two points (haversine form, chosen
 * over the spherical law of cosines for numerical stability at small
 * separations — which is exactly the regime candidate sites live in).
 */
export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const lat1 = degToRad(from.latDeg);
  const lat2 = degToRad(to.latDeg);
  const dLat = degToRad(to.latDeg - from.latDeg);
  const dLon = degToRad(to.lonDeg - from.lonDeg);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  // clamp guards asin against sqrt(h) drifting just past 1.0 for antipodal points.
  return 2 * R_EARTH_KM * Math.asin(clamp(Math.sqrt(h), 0, 1));
}

/**
 * Point reached by travelling `distanceKm` from `origin` along an initial
 * great-circle bearing (degrees clockwise from true north).
 *
 * Longitude is normalised into [-180, 180) so candidates generated near the
 * antimeridian stay valid coordinates rather than running off to ±190°.
 */
export function destinationPoint(
  origin: GeoPoint,
  bearingDeg: number,
  distanceKm: number,
): GeoPoint {
  const angularDistance = distanceKm / R_EARTH_KM;
  const bearing = degToRad(bearingDeg);
  const lat1 = degToRad(origin.latDeg);
  const lon1 = degToRad(origin.lonDeg);

  const sinLat2 =
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing);
  const lat2 = Math.asin(clamp(sinLat2, -1, 1));

  const y = Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1);
  const x = Math.cos(angularDistance) - Math.sin(lat1) * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return {
    latDeg: radToDeg(lat2),
    lonDeg: mod(radToDeg(lon2) + 180, 360) - 180,
  };
}
