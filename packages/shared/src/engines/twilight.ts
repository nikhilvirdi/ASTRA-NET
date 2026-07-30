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

/**
 * The four surface stops of DESIGN_SPEC.md §4.1's "Sky" ramp, each pinned
 * to the `TwilightState.value` at which its phase *begins*. §4.1 names
 * exactly four surface tokens and §2 names exactly four boundaries, and
 * they line up one-to-one on the integers — no stop is interpolated into
 * existence here:
 *
 *   value 0 (sun alt >= 0deg)  sky-100  "Day surface. Cool paper, not cream."
 *   value 1 (sun alt = -6deg)  sky-600  "Nautical twilight surface."
 *   value 2 (sun alt = -12deg) sky-800  "Astronomical twilight surface."
 *   value 3 (sun alt = -18deg) sky-900  "Night surface. The deepest base."
 *
 * Civil twilight has no surface token of its own in §4.1, and none is
 * invented: it is the 0->1 segment, i.e. the interpolation between the day
 * and nautical surfaces. That is consistent with §2 describing civil as a
 * transition ("Warming. Contrast softens.") rather than a resting state,
 * and with §2's "transitions are continuous, not stepped". See
 * DECISIONS.md for the one part of §2's civil description this ramp
 * cannot express (there is no warm surface token in the locked palette).
 *
 * `sky-950` is deliberately absent: §4.1 restricts it to the 3D scene void
 * and states "the 2D interface never uses pure black."
 */
const SURFACE_RAMP: readonly {
  readonly value: number;
  readonly rgb: readonly [number, number, number];
}[] = [
  { value: 0, rgb: [0xee, 0xf1, 0xf1] },
  { value: 1, rgb: [0x3e, 0x4a, 0x4a] },
  { value: 2, rgb: [0x1c, 0x24, 0x24] },
  { value: 3, rgb: [0x11, 0x18, 0x18] },
];

function toHexPair(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, '0').toUpperCase();
}

/**
 * DESIGN_SPEC.md §2/§4.1 — the interface surface color for a continuous
 * twilight `value` from `twilightStateForSunAltitude`. Channel-wise linear
 * interpolation in sRGB between the two bracketing stops, matching what a
 * CSS color transition between the same two tokens would do (no doc pins
 * an interpolation space; see DECISIONS.md).
 *
 * `value` is clamped to the ramp's [0, 3] domain, so a caller that passes
 * an out-of-range number gets the day or night surface rather than an
 * extrapolated color outside the locked palette. NaN yields the night
 * surface — the safe end for a screen that may be in use outdoors.
 *
 * Returns an uppercase `#RRGGBB` string, the same notation §4.1 uses.
 */
export function surfaceColorForTwilight(value: number): string {
  if (Number.isNaN(value)) {
    return '#111818';
  }
  const clamped = Math.min(3, Math.max(0, value));
  // clamped is always in [0, 3] (Math.max/min behave the same for +/-Infinity
  // as for finite numbers), so floor(clamped) is in {0,1,2,3}; capping at
  // SURFACE_RAMP.length - 2 (= 2) keeps lowerIndex in [0, 2] and lowerIndex + 1
  // in [1, 3] -- both always valid indices into the fixed 4-entry ramp, for
  // every non-NaN `value` (verified exhaustively in twilight.test.ts).
  const lowerIndex = Math.min(SURFACE_RAMP.length - 2, Math.floor(clamped));
  const lower = SURFACE_RAMP[lowerIndex]!;
  const upper = SURFACE_RAMP[lowerIndex + 1]!;

  const t = clamped - lower.value;
  // Same reasoning as above: lower.rgb and upper.rgb are both fixed 3-tuples,
  // so i (from mapping over lower.rgb) is always 0, 1, or 2 -- upper.rgb[i]
  // is always defined, never the `?? channel` fallback this used to need.
  const channels = lower.rgb.map((channel, i) => {
    const target = upper.rgb[i]!;
    return channel + (target - channel) * t;
  });

  return `#${channels.map(toHexPair).join('')}`;
}

/**
 * Convenience composition of the two functions above — the form every
 * rendering caller actually wants, so the `value` never has to be
 * threaded through by hand. Same clamping and same palette.
 */
export function surfaceColorForSunAltitude(sunAltDeg: number): string {
  return surfaceColorForTwilight(twilightStateForSunAltitude(sunAltDeg).value);
}
