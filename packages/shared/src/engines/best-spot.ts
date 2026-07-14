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
 * caller. FORMULAS.md §11 says this factor comes "from §7 `strength`,
 * normalized to [0,1]" but gives no normalization formula for the
 * unbounded `strength` value — see DECISIONS.md. This function only
 * implements the (fully specified) multiplication itself.
 */
export function bestSpotScoreAurora(score: number, auroraFactorNormalized: number): number {
  return score * auroraFactorNormalized;
}
