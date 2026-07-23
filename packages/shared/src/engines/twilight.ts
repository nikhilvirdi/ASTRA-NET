import { TWILIGHT_ISS_AURORA_DEG, TWILIGHT_STARS_DEG } from '../constants.js';

/**
 * DESIGN_SPEC.md §2 — nautical/astronomical twilight boundary. Not a
 * FORMULAS.md constant (FORMULAS.md §0 only names the civil/nautical and
 * astronomical/night boundaries, reused below as TWILIGHT_ISS_AURORA_DEG and
 * TWILIGHT_STARS_DEG); sourced from DESIGN_SPEC.md's phase table instead,
 * per DECISIONS.md's 2026-07-23 addendum ratifying this function's home in
 * packages/shared.
 */
const TWILIGHT_NAUTICAL_ASTRONOMICAL_DEG = -12;

export type TwilightPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';

export interface TwilightState {
  phase: TwilightPhase;
  /**
   * Continuous, monotonic in [0, 3] — DESIGN_SPEC.md §2's "transitions are
   * continuous, not stepped" requirement. 0 = fully day (sunAltDeg >= 0deg),
   * 1 = civil/nautical boundary (-6deg), 2 = nautical/astronomical boundary
   * (-12deg), 3 = astronomical/night boundary and beyond (sunAltDeg <=
   * -18deg). Day and night are flat plateaus at the two ends of the scale —
   * DESIGN_SPEC.md's table gives each a single fixed description ("Pale,
   * cool, high-key" / "Full dark, minimum luminance"), not a range, so
   * there is no further gradient to encode past their one named boundary.
   * Civil/nautical/astronomical each occupy one linear unit segment between
   * their two named boundaries. A rendering layer interpolates between the
   * color stops at floor(value) and ceil(value) using its fractional part —
   * this function's contract stops at the number, never a color.
   */
  value: number;
}

/**
 * DESIGN_SPEC.md §2 — twilight phase + continuous interpolation value for a
 * given Sun altitude (from sun-position.ts's sunAltitudeDeg). Boundary
 * ownership: each exact threshold belongs to the darker/next phase, matching
 * the real convention that civil twilight *ends* the instant the Sun reaches
 * -6deg (US Naval Observatory definition) — i.e. exactly 0deg is 'civil',
 * exactly -6deg is 'nautical', exactly -12deg is 'astronomical', exactly
 * -18deg is 'night'.
 */
export function twilightStateForSunAltitude(sunAltDeg: number): TwilightState {
  if (sunAltDeg > 0) {
    return { phase: 'day', value: 0 };
  }
  if (sunAltDeg > TWILIGHT_ISS_AURORA_DEG) {
    return { phase: 'civil', value: (0 - sunAltDeg) / 6 };
  }
  if (sunAltDeg > TWILIGHT_NAUTICAL_ASTRONOMICAL_DEG) {
    return { phase: 'nautical', value: 1 + (-sunAltDeg - 6) / 6 };
  }
  if (sunAltDeg > TWILIGHT_STARS_DEG) {
    return { phase: 'astronomical', value: 2 + (-sunAltDeg - 12) / 6 };
  }
  return { phase: 'night', value: 3 };
}
