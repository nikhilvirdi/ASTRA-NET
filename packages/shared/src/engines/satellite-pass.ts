import { R_EARTH_KM, TWILIGHT_ISS_AURORA_DEG } from '../constants';
import { dot, magnitude, scale, subtract, type Vector3 } from '../vector';

/**
 * FORMULAS.md §5 — sunlit test.
 * `r` = satellite geocentric position vector, `sHat` = unit vector toward
 * the Sun, both in the same frame (units cancel in the shadow-cylinder test,
 * but `r` and the perpendicular-distance comparison against R_EARTH must be
 * in km).
 */
export function isSatelliteSunlit(r: Vector3, sHat: Vector3): boolean {
  const rDotS = dot(r, sHat);
  const projection = scale(sHat, rDotS);
  const perpendicular = subtract(r, projection);
  const inShadow = rDotS < 0 && magnitude(perpendicular) < R_EARTH_KM;
  return !inShadow;
}

/**
 * FORMULAS.md §5 — a pass is visible only if ALL three conditions hold:
 * elevation >= 10 deg, observer in darkness (sun_alt < -6 deg, §4), and the
 * satellite itself is sunlit.
 */
export function isVisiblePass(
  elevationDeg: number,
  sunAltObserverDeg: number,
  satellitePosition: Vector3,
  sunUnitVector: Vector3,
): boolean {
  const elevationOk = elevationDeg >= 10;
  const observerInDarkness = sunAltObserverDeg < TWILIGHT_ISS_AURORA_DEG;
  const sunlit = isSatelliteSunlit(satellitePosition, sunUnitVector);
  return elevationOk && observerInDarkness && sunlit;
}
