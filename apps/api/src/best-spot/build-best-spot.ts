/**
 * `buildBestSpot` — the pure core of `/api/best-spot` (WORKPLAN.md Phase 9,
 * FORMULAS.md §11, DESIGN_SPEC.md §12).
 *
 * Mirrors `build-brief.ts`: takes only already-fetched inputs plus the
 * observer and `now`, does no I/O and reads no clock, and applies
 * ARCHITECTURE.md §5's degradation contract — one failing source blanks its
 * own component, never the whole response.
 *
 * **All scoring is §11's engine from `packages/shared`.** No factor is
 * recomputed here; this module only decides which factors are *available*
 * and composes them. `clarityFromCloudFraction`, `darknessFromBortle`,
 * `travelDecay`, `bestSpotScore`, `bestSpotScoreAurora`,
 * `auroraVisibility` and `auroraStrengthToFactor` all come from the shared
 * package.
 */

import {
  auroraStrengthToFactor,
  auroraVisibility,
  bestSpotScoreAurora,
  clarityFromCloudFraction,
  darknessFromBortle,
  travelDecay,
  type GeoPoint,
} from '@astranet/shared';
import type { OpenMeteoData } from '../clients/open-meteo/index.js';
import { selectNearestByTimeTag } from '../util/time-match.js';
import type { CandidateSite } from './candidates.js';

/** Which event the ranking is tuned for. `null` is plain §11 clarity x darkness x travel. */
export type BestSpotEvent = 'aurora' | null;

export interface ClarityComponent {
  /** §11 `clarity = 1 - cloud_fraction`, or null when cloud data is unavailable. */
  factor: number | null;
  /** What DESIGN_SPEC.md §12 prints beside the bar ("12% cloud"). */
  cloudCoverPercent: number | null;
  /** The forecast hour this reading is for — UTC ISO, never a naive local string. */
  forecastTime: string | null;
  available: boolean;
}

export interface DarknessComponent {
  /** §11 `darkness = (9 - bortle) / 8`. */
  factor: number;
  /** What DESIGN_SPEC.md §12 prints beside the bar ("BORTLE 3"). */
  bortleClass: number;
}

export interface TravelComponent {
  /** §11 `travel = exp(-distance_km / 50)`. */
  factor: number;
  /** What DESIGN_SPEC.md §12 prints beside the bar ("42 km"). */
  distanceKm: number;
  bearingDeg: number | null;
  compass: string | null;
  /**
   * DESIGN_SPEC.md §12's mockup shows a drive time ("38 min"). Always null
   * today: no routing service exists in ARCHITECTURE.md, and deriving a
   * time from an assumed average speed would be a fabricated number
   * presented as a measurement. Present in the schema so adding a routing
   * source later is not a breaking change — see DECISIONS.md.
   */
  travelMinutes: number | null;
}

export interface AuroraComponent {
  /** §11 `aurora_factor = clamp(strength_deg / 20, 0, 1)`. */
  factor: number;
  /** §7 strength: degrees inside the auroral oval boundary. Negative means outside. */
  strengthDeg: number;
  visible: boolean;
  /** The Kp the whole ranking was computed against. */
  kp: number;
}

export interface BestSpotSite {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
  /** 1-based position in `sites`, which is already sorted best-first. */
  rank: number;
  /** The composed §11 score this site was ranked on. */
  score: number;
  clarity: ClarityComponent;
  darkness: DarknessComponent;
  travel: TravelComponent;
  /** Null unless the ranking is aurora-tuned and a Kp was available. */
  aurora: AuroraComponent | null;
}

export interface BestSpotRanking {
  /** Which factors actually went into `score`. */
  basis: 'clarity-darkness-travel' | 'darkness-travel';
  clarityAvailable: boolean;
  /** True only when the aurora factor really multiplied into the scores. */
  auroraApplied: boolean;
  /**
   * DESIGN_SPEC.md §12's "mono note" for the header, or null when the
   * ranking ran on everything. Plain sentence; the frontend styles it.
   */
  note: string | null;
}

export interface BestSpotPayload {
  observer: { latDeg: number; lonDeg: number };
  generatedAt: string;
  /** The instant the ranking is for — cloud cover is read at this hour. */
  targetTime: string;
  /** 'unavailable' only when not a single candidate could be scored at all. */
  status: 'ok' | 'unavailable';
  ranking: BestSpotRanking;
  /** Sorted best-first. Empty only when `status` is 'unavailable'. */
  sites: BestSpotSite[];
}

export interface CandidateObservation {
  candidate: CandidateSite;
  /** Cloud forecast for this candidate, or null if the batch failed. */
  cloud: OpenMeteoData | null;
  /** Bortle 1-9 for this candidate, or null if the atlas is unavailable. */
  bortle: number | null;
}

export interface BuildBestSpotInput {
  observer: GeoPoint;
  observations: CandidateObservation[];
  /** Nearest-forecast Kp, or null when SWPC is down. Required for aurora tuning. */
  kp: number | null;
  event: BestSpotEvent;
  targetTime: Date;
  now: Date;
}

const CLOUD_UNAVAILABLE_NOTE =
  'Cloud data unavailable — ranking is running on darkness and travel only, at reduced confidence.';
const AURORA_UNAVAILABLE_NOTE =
  'No aurora is visible from any candidate site tonight — ranking fell back to the standard clarity, darkness and travel score.';

/** Cloud cover at the hour nearest `targetTime`, or null when there is none. */
function selectCloudCoverPercent(
  cloud: OpenMeteoData | null,
  targetTime: Date,
): { cloudCoverPercent: number; forecastTime: string } | null {
  const hourly = cloud?.hourly;
  if (!hourly) return null;

  // Reuses the same nearest-entry selection the Brief's Kp lookup and the
  // accuracy job use, rather than a second implementation of "closest
  // timestamp" — `time` is already a UTC ISO string by the client boundary.
  // An empty array falls out here as `null`, so it needs no separate guard.
  const nearest = selectNearestByTimeTag(
    hourly.map((h) => ({ ...h, timeTag: h.time })),
    targetTime,
  );
  if (nearest === null) return null;

  return { cloudCoverPercent: nearest.cloudCoverPercent, forecastTime: nearest.time };
}

export function buildBestSpot(input: BuildBestSpotInput): BestSpotPayload {
  const { observer, observations, kp, event, targetTime, now } = input;

  interface Scored {
    site: Omit<BestSpotSite, 'rank'>;
    /** Score before any aurora factor — kept so an aurora fallback needn't rescore. */
    baseScore: number;
    /** 0 both when aurora is irrelevant and when this site simply cannot see it. */
    auroraFactor: number;
  }

  const scored: Scored[] = [];

  for (const { candidate, cloud, bortle } of observations) {
    // Darkness is the one factor with no honest substitute: without a Bortle
    // class there is nothing to rank a *dark-sky* site on, so the candidate
    // drops out entirely rather than being ranked on travel alone.
    if (bortle === null) continue;

    const cloudReading = selectCloudCoverPercent(cloud, targetTime);
    const clarityFactor =
      cloudReading === null ? null : clarityFromCloudFraction(cloudReading.cloudCoverPercent / 100);

    const darknessFactor = darknessFromBortle(bortle);
    const travelFactor = travelDecay(candidate.distanceKm);

    // §11 is multiplicative and "any zero kills the site". An unavailable
    // clarity is therefore *omitted* from the product, never passed through
    // as 0 — the same trap §11 calls out explicitly for the aurora factor.
    const baseScore =
      clarityFactor === null
        ? darknessFactor * travelFactor
        : clarityFactor * darknessFactor * travelFactor;

    let aurora: AuroraComponent | null = null;
    let auroraFactor = 0;
    if (event === 'aurora' && kp !== null) {
      const visibility = auroraVisibility(candidate.latDeg, candidate.lonDeg, kp);
      auroraFactor = visibility.visible ? auroraStrengthToFactor(visibility.strength) : 0;
      aurora = {
        factor: auroraFactor,
        strengthDeg: visibility.strength,
        visible: visibility.visible,
        kp,
      };
    }

    scored.push({
      baseScore,
      auroraFactor,
      site: {
        id: candidate.id,
        label: candidate.label,
        latDeg: candidate.latDeg,
        lonDeg: candidate.lonDeg,
        score: baseScore,
        clarity: {
          factor: clarityFactor,
          cloudCoverPercent: cloudReading?.cloudCoverPercent ?? null,
          forecastTime: cloudReading?.forecastTime ?? null,
          available: clarityFactor !== null,
        },
        darkness: { factor: darknessFactor, bortleClass: bortle },
        travel: {
          factor: travelFactor,
          distanceKm: candidate.distanceKm,
          bearingDeg: candidate.bearingDeg,
          compass: candidate.compass,
          travelMinutes: null,
        },
        aurora,
      },
    });
  }

  // §11: rank by `score_aurora` on aurora nights — but only when the night
  // actually has aurora somewhere in range. If nothing is visible, applying
  // the factor would zero every site, which is precisely the failure mode
  // §11 warns against ("would incorrectly zero out an otherwise-good site").
  const auroraApplied = event === 'aurora' && kp !== null && scored.some((s) => s.auroraFactor > 0);

  if (auroraApplied) {
    for (const entry of scored) {
      entry.site.score = bestSpotScoreAurora(entry.baseScore, entry.auroraFactor);
    }
  }

  const clarityAvailable = scored.some((s) => s.site.clarity.available);

  const notes: string[] = [];
  if (!clarityAvailable && scored.length > 0) notes.push(CLOUD_UNAVAILABLE_NOTE);
  if (event === 'aurora' && !auroraApplied && scored.length > 0)
    notes.push(AURORA_UNAVAILABLE_NOTE);

  const sites: BestSpotSite[] = scored
    .slice()
    .sort((a, b) => b.site.score - a.site.score)
    .map((entry, i) => ({ ...entry.site, rank: i + 1 }));

  return {
    observer: { latDeg: observer.latDeg, lonDeg: observer.lonDeg },
    generatedAt: now.toISOString(),
    targetTime: targetTime.toISOString(),
    status: sites.length > 0 ? 'ok' : 'unavailable',
    ranking: {
      basis: clarityAvailable ? 'clarity-darkness-travel' : 'darkness-travel',
      clarityAvailable,
      auroraApplied,
      note: notes.length > 0 ? notes.join(' ') : null,
    },
    sites,
  };
}
