import { TWILIGHT_ISS_AURORA_DEG, TWILIGHT_STARS_DEG } from '../constants.js';
import { degToRad, mod, radToDeg } from '../math-utils.js';
import { equatorialToHorizontal, julianDay, type HorizontalPosition } from './sky-dome.js';

export interface EquatorialPositionDeg {
  raDeg: number;
  decDeg: number;
}

/**
 * FORMULAS.md §4 — Meeus low-precision solar position (Jean Meeus,
 * "Astronomical Algorithms" ch. 25, low-accuracy method; ~0.01deg accuracy,
 * matching the doc's binding accuracy requirement). FORMULAS.md names this
 * specific published algorithm rather than spelling out each substep, so
 * the mean-anomaly/mean-longitude/obliquity constants below (357.529,
 * 0.98560028, 280.459, 0.98564736, 1.915, 0.020, 23.439, 0.00000036) are the
 * textbook Meeus low-precision values, not invented substitutes.
 */
export function sunEquatorialPosition(jd: number): EquatorialPositionDeg {
  const d = jd - 2_451_545.0;

  const meanAnomalyDeg = mod(357.529 + 0.98560028 * d, 360);
  const meanLongitudeDeg = mod(280.459 + 0.98564736 * d, 360);
  const g = degToRad(meanAnomalyDeg);

  const eclipticLongitudeDeg = mod(
    meanLongitudeDeg + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g),
    360,
  );
  const l = degToRad(eclipticLongitudeDeg);

  const obliquityDeg = 23.439 - 0.00000036 * d;
  const e = degToRad(obliquityDeg);

  const raRad = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const decRad = Math.asin(Math.sin(e) * Math.sin(l));

  return {
    raDeg: mod(radToDeg(raRad), 360),
    decDeg: radToDeg(decRad),
  };
}

/**
 * FORMULAS.md §4 — Sun's full horizontal position (altitude AND azimuth) for
 * a given observer, via §3. The §3 transform already yields both components;
 * `sunAltitudeDeg` below simply discards the azimuth, so exposing it here is
 * exposure-only, not new computation.
 */
export function sunHorizontalPosition(
  now: Date,
  observerLatDeg: number,
  observerLonEastDeg: number,
): HorizontalPosition {
  const jd = julianDay(now);
  const { raDeg, decDeg } = sunEquatorialPosition(jd);
  return equatorialToHorizontal(raDeg, decDeg, observerLatDeg, observerLonEastDeg, jd);
}

/** FORMULAS.md §4 — Sun's altitude for a given observer, via §3. */
export function sunAltitudeDeg(
  now: Date,
  observerLatDeg: number,
  observerLonEastDeg: number,
): number {
  return sunHorizontalPosition(now, observerLatDeg, observerLonEastDeg).altitudeDeg;
}

/** FORMULAS.md §4 — twilight decision: dark enough for ISS/aurora viewing. */
export function isDarkEnoughForIssOrAurora(sunAltDeg: number): boolean {
  return sunAltDeg < TWILIGHT_ISS_AURORA_DEG;
}

/** FORMULAS.md §4 — twilight decision: dark enough for faint-star realism. */
export function isDarkEnoughForFaintStars(sunAltDeg: number): boolean {
  return sunAltDeg < TWILIGHT_STARS_DEG;
}
