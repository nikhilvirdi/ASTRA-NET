import { GEOMAG_POLE_LAT_DEG, GEOMAG_POLE_LON_DEG } from '../constants.js';
import { clamp, degToRad, radToDeg } from '../math-utils.js';

/** FORMULAS.md §7 — horizon-view margin: aurora at ~110km is visible low on the horizon further south. */
const AURORA_HORIZON_MARGIN_DEG = 4;

/** FORMULAS.md §11 — aurora-strength saturation point for [0,1] normalization. */
const AURORA_STRENGTH_SATURATION_DEG = 20;

/**
 * FORMULAS.md §7 — geomagnetic latitude via the dipole approximation.
 * Observer lat/lon in degrees; pole location from FORMULAS.md §0.
 */
export function geomagneticLatitudeDeg(observerLatDeg: number, observerLonDeg: number): number {
  const phi = degToRad(observerLatDeg);
  const theta = degToRad(observerLonDeg);
  const phiP = degToRad(GEOMAG_POLE_LAT_DEG);
  const thetaP = degToRad(GEOMAG_POLE_LON_DEG);

  const sinLambdaM =
    Math.sin(phi) * Math.sin(phiP) + Math.cos(phi) * Math.cos(phiP) * Math.cos(theta - thetaP);
  return radToDeg(Math.asin(clamp(sinLambdaM, -1, 1)));
}

/** FORMULAS.md §7 — equatorward auroral-oval boundary, geomagnetic latitude degrees. */
export function auroralOvalBoundaryDeg(kp: number): number {
  return 66 - 2 * kp;
}

export interface AuroraVisibility {
  visible: boolean;
  strength: number;
}

/**
 * FORMULAS.md §7 — full visibility check: visible if |lambda_m| >=
 * lambda_b - margin_deg; strength is that same margin (larger = better
 * placed, negative = not visible).
 */
export function auroraVisibility(
  observerLatDeg: number,
  observerLonDeg: number,
  kp: number,
): AuroraVisibility {
  const lambdaM = geomagneticLatitudeDeg(observerLatDeg, observerLonDeg);
  const boundaryDeg = auroralOvalBoundaryDeg(kp);
  const strength = Math.abs(lambdaM) - (boundaryDeg - AURORA_HORIZON_MARGIN_DEG);
  return { visible: strength >= 0, strength };
}

/**
 * FORMULAS.md §11 — normalize §7's unbounded `strength` (degrees) to [0,1]
 * for use as the aurora-nights score multiplier: clamp(strength / 20, 0, 1).
 *
 * `strengthDeg` is only meaningful when >= 0 (i.e. §7's `visible` is true);
 * negative input clamps to 0 rather than throwing, since `clamp` alone
 * already produces the correct, consistent result for that precondition
 * violation without a separate branch.
 */
export function auroraStrengthToFactor(strengthDeg: number): number {
  return clamp(strengthDeg / AURORA_STRENGTH_SATURATION_DEG, 0, 1);
}
