/**
 * NEO/imagery card (ARCHITECTURE.md §5's lowest-priority card). Two
 * independent sub-fields, same "one down doesn't blank the other" rule as
 * the ISS card:
 *  - `neo`: the single closest current-window close approach (NASA NeoWs,
 *    slow tier), with diameter computed via FORMULAS.md §10 rather than
 *    trusting NeoWs's own estimated-diameter range directly.
 *  - `imagery`: the current GIBS tile URL (never fails — no network call,
 *    pure URL construction per `clients/gibs`).
 */

import { missDistanceInLunarDistances, neoDiameterKm } from '@astranet/shared';
import { getGibsTileUrl, type GibsLayerOptions } from '../clients/gibs/index.js';
import type { NasaNeowsData, NeowsCloseApproach, NeowsObject } from '../clients/nasa/index.js';
import type { SourceState } from '../poller/store.js';

export interface NeoField {
  id: string;
  name: string;
  nasaJplUrl: string;
  isPotentiallyHazardous: boolean;
  /** FORMULAS.md §10 — from absolute magnitude H; null when NeoWs didn't supply H. */
  diameterKm: number | null;
  closeApproachDate: string;
  missDistanceKm: number;
  missDistanceLunarDistances: number;
  velocityKmS: number;
}

export interface ImageryField {
  tileUrl: string;
  layer: string;
  date: string;
}

export interface NeoImageryCard {
  neo: NeoField | null;
  imagery: ImageryField | null;
}

interface ClosestApproachMatch {
  object: NeowsObject;
  approach: NeowsCloseApproach;
}

/** Closest current-window flyby across all objects, by miss distance — the simplest, least-invented "most notable" policy. */
function selectClosestApproach(objects: NeowsObject[]): ClosestApproachMatch | null {
  return objects.reduce<ClosestApproachMatch | null>((closest, object) => {
    return object.closeApproaches.reduce<ClosestApproachMatch | null>((innerClosest, approach) => {
      if (innerClosest === null || approach.missDistanceKm < innerClosest.approach.missDistanceKm) {
        return { object, approach };
      }
      return innerClosest;
    }, closest);
  }, null);
}

export function buildNeoImageryCard(
  neows: SourceState<NasaNeowsData>,
  gibs: SourceState<GibsLayerOptions>,
): NeoImageryCard {
  const closest = selectClosestApproach(neows.data?.objects ?? []);
  const neo: NeoField | null = closest
    ? {
        id: closest.object.id,
        name: closest.object.name,
        nasaJplUrl: closest.object.nasaJplUrl,
        isPotentiallyHazardous: closest.object.isPotentiallyHazardous,
        diameterKm:
          closest.object.absoluteMagnitudeH !== null
            ? neoDiameterKm(closest.object.absoluteMagnitudeH)
            : null,
        closeApproachDate: closest.approach.date,
        missDistanceKm: closest.approach.missDistanceKm,
        missDistanceLunarDistances: missDistanceInLunarDistances(closest.approach.missDistanceKm),
        velocityKmS: closest.approach.velocityKmS,
      }
    : null;

  const imagery: ImageryField | null = gibs.data
    ? {
        tileUrl: getGibsTileUrl(gibs.data),
        layer: gibs.data.layer,
        date: gibs.data.date,
      }
    : null;

  return { neo, imagery };
}
