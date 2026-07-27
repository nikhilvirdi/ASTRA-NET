/**
 * Candidate observation-site generation for `/api/best-spot`
 * (WORKPLAN.md Phase 9).
 *
 * Neither FORMULAS.md nor DESIGN_SPEC.md §12 specifies a generation
 * strategy, so this is a deliberate, documented choice rather than a
 * derived one — see DECISIONS.md.
 *
 * **A deterministic polar grid, not a search over real places.** Concentric
 * rings of equally-spaced bearings around the observer, plus the observer's
 * own position as the zero-travel baseline. The envelope is tied to §11's
 * own `travel = exp(-distance_km / 50)`: past ~60 km the travel term has
 * decayed below 0.3 and no realistic darkness gain can recover it, so
 * searching further would only produce sites that can never rank.
 *
 * **Sites are labelled by bearing and distance, never by place name.**
 * DESIGN_SPEC.md §12's mockup shows "CHERRY VALLEY", but no geocoder or
 * place-name dataset exists anywhere in ARCHITECTURE.md, and inventing
 * plausible-sounding names for grid points would be fabricated data of
 * exactly the kind this codebase has already had to strip out once. The
 * label is honest and derived; swapping in real names later is a
 * data-source decision, not a schema change.
 */

import { destinationPoint, haversineDistanceKm, type GeoPoint } from '@astranet/shared';

/** Ring radii in km. Tied to §11's 50 km travel-decay constant — see the header note. */
export const CANDIDATE_RING_RADII_KM = [10, 25, 40, 55] as const;

/** Bearings sampled on each ring: the 8 principal compass points. */
export const CANDIDATE_BEARINGS_DEG = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const COMPASS_BY_BEARING: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SW',
  270: 'W',
  315: 'NW',
};

export interface CandidateSite {
  /** Stable within a response; derived from the grid position, not random. */
  id: string;
  /** Honest derived label, e.g. "NE 25 km". The observer's own site is "Your location". */
  label: string;
  latDeg: number;
  lonDeg: number;
  /** Great-circle km from the observer — measured, not assumed from the ring radius. */
  distanceKm: number;
  /** Degrees clockwise from true north; null for the observer's own position. */
  bearingDeg: number | null;
  /** 8-point compass label; null for the observer's own position. */
  compass: string | null;
}

/**
 * Generates the candidate set for an observer. Deterministic: the same
 * observer always yields the same sites in the same order, so a response is
 * reproducible and diffable.
 */
export function generateCandidateSites(observer: GeoPoint): CandidateSite[] {
  const sites: CandidateSite[] = [
    {
      id: 'origin',
      label: 'Your location',
      latDeg: observer.latDeg,
      lonDeg: observer.lonDeg,
      distanceKm: 0,
      bearingDeg: null,
      compass: null,
    },
  ];

  for (const radiusKm of CANDIDATE_RING_RADII_KM) {
    for (const bearingDeg of CANDIDATE_BEARINGS_DEG) {
      const point = destinationPoint(observer, bearingDeg, radiusKm);
      const compass = COMPASS_BY_BEARING[bearingDeg]!;
      sites.push({
        id: `r${radiusKm}-b${bearingDeg}`,
        label: `${compass} ${radiusKm} km`,
        latDeg: point.latDeg,
        lonDeg: point.lonDeg,
        // Measured back from the generated coordinate rather than reusing the
        // nominal radius, so the distance the user is shown is the distance to
        // the point actually scored.
        distanceKm: haversineDistanceKm(observer, point),
        bearingDeg,
        compass,
      });
    }
  }

  return sites;
}
