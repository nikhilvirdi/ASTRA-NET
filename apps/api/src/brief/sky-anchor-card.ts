/**
 * Sky Anchor card (ARCHITECTURE.md §5: top of the Brief's degradation
 * priority, "static star catalog, always works"). Deliberately scoped to
 * the Sun-position engine only, not the bright-star catalog binary
 * (`apps/web/public/data/stars.bin`) — that file is a frontend-only asset
 * shipped via jsDelivr per ARCHITECTURE.md §9, and loading it server-side
 * would be a new backend data dependency not named in ARCHITECTURE.md.
 * See DECISIONS.md.
 *
 * This card takes zero I/O and zero poller state — it's a pure function of
 * observer position and time, so it genuinely cannot fail the way a
 * network-backed card can.
 */

import {
  isDarkEnoughForFaintStars,
  isDarkEnoughForIssOrAurora,
  sunAltitudeDeg,
} from '@astranet/shared';

export type TwilightPhase = 'day' | 'twilight' | 'night';

export interface SkyAnchorCard {
  sunAltitudeDeg: number;
  twilightPhase: TwilightPhase;
  /** FORMULAS.md §4 — dark enough for ISS/aurora viewing (sun alt < -6deg). */
  isDarkEnoughForIssOrAurora: boolean;
  /** FORMULAS.md §4 — dark enough for faint-star realism (sun alt < -18deg). */
  isDarkEnoughForFaintStars: boolean;
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

export function buildSkyAnchorCard(
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
): SkyAnchorCard {
  const sunAltDeg = sunAltitudeDeg(now, observerLatDeg, observerLonDeg);

  return {
    sunAltitudeDeg: sunAltDeg,
    twilightPhase: classifyTwilightPhase(sunAltDeg),
    isDarkEnoughForIssOrAurora: isDarkEnoughForIssOrAurora(sunAltDeg),
    isDarkEnoughForFaintStars: isDarkEnoughForFaintStars(sunAltDeg),
  };
}
