/**
 * Fast-tier poller loop (ARCHITECTURE.md §4): ISS position (N2YO) and
 * solar wind/Kp (SWPC), refreshed every 30-60s and written into the store.
 *
 * `runFastTierTick` is the testable unit: it calls the two Phase-1 clients
 * once, decides success/failure per-source, and writes to the store. It
 * takes `now` and the client functions as parameters rather than reading
 * the clock or importing the clients directly, so it can be exercised
 * without a live timer or network. `startFastTierLoop` is the thin
 * setInterval wrapper around it — no Express, no server, still importable
 * and testable in isolation.
 *
 * Failure handling follows API_SOURCES.md's per-source fallback, not a
 * single generic rule:
 * - N2YO: "if down, ISS card shows 'position unavailable'" — no
 *   stale-value guidance, so a failed fetch's own (positions: null) result
 *   is written, marked unhealthy.
 * - SWPC: "use last cached value with an aged freshness stamp; if never
 *   fetched this session, shows 'unavailable'" — so a total failure keeps
 *   the previous store value (if any) rather than wiping it, still marked
 *   unhealthy so it's never mislabeled as fresh/healthy.
 */

import type { fetchN2yoPositions } from '../clients/n2yo/index.js';
import type { N2yoPositionsData } from '../clients/n2yo/index.js';
import type { fetchSwpc } from '../clients/swpc/index.js';
import type { SwpcData } from '../clients/swpc/index.js';
import { getSourceState, setSourceState } from './store.js';

/** ARCHITECTURE.md §4: fast tier polls every 30-60s. */
export const FAST_TIER_INTERVAL_MS = 45_000;

/** ISS's real-world NORAD catalog number. */
export const ISS_NORAD_ID = 25544;

/**
 * N2YO's positions endpoint requires an observer point to compute
 * azimuth/elevation, but the store only cares about the ISS's own
 * lat/long/altitude (observer-independent). Null Island is a neutral
 * placeholder — it doesn't bias the returned satellite position, only the
 * azimuth/elevation/eclipsed fields this phase doesn't consume. A single
 * sample (seconds: 1) is enough since the store only needs "current"
 * position, not a trajectory.
 */
const ISS_POSITION_PARAMS = {
  satId: ISS_NORAD_ID,
  observerLat: 0,
  observerLng: 0,
  observerAlt: 0,
  seconds: 1,
};

export interface FastTierClients {
  fetchN2yoPositions: typeof fetchN2yoPositions;
  fetchSwpc: typeof fetchSwpc;
  n2yoApiKey: string;
}

function isSwpcTotalFailure(data: SwpcData): boolean {
  return (
    data.kpCurrent === null &&
    data.kpObserved === null &&
    data.kpForecast === null &&
    data.solarWind === null &&
    data.rtswPlasma === null
  );
}

/**
 * Writes the ISS fetch result to the store. A failed fetch (positions
 * null) is written as-is and marked unhealthy — matches N2YO's documented
 * "position unavailable" fallback, no stale-value preservation.
 */
function writeIssResult(data: N2yoPositionsData, nowIso: string): void {
  setSourceState('iss', data, nowIso, data.positions !== null);
}

/**
 * Writes the SWPC fetch result to the store. A total failure (every
 * product null) keeps the previous store value when one exists — matches
 * SWPC's documented "use last cached value with an aged freshness stamp"
 * fallback — but is always marked unhealthy so stale data is never
 * mislabeled as fresh.
 */
function writeSolarWindResult(data: SwpcData, nowIso: string): void {
  if (!isSwpcTotalFailure(data)) {
    setSourceState('solarWind', data, nowIso, true);
    return;
  }

  const previous = getSourceState('solarWind');
  if (previous.data !== null && previous.fetchedAt !== null) {
    setSourceState('solarWind', previous.data, previous.fetchedAt, false);
  } else {
    setSourceState('solarWind', data, nowIso, false);
  }
}

/**
 * Runs one fast-tier poll: fetches ISS position and SWPC solar wind/Kp in
 * parallel, then writes each result independently so one source failing
 * never affects the other (degradation contract, ARCHITECTURE.md §5).
 *
 * Both clients are documented to never throw (they catch internally and
 * return a null-data result), but `Promise.allSettled` guards against
 * anything genuinely unexpected without letting one source's failure take
 * down the other's write.
 */
export async function runFastTierTick(clients: FastTierClients, now: Date): Promise<void> {
  const nowIso = now.toISOString();

  const [issResult, swpcResult] = await Promise.allSettled([
    clients.fetchN2yoPositions(ISS_POSITION_PARAMS, clients.n2yoApiKey, now),
    clients.fetchSwpc(now),
  ]);

  if (issResult.status === 'fulfilled') {
    writeIssResult(issResult.value, nowIso);
  } else {
    console.error('[poller/fast-tier] N2YO threw unexpectedly:', issResult.reason);
    writeIssResult(
      { satId: ISS_NORAD_ID, satName: 'Unknown', positions: null, fetchedAt: nowIso },
      nowIso,
    );
  }

  if (swpcResult.status === 'fulfilled') {
    writeSolarWindResult(swpcResult.value, nowIso);
  } else {
    console.error('[poller/fast-tier] SWPC threw unexpectedly:', swpcResult.reason);
    writeSolarWindResult(
      {
        kpCurrent: null,
        kpObserved: null,
        kpForecast: null,
        solarWind: null,
        rtswPlasma: null,
        fetchedAt: nowIso,
      },
      nowIso,
    );
  }
}

/**
 * Starts the fast-tier loop: an immediate tick (so the store isn't empty
 * until the first interval elapses), then one every `FAST_TIER_INTERVAL_MS`.
 * Returns a stop function that clears the interval.
 */
export function startFastTierLoop(clients: FastTierClients): () => void {
  const tick = (): void => {
    void runFastTierTick(clients, new Date()).catch((err: unknown) => {
      console.error('[poller/fast-tier] tick failed unexpectedly:', err);
    });
  };

  tick();
  const timer = setInterval(tick, FAST_TIER_INTERVAL_MS);

  return () => clearInterval(timer);
}
