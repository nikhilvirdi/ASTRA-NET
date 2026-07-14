import { clamp, degToRad, mod, radToDeg } from '../math-utils';

/** FORMULAS.md §3 — Julian day (treating UT1 ~= UTC, as `now` is a UTC instant). */
export function julianDay(now: Date): number {
  return now.getTime() / 86_400_000 + 2_440_587.5;
}

/** FORMULAS.md §3 — Local Sidereal Time in degrees (lon_east positive). */
export function localSiderealTimeDeg(jd: number, lonEastDeg: number): number {
  const dUt1 = jd - 2_451_545.0;
  return mod(280.4606 + 360.9857 * dUt1 + lonEastDeg, 360);
}

export interface HorizontalPosition {
  altitudeDeg: number;
  azimuthDeg: number;
}

/**
 * FORMULAS.md §3 — RA/Dec (degrees) + observer lat/lon (degrees) + Julian day
 * -> altitude/azimuth (degrees). Hour angle H = LST - RA, converted to
 * radians for the trig per the formula's "convert to radians for trig" note.
 */
export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  observerLatDeg: number,
  observerLonEastDeg: number,
  jd: number,
): HorizontalPosition {
  const lstDeg = localSiderealTimeDeg(jd, observerLonEastDeg);
  const hRad = degToRad(mod(lstDeg - raDeg, 360));
  const decRad = degToRad(decDeg);
  const latRad = degToRad(observerLatDeg);

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hRad);
  const altitudeDeg = radToDeg(Math.asin(clamp(sinAlt, -1, 1)));

  const azRad = Math.atan2(
    -Math.cos(decRad) * Math.sin(hRad),
    Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(hRad),
  );
  const azimuthDeg = mod(radToDeg(azRad), 360);

  return { altitudeDeg, azimuthDeg };
}
