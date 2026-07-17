/**
 * `buildBrief` — the pure core of `/api/brief` (WORKPLAN.md Phase 4,
 * ARCHITECTURE.md §5's degradation contract). Composes the poller's
 * in-memory state into independent cards; a single source failing blanks
 * only its own card, never the whole response, and the Brief renders if
 * ANY card resolves.
 *
 * Deliberately takes only already-fetched `pollerState` plus the request's
 * observer coordinates and `now` — no I/O, no clock reads, fully
 * unit-testable without a network or a running poller. Fields that need a
 * live per-request fetch (ISS next-pass) are composed at the HTTP layer
 * and passed in separately, not fetched here.
 */

import { buildSkyAnchorCard, type SkyAnchorCard } from './sky-anchor-card.js';
import { buildSpaceWeatherCard, type SpaceWeatherCard } from './space-weather-card.js';
import { buildIssCard, type IssCard } from './iss-card.js';
import { selectLearningMoment } from './learning-moment.js';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';
import type { PollerState } from '../poller/store.js';

export interface BriefCard<T> {
  status: 'ok' | 'unavailable';
  data: T | null;
}

export interface DailyBrief {
  observer: { latDeg: number; lonDeg: number };
  generatedAt: string;
  /** True if at least one card resolved — the Brief always renders when this is true. */
  status: 'ok' | 'unavailable';
  skyAnchor: BriefCard<SkyAnchorCard>;
  iss: BriefCard<IssCard>;
  spaceWeather: BriefCard<SpaceWeatherCard>;
  learningMoment: string;
}

function okCard<T>(data: T): BriefCard<T> {
  return { status: 'ok', data };
}

const UNAVAILABLE_CARD: BriefCard<never> = { status: 'unavailable', data: null };

export function buildBrief(
  pollerState: PollerState,
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
  /**
   * Pre-fetched by the HTTP layer, not by this pure core — next-pass is
   * observer-specific and needs a live per-request N2YO call. See
   * `iss-card.ts`'s header comment and DECISIONS.md.
   */
  issVisualPasses: N2yoVisualPassesData | null,
): DailyBrief {
  // Sky Anchor is pure Sun-position math over observer/now — it has no
  // external source to fail, so it always resolves (ARCHITECTURE.md §5's
  // top-priority "always works" card).
  const skyAnchor = okCard(buildSkyAnchorCard(observerLatDeg, observerLonDeg, now));

  const issCardData = buildIssCard(pollerState.iss, issVisualPasses, now);
  const iss: BriefCard<IssCard> =
    issCardData.position !== null || issCardData.nextPass !== null
      ? okCard(issCardData)
      : UNAVAILABLE_CARD;

  const spaceWeatherHasAnySource =
    pollerState.solarWind.data !== null || pollerState.spaceWeatherForecast.data !== null;
  const spaceWeather: BriefCard<SpaceWeatherCard> = spaceWeatherHasAnySource
    ? okCard(
        buildSpaceWeatherCard(
          pollerState.solarWind,
          pollerState.spaceWeatherForecast,
          pollerState.donki,
          observerLatDeg,
          observerLonDeg,
          now,
        ),
      )
    : UNAVAILABLE_CARD;

  const status =
    skyAnchor.status === 'ok' || iss.status === 'ok' || spaceWeather.status === 'ok'
      ? 'ok'
      : 'unavailable';

  return {
    observer: { latDeg: observerLatDeg, lonDeg: observerLonDeg },
    generatedAt: now.toISOString(),
    status,
    skyAnchor,
    iss,
    spaceWeather,
    learningMoment: selectLearningMoment(now),
  };
}
