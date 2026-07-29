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
import { buildNeoImageryCard, type NeoImageryCard } from './neo-imagery-card.js';
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
  neoImagery: BriefCard<NeoImageryCard>;
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
  /**
   * Real rolling accuracy-loop hits/trials (FORMULAS.md §9), queried by
   * the HTTP layer (`predictions/history.ts`) — global scope, not
   * per-user (DECISIONS.md). Same "fetched outside, passed in" shape as
   * `issVisualPasses` above, keeping this core I/O-free.
   */
  predictionHistory: { hits: number; trials: number },
): DailyBrief {
  // Sky Anchor always resolves (ARCHITECTURE.md §5's top-priority "always
  // works" card): its Sun half is pure math over observer/now with no
  // external source to fail, and each planet sub-field degrades to null on
  // its own when that body's Horizons ephemeris is down.
  const skyAnchor = okCard(
    buildSkyAnchorCard(observerLatDeg, observerLonDeg, now, {
      jupiter: pollerState.horizonsJupiter,
      venus: pollerState.horizonsVenus,
      mars: pollerState.horizonsMars,
      saturn: pollerState.horizonsSaturn,
      mercury: pollerState.horizonsMercury,
    }),
  );

  const issCardData = buildIssCard(pollerState.iss, issVisualPasses, now);
  const iss: BriefCard<IssCard> =
    issCardData.position !== null || issCardData.nextPass !== null
      ? okCard(issCardData)
      : UNAVAILABLE_CARD;

  // Availability is decided on the card's own *content*, the same question
  // the ISS and NEO cards above already ask — not on whether the store holds
  // an entry.
  //
  // The previous `solarWind.data !== null || spaceWeatherForecast.data !== null`
  // check could never fail: the poller's total-failure path writes a
  // *non-null* object whose fields are null (`fast-tier.ts`'s
  // `writeSolarWindResult`, and the slow tier's equivalent), so `data` is
  // null only before the very first tick. A complete SWPC outage therefore
  // reported `status: 'ok'` with an empty card for the whole outage.
  //
  // Deliberately not gated on `healthy` either, despite that being the flag
  // ARCHITECTURE.md §5 names. SWPC's documented fallback (API_SOURCES.md) is
  // "use last cached value with an aged freshness stamp; if never fetched
  // this session, shows unavailable" — so a stale-but-real reading has to
  // keep the card *available* while being reported as not live. Gating on
  // `healthy` would blank the card the moment SWPC wavered and discard the
  // value the poller deliberately preserved. `healthy` still travels to the
  // client on `solarLine.live/forecast`, which is what drives the live
  // indicator; it is a freshness signal (§6), not an availability one.
  const spaceWeatherCard = buildSpaceWeatherCard(
    pollerState.solarWind,
    pollerState.spaceWeatherForecast,
    pollerState.donki,
    observerLatDeg,
    observerLonDeg,
    now,
    predictionHistory,
  );
  const spaceWeatherHasReading =
    spaceWeatherCard.solarLine.live.speedKmS !== null ||
    spaceWeatherCard.solarLine.live.kp !== null ||
    spaceWeatherCard.solarLine.forecast.kp !== null;
  const spaceWeather: BriefCard<SpaceWeatherCard> = spaceWeatherHasReading
    ? okCard(spaceWeatherCard)
    : UNAVAILABLE_CARD;

  const neoImageryData = buildNeoImageryCard(pollerState.neows, pollerState.gibs);
  const neoImagery: BriefCard<NeoImageryCard> =
    neoImageryData.neo !== null || neoImageryData.imagery !== null
      ? okCard(neoImageryData)
      : UNAVAILABLE_CARD;

  const status =
    skyAnchor.status === 'ok' ||
    iss.status === 'ok' ||
    spaceWeather.status === 'ok' ||
    neoImagery.status === 'ok'
      ? 'ok'
      : 'unavailable';

  return {
    observer: { latDeg: observerLatDeg, lonDeg: observerLonDeg },
    generatedAt: now.toISOString(),
    status,
    skyAnchor,
    iss,
    spaceWeather,
    neoImagery,
    learningMoment: selectLearningMoment(now),
  };
}
