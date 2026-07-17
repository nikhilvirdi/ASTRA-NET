/**
 * Slow-tier poller loop (ARCHITECTURE.md §4): NASA DONKI (CME/flares), NASA
 * NeoWs (near-Earth objects), JPL Horizons (Sun ephemeris), and the
 * slow-tier half of SWPC (observed Kp history, 3-day forecast, propagated
 * solar wind), refreshed every 5-15min and written into the store. GIBS has
 * no fetch step (pure URL construction, per `clients/gibs`) — this loop
 * just rotates its layer config into the store on the same cadence.
 *
 * `runSlowTierTick` is the testable unit: it calls the four Phase-1
 * network clients once, decides success/failure per-source, and writes to
 * the store. It takes `now` and the client functions as parameters rather
 * than reading the clock or importing the clients directly, so it can be
 * exercised without a live timer or network — mirrors `fast-tier.ts`.
 * `startSlowTierLoop` is the thin `setInterval` wrapper around it.
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
 *
 * This loop only ever calls `fetchSwpcSlow` — the fast-tier SWPC products
 * (1-min Kp, RTSW plasma) are `fast-tier.ts`'s `fetchSwpcFast`, on its own
 * 30-60s cadence. Never call `fetchSwpcFast` from here — that would
 * promote a fast-tier source into the slow tier and stall its freshness.
 */

import type { fetchNasaDonki, fetchNasaNeows } from '../clients/nasa/index.js';
import type { NasaDonkiData, NasaNeowsData } from '../clients/nasa/index.js';
import type { fetchHorizons } from '../clients/jpl-horizons/index.js';
import type { HorizonsData } from '../clients/jpl-horizons/index.js';
import type { fetchSwpcSlow } from '../clients/swpc/index.js';
import type { SwpcSlowData } from '../clients/swpc/index.js';
import type { GibsLayerOptions } from '../clients/gibs/index.js';
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
 * GIBS imagery layer rotated into the store each tick. Yesterday's date,
 * not today's — GIBS's daily mosaics for this layer are typically not
 * fully composited until the following day, so requesting "today" risks a
 * blank/partial tile long after the tick fires.
 */
const GIBS_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SlowTierClients {
  fetchNasaDonki: typeof fetchNasaDonki;
  fetchNasaNeows: typeof fetchNasaNeows;
  fetchHorizons: typeof fetchHorizons;
  fetchSwpcSlow: typeof fetchSwpcSlow;
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

/** GIBS has no fetch step and cannot fail, so it's always written fresh and healthy. */
function writeGibsResult(options: GibsLayerOptions, nowIso: string): void {
  setSourceState('gibs', options, nowIso, true);
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
 * Runs one slow-tier poll: fetches DONKI, NeoWs, JPL Horizons, and the
 * slow-tier half of SWPC in parallel, then writes each result independently
 * so one source failing never affects the others (degradation contract,
 * ARCHITECTURE.md §5). GIBS's layer config is rotated in directly since it
 * has no network call.
 *
 * All four network clients are documented to never throw (they catch
 * internally and return a null-data result), but `Promise.allSettled`
 * guards against anything genuinely unexpected without letting one
 * source's failure take down another's write.
 */
export async function runSlowTierTick(clients: SlowTierClients, now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const today = formatDate(now);
  const tomorrow = formatDate(new Date(now.getTime() + MS_PER_DAY));

  const [donkiResult, neowsResult, horizonsResult, swpcSlowResult] = await Promise.allSettled([
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
    clients.fetchSwpcSlow(now),
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
