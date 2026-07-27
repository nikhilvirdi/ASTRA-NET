/** FORMULAS.md §11 — clarity from Open-Meteo cloud fraction. */
export function clarityFromCloudFraction(cloudFraction: number): number {
  return 1 - cloudFraction;
}

/** FORMULAS.md §11 — darkness from Bortle scale (1 = darkest -> 1.0, 9 -> 0). */
export function darknessFromBortle(bortle: number): number {
  return (9 - bortle) / 8;
}

/** FORMULAS.md §11 — travel decay with distance. */
const TRAVEL_DECAY_KM = 50;

export function travelDecay(distanceKm: number): number {
  return Math.exp(-distanceKm / TRAVEL_DECAY_KM);
}

/** FORMULAS.md §11 — multiplicative score: any zero factor kills the site. */
export function bestSpotScore(cloudFraction: number, bortle: number, distanceKm: number): number {
  return (
    clarityFromCloudFraction(cloudFraction) * darknessFromBortle(bortle) * travelDecay(distanceKm)
  );
}

/**
 * FORMULAS.md §11 — aurora-night variant: score * aurora_factor.
 *
 * `auroraFactorNormalized` must already be normalized to [0,1] by the
 * caller — use `auroraStrengthToFactor` (aurora.ts), which implements
 * §11's `aurora_factor = clamp(strength_deg / 20, 0, 1)`. This function
 * only implements the multiplication itself.
 *
 * §11 is explicit that this must **not** be applied when aurora isn't
 * visible: a clamped-to-0 factor would zero out an otherwise-good site.
 * Callers decide relevance; this function does not guess.
 */
export function bestSpotScoreAurora(score: number, auroraFactorNormalized: number): number {
  return score * auroraFactorNormalized;
}
