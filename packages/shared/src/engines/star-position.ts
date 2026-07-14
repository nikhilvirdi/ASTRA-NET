import { PC_LY } from '../constants';
import { clamp } from '../math-utils';

/**
 * FORMULAS.md §1 — bad-parallax guard.
 * Decision: pin invalid parallax (<= 0.2 mas, including negative) to a fixed
 * 100 kpc shell rather than "drop the star", so this stays a total pure
 * function (no null/NaN) — callers that want to exclude the star can filter
 * on the same <= 0.2 mas test themselves.
 */
const INVALID_PARALLAX_SHELL_PC = 100_000;

/** FORMULAS.md §1 — distance from parallax (mas) to parsecs. */
export function distanceFromParallaxPc(parallaxMas: number): number {
  if (parallaxMas <= 0.2) {
    return INVALID_PARALLAX_SHELL_PC;
  }
  return 1000 / parallaxMas;
}

export interface EquatorialCoordinates {
  raRad: number;
  decRad: number;
}

export interface CartesianPosition {
  x: number;
  y: number;
  z: number;
}

/** FORMULAS.md §1 — catalog (RA, Dec, distance) to Cartesian (parsecs). */
export function starCartesianPosition(
  coords: EquatorialCoordinates,
  distancePc: number,
): CartesianPosition {
  const { raRad, decRad } = coords;
  return {
    x: distancePc * Math.cos(decRad) * Math.cos(raRad),
    y: distancePc * Math.cos(decRad) * Math.sin(raRad),
    z: distancePc * Math.sin(decRad),
  };
}

/** FORMULAS.md §1 — light-travel context. */
export function yearsAgo(distancePc: number): number {
  return distancePc * PC_LY;
}

/** FORMULAS.md §2 — brightness from apparent magnitude, clamped to [0, 1]. */
const BRIGHTNESS_M_REF = 6.0;

export function starBrightness(apparentMagnitude: number): number {
  const brightness = 10 ** (-0.4 * (apparentMagnitude - BRIGHTNESS_M_REF));
  return clamp(brightness, 0, 1);
}

/** FORMULAS.md §2 — render point size. */
const POINT_SIZE_M_LIMIT = 6.5;
const POINT_SIZE_K = 0.35;

export function starPointSize(baseSize: number, apparentMagnitude: number): number {
  return baseSize * (1 + POINT_SIZE_K * (POINT_SIZE_M_LIMIT - apparentMagnitude));
}

/** FORMULAS.md §2 — Gaia bp_rp to B-V (Ballesteros input). */
export function bvFromGaiaBpRp(bpRp: number): number {
  return 0.85 * bpRp;
}

/**
 * FORMULAS.md §2 — Ballesteros color-temperature formula from B-V.
 *
 * NOTE: FORMULAS.md §2 also specifies "Then map T_kelvin -> blackbody RGB"
 * but gives no concrete formula or constants for that mapping. That step is
 * intentionally NOT implemented here — see DECISIONS.md. Do not invent an
 * RGB mapping; flag it instead.
 */
export function colorTemperatureKelvin(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}
