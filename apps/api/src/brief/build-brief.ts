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
import { selectLearningMoment } from './learning-moment.js';
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
): DailyBrief {
  // Sky Anchor is pure Sun-position math over observer/now — it has no
  // external source to fail, so it always resolves (ARCHITECTURE.md §5's
  // top-priority "always works" card).
  const skyAnchor = okCard(buildSkyAnchorCard(observerLatDeg, observerLonDeg, now));

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

  const status = skyAnchor.status === 'ok' || spaceWeather.status === 'ok' ? 'ok' : 'unavailable';

  return {
    observer: { latDeg: observerLatDeg, lonDeg: observerLonDeg },
    generatedAt: now.toISOString(),
    status,
    skyAnchor,
    spaceWeather,
    learningMoment: selectLearningMoment(now),
  };
}
