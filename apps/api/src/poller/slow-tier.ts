/**
 * Slow-tier poller loop (ARCHITECTURE.md §4): NASA DONKI (CME/flares), NASA
 * NeoWs (near-Earth objects), JPL Horizons (Sun ephemeris), the slow-tier
 * half of SWPC (observed Kp history, 3-day forecast, propagated solar
 * wind), and CelesTrak (satellite population's TLE elements, across several
 * categories — see `fetchAllSatelliteGroups`), refreshed every 5-15min and
 * written into the store. GIBS has no fetch step (pure URL construction,
 * per `clients/gibs`) — this loop just rotates its layer config into the
 * store on the same cadence.
 *
 * `runSlowTierTick` is the testable unit: it makes the six Phase-1 network
 * client calls once each tick, except JPL Horizons — that one runs six times
 * (the Sun via `fetchHorizons`, plus Jupiter/Venus/Mars/Saturn/Mercury via
 * `fetchHorizonsRaDec`, one call per body, same pattern each time) — and
 * CelesTrak, which runs eleven times (`fetchAllSatelliteGroups`: seven
 * category groups, three debris-cloud groups merged under one 'debris'
 * category, and Hubble by catnr) — decides success/failure per-source, and
 * writes to the store. It takes `now` and the client functions as parameters
 * rather than reading the clock or importing the clients directly, so it
 * can be exercised without a live timer or network — mirrors `fast-tier.ts`.
 * `startSlowTierLoop` is the thin `setInterval` wrapper around it — all
 * eleven CelesTrak calls ride the same single 5-15min cadence as everything
 * else in this tick, not a faster schedule of their own, per CelesTrak's
 * documented polite-use guidance.
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
import type { CelestrakTleData, CelestrakTleRecord } from '../clients/celestrak/index.js';
import type { fetchSpaceTrackTle } from '../clients/space-track/index.js';
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
 * The satellite population's real category taxonomy (2026-09-06 widening —
 * see DECISIONS.md): each CelesTrak group/catnr fetched below is tagged with
 * exactly one of these, threaded through `CelestrakTleRecord.category` all
 * the way to the frontend so the population can be filtered/grouped later.
 */
type SatelliteCategory =
  'stations' | 'starlink' | 'oneweb' | 'gps' | 'weather' | 'geo' | 'cubesat' | 'debris' | 'hubble';

/**
 * CelesTrak groups fetched every slow-tier tick, each tagged with the
 * category above. Every name here was verified live against
 * celestrak.org/NORAD/elements/index.php's real current GROUP list (and a
 * live gp.php fetch returning real, non-empty data) before use — not
 * assumed from documentation or memory. See DECISIONS.md.
 */
const SATELLITE_GROUP_FETCHES: readonly { group: string; category: SatelliteCategory }[] = [
  { group: 'stations', category: 'stations' }, // ISS + Tiangong + a handful of others (~20 objects)
  { group: 'starlink', category: 'starlink' }, // ~10,700 objects live
  { group: 'oneweb', category: 'oneweb' }, // ~650 objects live
  { group: 'gps-ops', category: 'gps' }, // GPS constellation, ~30 objects
  { group: 'weather', category: 'weather' }, // ~70 objects live
  { group: 'geo', category: 'geo' }, // geostationary comms, ~570 objects live
  { group: 'cubesat', category: 'cubesat' }, // ~85 objects live
];

/**
 * "Rocket bodies / space debris" has no single generic current CelesTrak
 * group — verified live against celestrak.org/NORAD/elements/index.php's
 * full real GROUP list, which has no plain "debris" or "rocket-bodies"
 * entry. These three are real, currently valid, named debris-cloud groups
 * from specific documented events (China's 2007 Fengyun-1C ASAT test; the
 * 2009 Cosmos-2251/Iridium-33 collision) — each verified live to return
 * substantial real data (584/1963/111 objects respectively) — merged under
 * one 'debris' category rather than guessing an invented catch-all group
 * name that might silently return nothing. See DECISIONS.md.
 */
const DEBRIS_GROUP_NAMES: readonly string[] = [
  'cosmos-2251-debris',
  'fengyun-1c-debris',
  'iridium-33-debris',
];

/**
 * Hubble Space Telescope — a single well-known object, fetched by NORAD
 * catalog number like every other single-body fetch in this codebase
 * (mirrors JPL Horizons' `catnr`-style per-body fetches), not via a group.
 */
const HUBBLE_CATNR = 20580;

/**
 * Per-source cap: guards against any one CelesTrak group — Starlink alone
 * has 10,000+ real objects live — from dominating or ballooning the exposed
 * population. Applied to each group/catnr fetch independently before
 * merging (not to the combined total), so every category actually gets real
 * representation regardless of how large its own raw catalog is. Same
 * numeric value as the original single-group design's defensive bound
 * (matches the frontend's own `?simSats` ceiling,
 * `apps/web/src/lib/dev-sim-satellites.ts`), now applied per source instead
 * of once overall.
 */
const MAX_SATELLITES_PER_SOURCE = 200;

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
  /**
   * Space-Track TLE fallback — called per category only when CelesTrak
   * failed for that category. Never called when CelesTrak succeeds.
   * Optional so existing tests that don't exercise fallback don't need to
   * supply it; defaults to a no-op returning null records.
   */
  fetchSpaceTrackTle?: typeof fetchSpaceTrackTle;
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
 * unhealthy. Per-source capping already happened in `fetchAllSatelliteGroups`
 * before this is called, so `data.records` here is already the final,
 * merged, category-tagged population — nothing further to bound.
 */
function writeSatellitesResult(data: CelestrakTleData, nowIso: string): void {
  if (data.records !== null) {
    setSourceState('satellites', data, nowIso, true);
    return;
  }

  const previous = getSourceState('satellites');
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState('satellites', previous.data, previous.fetchedAt, false);
  } else {
    setSourceState('satellites', data, nowIso, false);
  }
}

/**
 * Fetches every satellite group/catnr this app tracks in parallel, trying
 * CelesTrak first for each category. If CelesTrak succeeds for a category
 * (records non-null), that result is used and Space-Track is never called for
 * it. If CelesTrak fails for a category, the equivalent Space-Track query is
 * tried as a fallback — same category-tagged records, same per-source cap,
 * same merge step.
 *
 * "Fallback-only" is strictly enforced: Space-Track is never called when
 * CelesTrak succeeds, respecting Space-Track's stricter rate limits. If both
 * sources fail for a category, that category contributes nothing to the
 * merge — the same one-source-down-doesn't-block-others contract every other
 * card in this codebase already follows. Only degrades to a total failure
 * (`records: null`) if every single category failed on both sources.
 */
async function fetchAllSatelliteGroups(
  clients: Pick<SlowTierClients, 'fetchCelestrakTle' | 'fetchSpaceTrackTle'>,
  now: Date,
): Promise<CelestrakTleData> {
  const sources: { category: SatelliteCategory; celestrakPromise: Promise<CelestrakTleData> }[] = [
    ...SATELLITE_GROUP_FETCHES.map(({ group, category }) => ({
      category,
      celestrakPromise: clients.fetchCelestrakTle({ group }, now),
    })),
    ...DEBRIS_GROUP_NAMES.map((group) => ({
      category: 'debris' as const,
      celestrakPromise: clients.fetchCelestrakTle({ group }, now),
    })),
    {
      category: 'hubble' as const,
      celestrakPromise: clients.fetchCelestrakTle({ catnr: HUBBLE_CATNR }, now),
    },
  ];

  const celestrakSettled = await Promise.allSettled(sources.map((s) => s.celestrakPromise));

  // For each category where CelesTrak failed, collect a Space-Track fallback promise.
  const fallbackWork: {
    index: number;
    category: SatelliteCategory;
    promise: Promise<CelestrakTleData>;
  }[] = [];

  celestrakSettled.forEach((result, i) => {
    const { category } = sources[i]!;
    const celestrakFailed = result.status === 'rejected' || result.value.records === null;

    if (celestrakFailed && clients.fetchSpaceTrackTle) {
      console.warn(
        `[poller/slow-tier] CelesTrak (${category}) failed — trying Space-Track fallback.`,
      );
      fallbackWork.push({
        index: i,
        category,
        promise: clients.fetchSpaceTrackTle(category, now, MAX_SATELLITES_PER_SOURCE),
      });
    }
  });

  // Run fallback queries (if any) in parallel, then merge all results.
  const fallbackSettled = await Promise.allSettled(fallbackWork.map((f) => f.promise));
  const fallbackByIndex = new Map<number, CelestrakTleData>();
  fallbackSettled.forEach((result, fi) => {
    const work = fallbackWork[fi]!;
    if (result.status === 'fulfilled') {
      fallbackByIndex.set(work.index, result.value);
    } else {
      console.error(
        `[poller/slow-tier] Space-Track fallback (${work.category}) threw unexpectedly:`,
        result.reason,
      );
    }
  });

  const seenNoradIds = new Set<number>();
  const merged: CelestrakTleRecord[] = [];
  let anySucceeded = false;

  celestrakSettled.forEach((celestrakResult, i) => {
    const { category } = sources[i]!;

    // Prefer CelesTrak; if it failed, use the Space-Track fallback if available.
    const celestrakRecords =
      celestrakResult.status === 'fulfilled' ? celestrakResult.value.records : null;

    if (celestrakResult.status === 'rejected') {
      console.error(
        `[poller/slow-tier] CelesTrak (${category}) threw unexpectedly:`,
        celestrakResult.reason,
      );
    }

    const effectiveRecords = celestrakRecords ?? fallbackByIndex.get(i)?.records ?? null;

    if (effectiveRecords !== null) {
      anySucceeded = true;
      for (const record of effectiveRecords.slice(0, MAX_SATELLITES_PER_SOURCE)) {
        if (!seenNoradIds.has(record.noradCatId)) {
          seenNoradIds.add(record.noradCatId);
          merged.push({ ...record, category });
        }
      }
    }
  });

  return {
    records: anySucceeded ? merged : null,
    fetchedAt: now.toISOString(),
  };
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
    fetchAllSatelliteGroups(clients, now),
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
