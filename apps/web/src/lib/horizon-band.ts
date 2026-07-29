/**
 * Pure layout logic for the Brief's Horizon Band (DESIGN_SPEC.md §9).
 *
 * Extracted from `components/brief/HorizonBand.tsx` for the same reason
 * `phase10-helpers.ts` and `best-spot-helpers.ts` exist: the component is
 * `.tsx` and this project's vitest config only collects
 * `src/**\/*.test.ts`, so logic that needs asserting has to live in a
 * DOM-free module. A compass rose that disagreed with its own azimuths
 * shipped precisely because it was unassertable inside JSX.
 */

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
