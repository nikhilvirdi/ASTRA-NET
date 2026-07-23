/**
 * ISS card (ARCHITECTURE.md §5's second-priority card). Two independent
 * sub-fields:
 *  - `position`: current lat/lon/alt, sourced from the poller's centrally
 *    polled `iss` store slot (fast tier, live).
 *  - `nextPass`: the soonest upcoming visible pass. This is inherently
 *    observer-specific (depends on the request's lat/lon), so it cannot
 *    come from the central store the way position does — the HTTP layer
 *    fetches it on-demand per request (mirroring the precedent
 *    API_SOURCES.md already documents for Open-Meteo: "on-demand per
 *    Best-Spot query") and passes the already-fetched result in here.
 *    See DECISIONS.md.
 *
 * Either sub-field can be null independently without blanking the other —
 * this whole card only counts as "unavailable" (ARCHITECTURE.md §5) when
 * both are null.
 */

import type {
  N2yoPositionsData,
  N2yoVisualPass,
  N2yoVisualPassesData,
} from '../clients/n2yo/index.js';
import type { SourceState } from '../poller/store.js';

export interface IssPositionField {
  latitude: number;
  longitude: number;
  altitude: number;
  timestampUtc: number;
  fetchedAt: string | null;
  healthy: boolean;
}

export interface IssNextPassField {
  startUtc: number;
  maxUtc: number;
  endUtc: number;
  maxElevationDeg: number;
  magnitude: number;
  durationSeconds: number;
  /**
   * Where on the horizon the pass starts/peaks/ends — straight from the
   * same N2YO visualpasses response as the timing fields above (already
   * fetched and schema-validated by the Phase 1 client; exposure only,
   * nothing refetched or recomputed).
   */
  startAzimuthDeg: number;
  startAzimuthCompass: string;
  maxAzimuthDeg: number;
  maxAzimuthCompass: string;
  endAzimuthDeg: number;
  endAzimuthCompass: string;
}

export interface IssCard {
  position: IssPositionField | null;
  nextPass: IssNextPassField | null;
}

/** Earliest pass that hasn't started yet, by `startUtc` (seconds since epoch) — not assumed pre-sorted. */
function selectNextPass(passes: N2yoVisualPass[], now: Date): N2yoVisualPass | null {
  const nowSeconds = now.getTime() / 1000;
  return passes
    .filter((p) => p.startUtc >= nowSeconds)
    .reduce<N2yoVisualPass | null>((earliest, p) => {
      if (earliest === null) return p;
      return p.startUtc < earliest.startUtc ? p : earliest;
    }, null);
}

export function buildIssCard(
  issState: SourceState<N2yoPositionsData>,
  visualPasses: N2yoVisualPassesData | null,
  now: Date,
): IssCard {
  const firstPosition = issState.data?.positions?.[0] ?? null;
  const position: IssPositionField | null = firstPosition
    ? {
        latitude: firstPosition.latitude,
        longitude: firstPosition.longitude,
        altitude: firstPosition.altitude,
        timestampUtc: firstPosition.timestamp,
        fetchedAt: issState.fetchedAt,
        healthy: issState.healthy,
      }
    : null;

  const nextPassRaw = visualPasses?.passes ? selectNextPass(visualPasses.passes, now) : null;
  const nextPass: IssNextPassField | null = nextPassRaw
    ? {
        startUtc: nextPassRaw.startUtc,
        maxUtc: nextPassRaw.maxUtc,
        endUtc: nextPassRaw.endUtc,
        maxElevationDeg: nextPassRaw.maxElevation,
        magnitude: nextPassRaw.magnitude,
        durationSeconds: nextPassRaw.duration,
        startAzimuthDeg: nextPassRaw.startAzimuth,
        startAzimuthCompass: nextPassRaw.startAzimuthCompass,
        maxAzimuthDeg: nextPassRaw.maxAzimuth,
        maxAzimuthCompass: nextPassRaw.maxAzimuthCompass,
        endAzimuthDeg: nextPassRaw.endAzimuth,
        endAzimuthCompass: nextPassRaw.endAzimuthCompass,
      }
    : null;

  return { position, nextPass };
}
