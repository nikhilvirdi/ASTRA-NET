import { bisectionSolve, clamp, degToRad, mod, radToDeg } from '../math-utils.js';
import { equatorialToHorizontal, julianDay, type HorizontalPosition } from './sky-dome.js';
import {
  obliquityOfEclipticDeg,
  sunEclipticLongitudeDeg,
  sunEquatorialPosition,
  type EquatorialPositionDeg,
} from './sun-position.js';

export interface MoonEclipticPosition {
  eclipticLongitudeDeg: number;
  eclipticLatitudeDeg: number;
  distanceKm: number;
}

/**
 * FORMULAS.md §12 — Meeus low-precision lunar position (Jean Meeus,
 * "Astronomical Algorithms" ch. 47, truncated to the largest-amplitude
 * periodic terms). The mean-element and periodic-term coefficients below
 * are the textbook truncated-series values, not invented substitutes —
 * spot-checked against JPL DE421 via an independent ephemeris (skyfield),
 * per FORMULAS.md §12's header.
 */
export function moonEclipticPosition(jd: number): MoonEclipticPosition {
  const T = (jd - 2_451_545.0) / 36525;

  const meanLongitudeDeg = mod(
    218.3164477 + 481267.88123421 * T - 0.0015786 * T ** 2 + T ** 3 / 538841 - T ** 4 / 65194000,
    360,
  );
  const elongationDeg = mod(
    297.8501921 + 445267.1114034 * T - 0.0018819 * T ** 2 + T ** 3 / 545868 - T ** 4 / 113065000,
    360,
  );
  const sunAnomalyDeg = mod(
    357.5291092 + 35999.0502909 * T - 0.0001536 * T ** 2 + T ** 3 / 24490000,
    360,
  );
  const moonAnomalyDeg = mod(
    134.9633964 + 477198.8675055 * T + 0.0087414 * T ** 2 + T ** 3 / 69699 - T ** 4 / 14712000,
    360,
  );
  const argumentOfLatitudeDeg = mod(
    93.272095 + 483202.0175233 * T - 0.0036539 * T ** 2 - T ** 3 / 3526000 + T ** 4 / 863310000,
    360,
  );

  const d = degToRad(elongationDeg);
  const m = degToRad(sunAnomalyDeg);
  const mp = degToRad(moonAnomalyDeg);
  const f = degToRad(argumentOfLatitudeDeg);

  const longitudeCorrectionDeg =
    6.289 * Math.sin(mp) -
    1.274 * Math.sin(mp - 2 * d) +
    0.658 * Math.sin(2 * d) -
    0.186 * Math.sin(m) -
    0.059 * Math.sin(2 * mp - 2 * d) -
    0.057 * Math.sin(mp - 2 * d + m) +
    0.053 * Math.sin(mp + 2 * d) +
    0.046 * Math.sin(2 * d - m) +
    0.041 * Math.sin(mp - m) -
    0.035 * Math.sin(d) -
    0.031 * Math.sin(mp + m) -
    0.015 * Math.sin(2 * f - 2 * d) +
    0.011 * Math.sin(mp - 4 * d);

  const eclipticLatitudeDeg =
    5.128 * Math.sin(f) +
    0.281 * Math.sin(mp + f) -
    0.278 * Math.sin(f - mp) -
    0.173 * Math.sin(2 * d - f) +
    0.055 * Math.sin(2 * d - mp + f) +
    0.046 * Math.sin(2 * d - mp - f) +
    0.033 * Math.sin(2 * d + f) +
    0.017 * Math.sin(2 * mp + f);

  const distanceKm =
    385001 -
    20905 * Math.cos(mp) -
    3699 * Math.cos(2 * d - mp) -
    2956 * Math.cos(2 * d) -
    570 * Math.cos(2 * mp) +
    246 * Math.cos(2 * mp - 2 * d) -
    205 * Math.cos(m - 2 * d) -
    171 * Math.cos(mp + 2 * d) -
    152 * Math.cos(mp + m - 2 * d);

  return {
    eclipticLongitudeDeg: mod(meanLongitudeDeg + longitudeCorrectionDeg, 360),
    eclipticLatitudeDeg,
    distanceKm,
  };
}

/**
 * FORMULAS.md §12 — Moon's RA/Dec: rotate the ecliptic position by the
 * obliquity of the ecliptic (§4, reused via `obliquityOfEclipticDeg` — same
 * value the Sun uses, not a second copy). Unlike the Sun, the Moon's
 * ecliptic latitude is not zero, so the general (non-zero-latitude)
 * rotation applies, not the Sun's simplified longitude-only one.
 */
export function moonEquatorialPosition(jd: number): EquatorialPositionDeg {
  const { eclipticLongitudeDeg, eclipticLatitudeDeg } = moonEclipticPosition(jd);
  const l = degToRad(eclipticLongitudeDeg);
  const b = degToRad(eclipticLatitudeDeg);
  const e = degToRad(obliquityOfEclipticDeg(jd));

  const raRad = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const decRad = Math.asin(
    clamp(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l), -1, 1),
  );

  return {
    raDeg: mod(radToDeg(raRad), 360),
    decDeg: radToDeg(decRad),
  };
}

/** FORMULAS.md §12 — Moon's full horizontal position (altitude AND azimuth) for a given observer, via §3. */
export function moonHorizontalPosition(
  now: Date,
  observerLatDeg: number,
  observerLonEastDeg: number,
): HorizontalPosition {
  const jd = julianDay(now);
  const { raDeg, decDeg } = moonEquatorialPosition(jd);
  return equatorialToHorizontal(raDeg, decDeg, observerLatDeg, observerLonEastDeg, jd);
}

/** FORMULAS.md §12 — Moon's altitude for a given observer, via §3. */
export function moonAltitudeDeg(
  now: Date,
  observerLatDeg: number,
  observerLonEastDeg: number,
): number {
  return moonHorizontalPosition(now, observerLatDeg, observerLonEastDeg).altitudeDeg;
}

export type MoonPhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

export interface MoonIllumination {
  /** [0, 1] — FORMULAS.md §12's elongation-angle method. */
  illuminatedFraction: number;
  phaseName: MoonPhaseName;
  /** [0, 360) — 0=new, 90=first quarter, 180=full, 270=last quarter. */
  phaseAngleDeg: number;
}

/** FORMULAS.md §12 — 45deg-wide bins centered on each named phase, wrapping at 0/360. */
const PHASE_BIN_WIDTH_DEG = 45;

const PHASE_NAMES_IN_ORDER: readonly [
  MoonPhaseName,
  MoonPhaseName,
  MoonPhaseName,
  MoonPhaseName,
  MoonPhaseName,
  MoonPhaseName,
  MoonPhaseName,
  MoonPhaseName,
] = [
  'new',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'full',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
];

/**
 * FORMULAS.md §12 — phase name from a signed phase angle (0=new, 90=first
 * quarter, 180=full, 270=last quarter, wrapping at 360). Shifting by half a
 * bin width before flooring centers each bin on its defining angle
 * (0/45/.../315) rather than starting the "new" bin exactly at 0deg.
 * Exposed standalone (not just inlined in `moonIllumination` below) so the
 * eight bin boundaries are directly testable with exact synthetic angles,
 * not just whatever angle a real date happens to produce.
 */
export function moonPhaseName(phaseAngleDeg: number): MoonPhaseName {
  const shifted = mod(phaseAngleDeg + PHASE_BIN_WIDTH_DEG / 2, 360);
  const index = Math.floor(shifted / PHASE_BIN_WIDTH_DEG);
  // `mod()` guarantees shifted in [0,360), so index is always in [0,7] —
  // bounds-checked by construction, same class of safe `!` as the static
  // dataset fix (see DECISIONS.md).
  return PHASE_NAMES_IN_ORDER[index]!;
}

/**
 * FORMULAS.md §12 — illuminated fraction + phase name/angle for a given
 * instant. Geocentric (no observer needed — the Moon's phase is the same
 * for every observer on Earth at a given moment, unlike its alt/az).
 */
export function moonIllumination(jd: number): MoonIllumination {
  const moonEcliptic = moonEclipticPosition(jd);
  const moonEq = moonEquatorialPosition(jd);
  const sunEq = sunEquatorialPosition(jd);
  const sunLambdaDeg = sunEclipticLongitudeDeg(jd);

  const sunDecRad = degToRad(sunEq.decDeg);
  const moonDecRad = degToRad(moonEq.decDeg);
  const cosPsi = clamp(
    Math.sin(sunDecRad) * Math.sin(moonDecRad) +
      Math.cos(sunDecRad) * Math.cos(moonDecRad) * Math.cos(degToRad(moonEq.raDeg - sunEq.raDeg)),
    -1,
    1,
  );

  const illuminatedFraction = clamp((1 - cosPsi) / 2, 0, 1);
  const phaseAngleDeg = mod(moonEcliptic.eclipticLongitudeDeg - sunLambdaDeg, 360);

  return {
    illuminatedFraction,
    phaseName: moonPhaseName(phaseAngleDeg),
    phaseAngleDeg,
  };
}

export interface MoonRiseSet {
  /** Next rise after `now`, or null if none found within the search window. */
  riseUtc: Date | null;
  /** Next set after `now`, or null if none found within the search window. */
  setUtc: Date | null;
}

/** 10min — well under the Moon's horizon-crossing timescale, so a real crossing can never be stepped over. */
const RISE_SET_COARSE_STEP_SECONDS = 600;
/** > one full moonrise-to-moonrise cycle (~24h50m) — guarantees both a rise and a set are found when present. */
const DEFAULT_RISE_SET_SEARCH_HOURS = 48;

/**
 * FORMULAS.md §12 — next moonrise/moonset after `now`: a coarse forward
 * scan brackets each 0deg-altitude crossing, then `bisectionSolve` (§6,
 * `math-utils.ts`) refines it — the existing generic solver reused
 * unmodified, not reimplemented. Set-crossings use `-altitude` as the
 * bisected function so the (necessarily increasing-only) solver still
 * applies to a descending crossing. `searchHours` is overridable so tests
 * can force the "not found" branch deterministically with a tiny window,
 * rather than relying on a real high-latitude edge case.
 */
export function nextMoonRiseSet(
  observerLatDeg: number,
  observerLonEastDeg: number,
  now: Date,
  searchHours: number = DEFAULT_RISE_SET_SEARCH_HOURS,
): MoonRiseSet {
  const altitudeAtOffset = (offsetSeconds: number): number =>
    moonAltitudeDeg(
      new Date(now.getTime() + offsetSeconds * 1000),
      observerLatDeg,
      observerLonEastDeg,
    );

  let riseSeconds: number | null = null;
  let setSeconds: number | null = null;

  let prevOffset = 0;
  let prevAlt = altitudeAtOffset(0);
  const maxOffsetSeconds = searchHours * 3600;

  for (
    let offset = RISE_SET_COARSE_STEP_SECONDS;
    offset <= maxOffsetSeconds;
    offset += RISE_SET_COARSE_STEP_SECONDS
  ) {
    const alt = altitudeAtOffset(offset);

    if (riseSeconds === null && prevAlt < 0 && alt >= 0) {
      riseSeconds = bisectionSolve(altitudeAtOffset, 0, prevOffset, offset);
    }
    if (setSeconds === null && prevAlt >= 0 && alt < 0) {
      setSeconds = bisectionSolve((t) => -altitudeAtOffset(t), 0, prevOffset, offset);
    }
    if (riseSeconds !== null && setSeconds !== null) break;

    prevOffset = offset;
    prevAlt = alt;
  }

  return {
    riseUtc: riseSeconds !== null ? new Date(now.getTime() + riseSeconds * 1000) : null,
    setUtc: setSeconds !== null ? new Date(now.getTime() + setSeconds * 1000) : null,
  };
}
