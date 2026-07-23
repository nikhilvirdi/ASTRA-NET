/**
 * Sky Anchor card (ARCHITECTURE.md §5: top of the Brief's degradation
 * priority, "static star catalog, always works"). Deliberately scoped to
 * the Sun-position engine only, not the bright-star catalog binary
 * (`apps/web/public/data/stars.bin`) — that file is a frontend-only asset
 * shipped via jsDelivr per ARCHITECTURE.md §9, and loading it server-side
 * would be a new backend data dependency not named in ARCHITECTURE.md.
 * See DECISIONS.md.
 *
 * The Sun half of this card takes zero I/O and zero poller state — a pure
 * function of observer position and time — so the card as a whole genuinely
 * cannot fail the way a network-backed card can. The Jupiter sub-field
 * (Phase 7) reads the poller's `horizonsJupiter` slot and degrades to null
 * on its own when that ephemeris is unavailable, without ever blanking the
 * card — the same independent-sub-field pattern as `iss-card.ts`.
 */

import {
  equatorialToHorizontal,
  isDarkEnoughForFaintStars,
  isDarkEnoughForIssOrAurora,
  julianDay,
  sunAltitudeDeg,
  type HorizontalPosition,
} from '@astranet/shared';
import type { HorizonsRaDecData, HorizonsRaDecEntry } from '../clients/jpl-horizons/index.js';
import type { SourceState } from '../poller/store.js';

export type TwilightPhase = 'day' | 'twilight' | 'night';

export interface SkyAnchorCard {
  sunAltitudeDeg: number;
  twilightPhase: TwilightPhase;
  /** FORMULAS.md §4 — dark enough for ISS/aurora viewing (sun alt < -6deg). */
  isDarkEnoughForIssOrAurora: boolean;
  /** FORMULAS.md §4 — dark enough for faint-star realism (sun alt < -18deg). */
  isDarkEnoughForFaintStars: boolean;
  /**
   * Jupiter's real current position for this observer: the poller's JPL
   * Horizons RA/Dec run through the shared FORMULAS.md §3 transform. Null
   * when the Jupiter ephemeris is unavailable — never blanks the card.
   */
  jupiter: HorizontalPosition | null;
}

/**
 * Classifies twilight using only the two frozen thresholds in
 * FORMULAS.md §4/§0 (-6deg, -18deg) — no additional civil/nautical
 * boundaries are defined in the frozen doc, so none are invented here.
 */
export function classifyTwilightPhase(sunAltDeg: number): TwilightPhase {
  if (isDarkEnoughForFaintStars(sunAltDeg)) return 'night';
  if (isDarkEnoughForIssOrAurora(sunAltDeg)) return 'twilight';
  return 'day';
}

/**
 * Ephemeris row nearest to `now` by absolute time distance — not assumed
 * pre-sorted. With the slow tier's hourly steps the pick is at most 30min
 * stale, over which Jupiter's geocentric RA/Dec drift is well under 0.01°.
 */
function selectNearestEntry(entries: HorizonsRaDecEntry[], now: Date): HorizonsRaDecEntry | null {
  const nowMs = now.getTime();
  return entries.reduce<HorizonsRaDecEntry | null>((nearest, entry) => {
    if (nearest === null) return entry;
    return Math.abs(entry.timestampUtcMs - nowMs) < Math.abs(nearest.timestampUtcMs - nowMs)
      ? entry
      : nearest;
  }, null);
}

export function buildSkyAnchorCard(
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
  jupiterEphemeris: SourceState<HorizonsRaDecData>,
): SkyAnchorCard {
  const sunAltDeg = sunAltitudeDeg(now, observerLatDeg, observerLonDeg);

  const nearest =
    jupiterEphemeris.data?.entries != null
      ? selectNearestEntry(jupiterEphemeris.data.entries, now)
      : null;
  const jupiter =
    nearest !== null
      ? equatorialToHorizontal(
          nearest.raDeg,
          nearest.decDeg,
          observerLatDeg,
          observerLonDeg,
          julianDay(now),
        )
      : null;

  return {
    sunAltitudeDeg: sunAltDeg,
    twilightPhase: classifyTwilightPhase(sunAltDeg),
    isDarkEnoughForIssOrAurora: isDarkEnoughForIssOrAurora(sunAltDeg),
    isDarkEnoughForFaintStars: isDarkEnoughForFaintStars(sunAltDeg),
    jupiter,
  };
}
