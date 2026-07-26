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
 * cannot fail the way a network-backed card can. The planet sub-fields
 * (Jupiter from Phase 7; Venus/Mars/Saturn/Mercury extending the same
 * pattern — see DECISIONS.md) each read their own poller ephemeris slot and
 * degrade to null independently when that body's ephemeris is unavailable,
 * without ever blanking the card or affecting any other body — the same
 * independent-sub-field pattern as `iss-card.ts`.
 */

import {
  equatorialToHorizontal,
  isDarkEnoughForFaintStars,
  isDarkEnoughForIssOrAurora,
  julianDay,
  sunHorizontalPosition,
  type HorizontalPosition,
} from '@astranet/shared';
import type { HorizonsRaDecData, HorizonsRaDecEntry } from '../clients/jpl-horizons/index.js';
import type { SourceState } from '../poller/store.js';

export type TwilightPhase = 'day' | 'twilight' | 'night';

/** One poller ephemeris slot per planet marker, all the same shape. */
export interface PlanetEphemerides {
  jupiter: SourceState<HorizonsRaDecData>;
  venus: SourceState<HorizonsRaDecData>;
  mars: SourceState<HorizonsRaDecData>;
  saturn: SourceState<HorizonsRaDecData>;
  mercury: SourceState<HorizonsRaDecData>;
}

export interface SkyAnchorCard {
  sunAltitudeDeg: number;
  /**
   * Sun's azimuth (degrees, 0=N, clockwise, [0,360)) for this observer —
   * the other half of the FORMULAS.md §3 horizontal position the Sun engine
   * already computes alongside `sunAltitudeDeg`. Non-nullable: like the
   * altitude it is pure math over observer+time with no external source to
   * fail (unlike the planet fields, which depend on the Horizons ephemeris).
   */
  sunAzimuthDeg: number;
  twilightPhase: TwilightPhase;
  /** FORMULAS.md §4 — dark enough for ISS/aurora viewing (sun alt < -6deg). */
  isDarkEnoughForIssOrAurora: boolean;
  /** FORMULAS.md §4 — dark enough for faint-star realism (sun alt < -18deg). */
  isDarkEnoughForFaintStars: boolean;
  /**
   * Each planet's real current position for this observer: the poller's JPL
   * Horizons RA/Dec for that body, run through the shared FORMULAS.md §3
   * transform. Null when that body's ephemeris is unavailable — never
   * blanks the card, and one body's null never affects another's.
   */
  jupiter: HorizontalPosition | null;
  venus: HorizontalPosition | null;
  mars: HorizontalPosition | null;
  saturn: HorizontalPosition | null;
  mercury: HorizontalPosition | null;
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

/**
 * Resolves one body's real position from its poller ephemeris slot: nearest
 * row to `now`, run through the shared FORMULAS.md §3 transform. Null when
 * there's no data at all — shared by all five planet fields since the
 * resolution logic is identical for each, only the input ephemeris differs.
 */
function resolvePlanetPosition(
  ephemeris: SourceState<HorizonsRaDecData>,
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
  jd: number,
): HorizontalPosition | null {
  const nearest =
    ephemeris.data?.entries != null ? selectNearestEntry(ephemeris.data.entries, now) : null;
  return nearest !== null
    ? equatorialToHorizontal(nearest.raDeg, nearest.decDeg, observerLatDeg, observerLonDeg, jd)
    : null;
}

export function buildSkyAnchorCard(
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
  planetEphemerides: PlanetEphemerides,
): SkyAnchorCard {
  const sun = sunHorizontalPosition(now, observerLatDeg, observerLonDeg);
  const sunAltDeg = sun.altitudeDeg;
  const jd = julianDay(now);
  const resolve = (ephemeris: SourceState<HorizonsRaDecData>): HorizontalPosition | null =>
    resolvePlanetPosition(ephemeris, observerLatDeg, observerLonDeg, now, jd);

  return {
    sunAltitudeDeg: sunAltDeg,
    sunAzimuthDeg: sun.azimuthDeg,
    twilightPhase: classifyTwilightPhase(sunAltDeg),
    isDarkEnoughForIssOrAurora: isDarkEnoughForIssOrAurora(sunAltDeg),
    isDarkEnoughForFaintStars: isDarkEnoughForFaintStars(sunAltDeg),
    jupiter: resolve(planetEphemerides.jupiter),
    venus: resolve(planetEphemerides.venus),
    mars: resolve(planetEphemerides.mars),
    saturn: resolve(planetEphemerides.saturn),
    mercury: resolve(planetEphemerides.mercury),
  };
}
