/**
 * Space-weather card: "one solar line" + aurora odds/confidence
 * (ARCHITECTURE.md §8's Daily Brief description; §5's third-priority card).
 *
 * Two independent data needs, kept honestly separate per FORMULAS.md §7's
 * "Kp source: primary = SWPC 3-day forecast Kp" rule and the fast/slow
 * freshness distinction (ARCHITECTURE.md §4's Honesty rule):
 *  - the live line (fast-tier solarWind: RTSW speed + 1-min Kp) — tagged live
 *  - the forecast Kp driving aurora visibility (slow-tier spaceWeatherForecast)
 *    — tagged with its own fetchedAt, never blurred into "live"
 *
 * Confidence is only ever reported when there's a real CME event to reason
 * about (lead-time + source-agreement both need one) — per ARCHITECTURE.md
 * §6, never fabricate a confidence number against nothing. No active CME
 * still yields an honest Kp-forecast-only visibility read, just no
 * `confidence`/`confidenceBand`/`factors`.
 */

import {
  auroraStrengthToFactor,
  auroraVisibility,
  auroralOvalBoundaryDeg,
  geomagneticLatitudeDeg,
  predictAuroraConfidence,
  predictCmeArrival,
  type CmeEvent,
  type ConfidenceBand,
} from '@astranet/shared';
import type { DonkiCmeAnalysis, DonkiCmeEvent, NasaDonkiData } from '../clients/nasa/index.js';
import type {
  SwpcFastData,
  SwpcForecastStatus,
  SwpcKpForecastEntry,
  SwpcRtswPlasma,
  SwpcSlowData,
  SwpcSolarWindEntry,
} from '../clients/swpc/index.js';
import type { SourceState } from '../poller/store.js';

/**
 * DONKI does not publish a measured speed uncertainty per CME analysis, so
 * there is no frozen FORMULAS.md value to use for `predictCmeArrival`'s
 * `v0ErrorKmS`. 10% of v0 is a documented placeholder, not a formula
 * substitution — flagged in DECISIONS.md pending a better source.
 */
const CME_SPEED_ERROR_FRACTION = 0.1;

export interface SolarLineFields {
  headline: string;
  live: {
    speedKmS: number | null;
    kp: number | null;
    fetchedAt: string | null;
    healthy: boolean;
  };
  forecast: {
    kp: number | null;
    status: SwpcForecastStatus | null;
    fetchedAt: string | null;
    healthy: boolean;
  };
}

export interface AuroraCardData {
  kpPredicted: number;
  kpForecastStatus: SwpcForecastStatus;
  kpForecastTimeTag: string;
  visible: boolean;
  strengthDeg: number;
  strengthFactor: number;
  geomagneticLatitudeDeg: number;
  auroraOvalBoundaryDeg: number;
  hasActiveCme: boolean;
  cmeArrivalTime: string | null;
  confidence: number | null;
  confidenceBand: ConfidenceBand | null;
  factors: { lead: number; agreement: number; history: number } | null;
}

export interface SpaceWeatherCard {
  solarLine: SolarLineFields;
  /** Null only when the slow-tier Kp forecast has no data at all to anchor a reading on. */
  aurora: AuroraCardData | null;
}

/** Picks the forecast entry whose timeTag is closest to `now` — the "current" 3-day-forecast Kp. */
export function selectNearestForecastEntry(
  entries: SwpcKpForecastEntry[],
  now: Date,
): SwpcKpForecastEntry | null {
  return entries.reduce<SwpcKpForecastEntry | null>((closest, entry) => {
    if (closest === null) return entry;
    const entryDiff = Math.abs(new Date(entry.timeTag).getTime() - now.getTime());
    const closestDiff = Math.abs(new Date(closest.timeTag).getTime() - now.getTime());
    return entryDiff < closestDiff ? entry : closest;
  }, null);
}

function selectAmbientWindKmS(
  fastPlasma: SwpcRtswPlasma | null,
  slowSolarWind: SwpcSolarWindEntry[] | null,
): number | undefined {
  if (fastPlasma?.protonSpeed != null) return fastPlasma.protonSpeed;
  const latest = slowSolarWind?.[slowSolarWind.length - 1];
  return latest?.speed ?? undefined;
}

/** Prefers the analysis DONKI itself flags most-accurate; else the first with a usable speed. */
function selectCmeAnalysis(analyses: DonkiCmeAnalysis[]): DonkiCmeAnalysis | null {
  const mostAccurate = analyses.find((a) => a.isMostAccurate && a.speed !== null);
  if (mostAccurate) return mostAccurate;
  return analyses.find((a) => a.speed !== null) ?? null;
}

interface ActiveCme {
  event: CmeEvent;
  arrivalTime: Date;
}

/**
 * Selection policy (undefined by FORMULAS.md, logged in DECISIONS.md same as
 * Phase 2's causal-engine single-event gap): among CMEs with a usable speed,
 * take the most recent by startTime whose DBM-solved arrival (FORMULAS.md
 * §6) is still in the future. An event whose predicted arrival has already
 * passed is stale, not "active" — never used for aurora confidence.
 */
function selectActiveCme(
  cmes: DonkiCmeEvent[],
  ambientWindKmS: number | undefined,
  now: Date,
): ActiveCme | null {
  const withStartTime = cmes
    .filter((cme): cme is DonkiCmeEvent & { startTime: string } => cme.startTime !== null)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  for (const cme of withStartTime) {
    const analysis = selectCmeAnalysis(cme.analyses);
    if (!analysis || analysis.speed === null) continue;

    const v0KmS = analysis.speed;
    const v0ErrorKmS = v0KmS * CME_SPEED_ERROR_FRACTION;
    // Transit is solved from the CME's actual departure (startTime), not
    // from `now` — otherwise a CME that left hours ago would be modeled as
    // just now leaving the Sun, understating how close it already is.
    const departure = new Date(cme.startTime);
    const arrival =
      ambientWindKmS === undefined
        ? predictCmeArrival(departure, v0KmS, v0ErrorKmS)
        : predictCmeArrival(departure, v0KmS, v0ErrorKmS, ambientWindKmS);

    if (arrival.arrivalTime.getTime() > now.getTime()) {
      return {
        event: { v0KmS, predictedArrivalTime: arrival.arrivalTime },
        arrivalTime: arrival.arrivalTime,
      };
    }
  }

  return null;
}

function buildSolarLine(
  solarWindFast: SourceState<SwpcFastData>,
  spaceWeatherForecast: SourceState<SwpcSlowData>,
  nearestForecastEntry: SwpcKpForecastEntry | null,
): SolarLineFields {
  const liveSpeed = solarWindFast.data?.rtswPlasma?.protonSpeed ?? null;
  const liveKp = solarWindFast.data?.kpCurrent?.estimatedKp ?? null;

  const parts: string[] = [];
  if (liveSpeed !== null) parts.push(`solar wind ${Math.round(liveSpeed)} km/s`);
  if (nearestForecastEntry) parts.push(`Kp ${nearestForecastEntry.kp}`);
  const headline = parts.length > 0 ? parts.join(', ') : 'space weather unavailable';

  return {
    headline,
    live: {
      speedKmS: liveSpeed,
      kp: liveKp,
      fetchedAt: solarWindFast.fetchedAt,
      healthy: solarWindFast.healthy,
    },
    forecast: {
      kp: nearestForecastEntry?.kp ?? null,
      status: nearestForecastEntry?.status ?? null,
      fetchedAt: spaceWeatherForecast.fetchedAt,
      healthy: spaceWeatherForecast.healthy,
    },
  };
}

function buildAuroraCard(
  nearestForecastEntry: SwpcKpForecastEntry,
  solarWindFastData: SwpcFastData | null,
  spaceWeatherForecastData: SwpcSlowData | null,
  donkiData: NasaDonkiData | null,
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
): AuroraCardData {
  const kpPredicted = nearestForecastEntry.kp;

  const visibility = auroraVisibility(observerLatDeg, observerLonDeg, kpPredicted);
  const geomagLatDeg = geomagneticLatitudeDeg(observerLatDeg, observerLonDeg);
  const ovalBoundaryDeg = auroralOvalBoundaryDeg(kpPredicted);
  const strengthFactor = auroraStrengthToFactor(visibility.strength);

  const ambientWindKmS = selectAmbientWindKmS(
    solarWindFastData?.rtswPlasma ?? null,
    spaceWeatherForecastData?.solarWind ?? null,
  );
  const activeCme = selectActiveCme(donkiData?.cmes ?? [], ambientWindKmS, now);

  const base = {
    kpPredicted,
    kpForecastStatus: nearestForecastEntry.status,
    kpForecastTimeTag: nearestForecastEntry.timeTag,
    visible: visibility.visible,
    strengthDeg: visibility.strength,
    strengthFactor,
    geomagneticLatitudeDeg: geomagLatDeg,
    auroraOvalBoundaryDeg: ovalBoundaryDeg,
  };

  if (!activeCme) {
    return {
      ...base,
      hasActiveCme: false,
      cmeArrivalTime: null,
      confidence: null,
      confidenceBand: null,
      factors: null,
    };
  }

  // History factor: Phase 6's accuracy loop doesn't exist yet, so hits/trials
  // stay at the neutral Beta prior (FORMULAS.md §9) -> f_hist = 0.5 always,
  // not an invented number. Logged in DECISIONS.md.
  const confidencePrediction = predictAuroraConfidence(
    activeCme.event,
    { kpPredicted, history: { hits: 0, trials: 0 } },
    now,
  );

  return {
    ...base,
    hasActiveCme: true,
    cmeArrivalTime: activeCme.arrivalTime.toISOString(),
    confidence: confidencePrediction.confidence,
    confidenceBand: confidencePrediction.confidenceBand,
    factors: confidencePrediction.factors,
  };
}

export function buildSpaceWeatherCard(
  solarWindFast: SourceState<SwpcFastData>,
  spaceWeatherForecast: SourceState<SwpcSlowData>,
  donki: SourceState<NasaDonkiData>,
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
): SpaceWeatherCard {
  const forecastEntries = spaceWeatherForecast.data?.kpForecast ?? null;
  const nearestForecastEntry = forecastEntries
    ? selectNearestForecastEntry(forecastEntries, now)
    : null;

  const solarLine = buildSolarLine(solarWindFast, spaceWeatherForecast, nearestForecastEntry);
  const aurora = nearestForecastEntry
    ? buildAuroraCard(
        nearestForecastEntry,
        solarWindFast.data,
        spaceWeatherForecast.data,
        donki.data,
        observerLatDeg,
        observerLonDeg,
        now,
      )
    : null;

  return { solarLine, aurora };
}
