/**
 * Slow-tier poller loop (ARCHITECTURE.md §4): NASA DONKI (CME/flares), NASA
 * NeoWs (near-Earth objects), JPL Horizons (Sun ephemeris), the slow-tier
 * half of SWPC (observed Kp history, 3-day forecast, propagated solar
 * wind), and CelesTrak (curated satellite population's TLE elements),
 * refreshed every 5-15min and written into the store. GIBS has no fetch
 * step (pure URL construction, per `clients/gibs`) — this loop just
 * rotates its layer config into the store on the same cadence.
 *
 * `runSlowTierTick` is the testable unit: it makes the six Phase-1 network
 * client calls once each tick, except JPL Horizons — that one runs six times
 * (the Sun via `fetchHorizons`, plus Jupiter/Venus/Mars/Saturn/Mercury via
 * `fetchHorizonsRaDec`, one call per body, same pattern each time) — decides
 * success/failure per-source, and writes to the store. It takes `now` and
 * the client functions as parameters rather than reading the clock or
 * importing the clients directly, so it can be exercised without a live
 * timer or network — mirrors `fast-tier.ts`. `startSlowTierLoop` is the thin
 * `setInterval` wrapper around it.
 *
 * Failure handling follows API_SOURCES.md's per-source fallback, not a
 * single generic rule:
 * - DONKI: "no new CME predictions are generated; existing in-flight
 *   predictions continue" — a total failure (both CME and FLR null) keeps
 *   the previous store value when one exists, still marked unhealthy.
 * - NeoWs: "NEO card shows 'unavailable'" — no stale-value guidance, so a
 *   failed fetch's own (objects: null) result is written as-is, unhealthy.
 * - JPL Horizons: "effectively never user-visible-down... serve last
 *   computed set" — a failure keeps the previous store value when one
 *   exists, still marked unhealthy.
 * - SWPC (slow half): "fall back to latest real-time Kp as a proxy... if
 *   solar wind missing, shows unavailable" — mirrors the fast-tier SWPC
 *   pattern: a total failure (all three fields null) keeps the previous
 *   store value when one exists, still marked unhealthy; a partial result
 *   is written fresh and healthy, since the source did respond.
 * - GIBS: pure URL construction, cannot fail — always written fresh and
 *   healthy.
 * - CelesTrak: "use last cached TLE set (valid for hours/days); only if
 *   never fetched does satellite rendering degrade" — a failure keeps the
 *   previous store value when one exists, still marked unhealthy.
 *
 * This loop only ever calls `fetchSwpcSlow` — the fast-tier SWPC products
 * (1-min Kp, RTSW plasma) are `fast-tier.ts`'s `fetchSwpcFast`, on its own
 * 30-60s cadence. Never call `fetchSwpcFast` from here — that would
 * promote a fast-tier source into the slow tier and stall its freshness.
 */

import type { fetchNasaDonki, fetchNasaNeows } from '../clients/nasa/index.js';
import type { NasaDonkiData, NasaNeowsData } from '../clients/nasa/index.js';
import type { fetchHorizons, fetchHorizonsRaDec } from '../clients/jpl-horizons/index.js';
import type { HorizonsData, HorizonsRaDecData } from '../clients/jpl-horizons/index.js';
import type { fetchSwpcSlow } from '../clients/swpc/index.js';
import type { SwpcSlowData } from '../clients/swpc/index.js';
import type { GibsLayerOptions } from '../clients/gibs/index.js';
import type { fetchCelestrakTle } from '../clients/celestrak/index.js';
import type { CelestrakTleData } from '../clients/celestrak/index.js';
import { getSourceState, setSourceState } from './store.js';

/** ARCHITECTURE.md §4: slow tier polls every 5-15min. */
export const SLOW_TIER_INTERVAL_MS = 600_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** DONKI CME/FLR lookback window: recent activity, not the full mission history. */
const DONKI_LOOKBACK_DAYS = 7;

/** NeoWs feed's own max span is 7 days per request (API_SOURCES.md). */
const NEOWS_LOOKAHEAD_DAYS = 7;

/** JPL Horizons target body: the Sun (command '10'), geocentric — the position later phases' twilight/lighting calculations need. */
const HORIZONS_SUN_COMMAND = '10';
const HORIZONS_GEOCENTRIC = '500@399';

/**
 * JPL Horizons target bodies for the Sky Anchor's planet markers, geocentric
 * — real, standard JPL Horizons major-body IDs (verified live against the
 * API before wiring in; not invented), not just Jupiter's precedent reused
 * blindly. Same reasoning as Jupiter's original comment: hourly steps so a
 * nearest-row lookup at request time is at most 30min stale, over which any
 * of these bodies' geocentric RA/Dec drifts well under 0.01° — invisible at
 * Horizon Band scale.
 */
const HORIZONS_MERCURY_COMMAND = '199';
const HORIZONS_VENUS_COMMAND = '299';
const HORIZONS_MARS_COMMAND = '499';
const HORIZONS_JUPITER_COMMAND = '599';
const HORIZONS_SATURN_COMMAND = '699';
const HORIZONS_PLANET_STEP = '1 h';

/**
 * GIBS imagery layer rotated into the store each tick. Yesterday's date,
 * not today's — GIBS's daily mosaics for this layer are typically not
 * fully composited until the following day, so requesting "today" risks a
 * blank/partial tile long after the tick fires.
 */
const GIBS_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';

/**
 * CelesTrak's own curated "visually notable" group (~100-160 naked-eye
 * objects, incl. ISS) — a bounded, meaningful slice per API_SOURCES.md's
 * intent, not an invented selection rule. See DECISIONS.md.
 */
const SATELLITE_GROUP = 'visual';

/**
 * Defensive cap on the exposed population, matching the frontend's own
 * `?simSats` ceiling (`apps/web/src/lib/dev-sim-satellites.ts`) — guards
 * against CelesTrak's curated group ever growing past a sane count for a
 * night-sky scene, independent of whatever `SATELLITE_GROUP` returns today.
 */
const MAX_SATELLITES = 200;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SlowTierClients {
  fetchNasaDonki: typeof fetchNasaDonki;
  fetchNasaNeows: typeof fetchNasaNeows;
  fetchHorizons: typeof fetchHorizons;
  fetchHorizonsRaDec: typeof fetchHorizonsRaDec;
  fetchSwpcSlow: typeof fetchSwpcSlow;
  fetchCelestrakTle: typeof fetchCelestrakTle;
  nasaApiKey: string;
}

function isDonkiTotalFailure(data: NasaDonkiData): boolean {
  return data.cmes === null && data.flares === null;
}

/**
 * Writes the DONKI fetch result. A total failure (both CME and FLR null)
 * keeps the previous store value when one exists — matches DONKI's
 * documented "existing in-flight predictions continue" fallback — but is
 * always marked unhealthy so stale data is never mislabeled as fresh.
 */
function writeDonkiResult(data: NasaDonkiData, nowIso: string): void {
  if (!isDonkiTotalFailure(data)) {
    setSourceState('donki', data, nowIso, true);
    return;
  }

  const previous = getSourceState('donki');
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState('donki', previous.data, previous.fetchedAt, false);
  } else {
    setSourceState('donki', data, nowIso, false);
  }
}

/**
 * Writes the NeoWs fetch result. A failed fetch (objects null) is written
 * as-is and marked unhealthy — matches NeoWs's documented "unavailable"
 * fallback, no stale-value preservation.
 */
function writeNeowsResult(data: NasaNeowsData, nowIso: string): void {
  setSourceState('neows', data, nowIso, data.objects !== null);
}

/**
 * Writes the JPL Horizons fetch result. A failure keeps the previous store
 * value when one exists — matches Horizons's documented "serve last
 * computed set" fallback — but is always marked unhealthy.
 */
function writeHorizonsResult(data: HorizonsData, nowIso: string): void {
  if (data.ephemerisLines !== null) {
    setSourceState('horizons', data, nowIso, true);
    return;
  }

  const previous = getSourceState('horizons');
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState('horizons', previous.data, previous.fetchedAt, false);
  } else {
    setSourceState('horizons', data, nowIso, false);
  }
}

/** The five per-body RA/Dec ephemeris store slots, all fed by `fetchHorizonsRaDec`. */
type HorizonsRaDecKey =
  'horizonsJupiter' | 'horizonsVenus' | 'horizonsMars' | 'horizonsSaturn' | 'horizonsMercury';

/**
 * Writes a per-body RA/Dec ephemeris fetch result. Same source (JPL
 * Horizons) as `writeHorizonsResult` above, so the same documented "serve
 * last computed set" fallback applies: a failure keeps the previous store
 * value when one exists, always marked unhealthy. One shared function for
 * all five bodies (Jupiter/Venus/Mars/Saturn/Mercury) — the fallback logic
 * is identical, only the store key differs.
 */
function writeHorizonsRaDecResult(
  key: HorizonsRaDecKey,
  data: HorizonsRaDecData,
  nowIso: string,
): void {
  if (data.entries !== null) {
    setSourceState(key, data, nowIso, true);
    return;
  }

  const previous = getSourceState(key);
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState(key, previous.data, previous.fetchedAt, false);
  } else {
    setSourceState(key, data, nowIso, false);
  }
}

/** GIBS has no fetch step and cannot fail, so it's always written fresh and healthy. */
function writeGibsResult(options: GibsLayerOptions, nowIso: string): void {
  setSourceState('gibs', options, nowIso, true);
}

/**
 * Writes the CelesTrak satellite-population fetch result. A failure keeps
 * the previous store value when one exists — matches API_SOURCES.md's
 * documented "use last cached TLE set (valid for hours/days); only if never
 * fetched does satellite rendering degrade" — but is always marked
 * unhealthy. A successful fetch is capped at `MAX_SATELLITES` before
 * writing (defensive bound, not a CelesTrak behavior).
 */
function writeSatellitesResult(data: CelestrakTleData, nowIso: string): void {
  if (data.records !== null) {
    const capped: CelestrakTleData = { ...data, records: data.records.slice(0, MAX_SATELLITES) };
    setSourceState('satellites', capped, nowIso, true);
    return;
  }

  const previous = getSourceState('satellites');
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState('satellites', previous.data, previous.fetchedAt, false);
  } else {
    setSourceState('satellites', data, nowIso, false);
  }
}

function isSwpcSlowTotalFailure(data: SwpcSlowData): boolean {
  return data.kpObserved === null && data.kpForecast === null && data.solarWind === null;
}

/**
 * Writes the slow-tier SWPC fetch result. A total failure (all three fields
 * null) keeps the previous store value when one exists — mirrors the
 * fast-tier SWPC pattern — but is always marked unhealthy. A partial result
 * is written fresh and healthy, since the source did respond.
 */
function writeSpaceWeatherForecastResult(data: SwpcSlowData, nowIso: string): void {
  if (!isSwpcSlowTotalFailure(data)) {
    setSourceState('spaceWeatherForecast', data, nowIso, true);
    return;
  }

  const previous = getSourceState('spaceWeatherForecast');
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState('spaceWeatherForecast', previous.data, previous.fetchedAt, false);
  } else {
    setSourceState('spaceWeatherForecast', data, nowIso, false);
  }
}

/**
 * Writes one of the five per-body RA/Dec `Promise.allSettled` results
 * (fulfilled or rejected) — shared by Jupiter/Venus/Mars/Saturn/Mercury so
 * the fulfilled/rejected handling isn't repeated five times for what is
 * otherwise identical logic.
 */
function handleHorizonsRaDecResult(
  result: PromiseSettledResult<HorizonsRaDecData>,
  key: HorizonsRaDecKey,
  label: string,
  nowIso: string,
): void {
  if (result.status === 'fulfilled') {
    writeHorizonsRaDecResult(key, result.value, nowIso);
  } else {
    console.error(`[poller/slow-tier] JPL Horizons (${label}) threw unexpectedly:`, result.reason);
    writeHorizonsRaDecResult(key, { entries: null, fetchedAt: nowIso }, nowIso);
  }
}

/**
 * Runs one slow-tier poll: fetches DONKI, NeoWs, JPL Horizons (Sun plus
 * Jupiter/Venus/Mars/Saturn/Mercury), and the slow-tier half of SWPC in
 * parallel, then writes each result independently so one source failing
 * never affects the others (degradation contract, ARCHITECTURE.md §5).
 * GIBS's layer config is rotated in directly since it has no network call.
 *
 * All the network clients are documented to never throw (they catch
 * internally and return a null-data result), but `Promise.allSettled`
 * guards against anything genuinely unexpected without letting one
 * source's failure take down another's write.
 */
export async function runSlowTierTick(clients: SlowTierClients, now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const today = formatDate(now);
  const tomorrow = formatDate(new Date(now.getTime() + MS_PER_DAY));

  const raDecParams = (command: string) => ({
    command,
    startTime: today,
    stopTime: tomorrow,
    stepSize: HORIZONS_PLANET_STEP,
    center: HORIZONS_GEOCENTRIC,
  });

  const [
    donkiResult,
    neowsResult,
    horizonsResult,
    horizonsJupiterResult,
    horizonsVenusResult,
    horizonsMarsResult,
    horizonsSaturnResult,
    horizonsMercuryResult,
    swpcSlowResult,
    satellitesResult,
  ] = await Promise.allSettled([
    clients.fetchNasaDonki(
      {
        startDate: formatDate(new Date(now.getTime() - DONKI_LOOKBACK_DAYS * MS_PER_DAY)),
        endDate: today,
      },
      clients.nasaApiKey,
      now,
    ),
    clients.fetchNasaNeows(
      {
        startDate: today,
        endDate: formatDate(new Date(now.getTime() + NEOWS_LOOKAHEAD_DAYS * MS_PER_DAY)),
      },
      clients.nasaApiKey,
      now,
    ),
    clients.fetchHorizons(
      {
        command: HORIZONS_SUN_COMMAND,
        startTime: today,
        stopTime: tomorrow,
        stepSize: '1 d',
        center: HORIZONS_GEOCENTRIC,
        makeEphem: 'YES',
        ephemType: 'OBSERVER',
      },
      now,
    ),
    clients.fetchHorizonsRaDec(raDecParams(HORIZONS_JUPITER_COMMAND), now),
    clients.fetchHorizonsRaDec(raDecParams(HORIZONS_VENUS_COMMAND), now),
    clients.fetchHorizonsRaDec(raDecParams(HORIZONS_MARS_COMMAND), now),
    clients.fetchHorizonsRaDec(raDecParams(HORIZONS_SATURN_COMMAND), now),
    clients.fetchHorizonsRaDec(raDecParams(HORIZONS_MERCURY_COMMAND), now),
    clients.fetchSwpcSlow(now),
    clients.fetchCelestrakTle({ group: SATELLITE_GROUP }, now),
  ]);

  if (donkiResult.status === 'fulfilled') {
    writeDonkiResult(donkiResult.value, nowIso);
  } else {
    console.error('[poller/slow-tier] DONKI threw unexpectedly:', donkiResult.reason);
    writeDonkiResult({ cmes: null, flares: null, fetchedAt: nowIso }, nowIso);
  }

  if (neowsResult.status === 'fulfilled') {
    writeNeowsResult(neowsResult.value, nowIso);
  } else {
    console.error('[poller/slow-tier] NeoWs threw unexpectedly:', neowsResult.reason);
    writeNeowsResult({ elementCount: 0, objects: null, fetchedAt: nowIso }, nowIso);
  }

  if (horizonsResult.status === 'fulfilled') {
    writeHorizonsResult(horizonsResult.value, nowIso);
  } else {
    console.error('[poller/slow-tier] JPL Horizons threw unexpectedly:', horizonsResult.reason);
    writeHorizonsResult({ ephemerisLines: null, fetchedAt: nowIso }, nowIso);
  }

  handleHorizonsRaDecResult(horizonsJupiterResult, 'horizonsJupiter', 'Jupiter', nowIso);
  handleHorizonsRaDecResult(horizonsVenusResult, 'horizonsVenus', 'Venus', nowIso);
  handleHorizonsRaDecResult(horizonsMarsResult, 'horizonsMars', 'Mars', nowIso);
  handleHorizonsRaDecResult(horizonsSaturnResult, 'horizonsSaturn', 'Saturn', nowIso);
  handleHorizonsRaDecResult(horizonsMercuryResult, 'horizonsMercury', 'Mercury', nowIso);

  if (swpcSlowResult.status === 'fulfilled') {
    writeSpaceWeatherForecastResult(swpcSlowResult.value, nowIso);
  } else {
    console.error('[poller/slow-tier] SWPC (slow) threw unexpectedly:', swpcSlowResult.reason);
    writeSpaceWeatherForecastResult(
      { kpObserved: null, kpForecast: null, solarWind: null, fetchedAt: nowIso },
      nowIso,
    );
  }

  writeGibsResult(
    { layer: GIBS_LAYER, date: formatDate(new Date(now.getTime() - MS_PER_DAY)) },
    nowIso,
  );

  if (satellitesResult.status === 'fulfilled') {
    writeSatellitesResult(satellitesResult.value, nowIso);
  } else {
    console.error('[poller/slow-tier] CelesTrak threw unexpectedly:', satellitesResult.reason);
    writeSatellitesResult({ records: null, fetchedAt: nowIso }, nowIso);
  }
}

/**
 * Starts the slow-tier loop: an immediate tick (so the store isn't empty
 * until the first interval elapses), then one every `SLOW_TIER_INTERVAL_MS`.
 * Returns a stop function that clears the interval.
 */
export function startSlowTierLoop(clients: SlowTierClients): () => void {
  const tick = (): void => {
    void runSlowTierTick(clients, new Date()).catch((err: unknown) => {
      console.error('[poller/slow-tier] tick failed unexpectedly:', err);
    });
  };

  tick();
  const timer = setInterval(tick, SLOW_TIER_INTERVAL_MS);

  return () => clearInterval(timer);
}
