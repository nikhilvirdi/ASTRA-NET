/**
 * Pure layout and selection logic for the Brief's Horizon Band
 * (DESIGN_SPEC.md §9). Extracted from `components/brief/HorizonBand.tsx`
 * for the same reason `phase10-helpers.ts` and `best-spot-helpers.ts`
 * exist: the component is `.tsx` and this project's vitest config only
 * collects `src/**\/*.test.ts`, so logic that needs asserting has to live
 * in a DOM-free module.
 *
 * Two defects motivated the extraction, both of which were invisible while
 * this lived inline in JSX — see `horizon-band.test.ts`.
 */

import { isAboveHorizon } from './semantic-zoom';

export interface CompassPoint {
  label: string;
  deg: number;
}

/**
 * The eight principal points, at their real azimuths.
 *
 * Previously this table read `N, NE, E, SE, S, SW, W, N` — `NW` was
 * missing and `N` was duplicated at 360deg — and the component rendered it
 * with flexbox `justify-between`, which spaces items evenly and ignores
 * `deg` entirely. The result was eight evenly-spaced labels where the last
 * gap represented 90deg of sky but was drawn the same width as the 45deg
 * ones, so every mark from `S` rightward pointed at the wrong azimuth.
 *
 * `deg` is now load-bearing: `compassPointLeftPercent` positions each mark
 * from it, so the table and the layout cannot disagree again.
 */
export const COMPASS_POINTS: readonly CompassPoint[] = [
  { label: 'N', deg: 0 },
  { label: 'NE', deg: 45 },
  { label: 'E', deg: 90 },
  { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SW', deg: 225 },
  { label: 'W', deg: 270 },
  { label: 'NW', deg: 315 },
];

/** Azimuth to a left offset across the band, as a CSS percentage. */
export function compassPointLeftPercent(deg: number): number {
  return (deg / 360) * 100;
}

/**
 * Band coordinates for a marker, as CSS percentages.
 *
 * Callers must cull below-horizon bodies with `isAboveHorizon` before
 * calling this. The clamp below therefore only ever absorbs the sub-degree
 * refraction sliver (a body between -34' and 0deg is genuinely *at* the
 * horizon), not a body that is actually beneath it.
 *
 * This function used to clamp with `Math.max(0, alt)` on uncalled input,
 * which drew a Sun at -14deg sitting on the horizon rule — a fabricated
 * position, and the same class of defect as the altitude floor removed
 * from the Explore scene in c2acb7f.
 */
export function markerBandPosition(
  azimuthDeg: number,
  altitudeDeg: number,
): { leftPercent: number; topPercent: number } {
  const clampedAlt = Math.max(0, Math.min(90, altitudeDeg));
  return {
    leftPercent: (azimuthDeg / 360) * 100,
    topPercent: 100 - (clampedAlt / 90) * 100,
  };
}

/**
 * Whether a body belongs on the band at all.
 *
 * Reuses the Explore scene's `isAboveHorizon` rather than re-deriving a
 * threshold, so the two surfaces cull identically and the atmospheric
 * refraction allowance is defined in exactly one place.
 *
 * The band answers "where do I look?", and a body below the horizon is not
 * an answer to that. Absent, not faked.
 */
export function belongsOnBand(altitudeDeg: number): boolean {
  return isAboveHorizon(altitudeDeg);
}

/** Formats a real altitude for a marker sublabel — never floored to zero. */
export function formatAltitude(altitudeDeg: number): string {
  return `Alt ${altitudeDeg.toFixed(1)}°`;
}
