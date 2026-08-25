/**
 * TTL cache in front of N2YO's `visualpasses` endpoint (WORKPLAN.md Phase
 * 12's rate-limit budget, SCHEMA.md's Cache model).
 *
 * **Why this endpoint specifically.** Every other upstream is polled
 * centrally, so its load is constant no matter how many people are looking.
 * `visualpasses` cannot be: it takes the observer's coordinates, so there is
 * nothing to poll *for*. It was therefore called live on every
 * `GET /api/brief`, and N2YO limits it to **100 transactions/hour** — a tenth of the 1000/hr the other endpoints get,
 * because N2YO's limits are per endpoint ("transaction limited by type").
 * That capped the whole product at ~100 Brief page-loads an hour.
 *
 * **Why the key is the exact observer position, not a rounded one.**
 * Rounding to a grid would raise the hit rate for scattered coordinates, but
 * it would also serve passes computed for a point the observer is not
 * standing at while presenting them as theirs — the same class of thing this
 * codebase has repeatedly refused to do. It also is not needed: the client
 * sends either a saved location (stable across reloads and across `/` and
 * `/explore`) or `DEFAULT_OBSERVER_LOCATION`, which every logged-out visitor
 * shares. So real traffic already collapses onto a handful of keys, and the
 * anonymous majority collapses onto exactly one.
 *
 * Coordinates are formatted to a fixed 4 decimal places purely so that
 * `51.5` and `51.5000` cannot produce two rows for one position. That is
 * ~11 m — normalisation of the *representation*, not approximation of the
 * position.
 *
 * **Failures are cached too, at the same TTL.** Tempting to cache only
 * successes, but an N2YO outage is exactly when the budget is most at risk:
 * `fetchWithRetry` makes three attempts on 5xx and network errors, so an
 * uncached failure path costs 3 upstream calls per page view and would
 * exhaust 100/hr in ~33 views. Caching the failure bounds a total outage to
 * 3 calls per TTL per key. The cost is that the ISS card stays unavailable
 * for up to one TTL after N2YO recovers, which is in line with the poller's
 * own 45s–10min cadences and is honest either way.
 */

import type { PrismaClient } from '@prisma/client';
import { getCached, setCached } from '../cache/store.js';
import type {
  fetchN2yoVisualPasses as defaultFetchN2yoVisualPasses,
  N2yoVisualPassesData,
} from '../clients/n2yo/index.js';

/**
 * Five minutes. No locked doc pins a TTL, so this is chosen against the two
 * things that actually constrain it:
 *
 * - **Upstream budget.** One key costs at most `3600/300 = 12` calls/hour,
 *   or 36 during a sustained outage once retries are counted — comfortably
 *   inside the 100/hr this endpoint gets, with room for several distinct
 *   observers.
 * - **Staleness.** Pass predictions derive from TLEs that CelesTrak and
 *   N2YO refresh once or twice a day, so five minutes of age is far below
 *   the resolution of the underlying data. The "next" pass is not itself
 *   cached — `iss-card.ts`'s `selectNextPass` re-filters the cached list
 *   against the request's own clock, so a cached payload cannot leave a
 *   pass that has already started sitting at the top of the Brief.
 *
 * Raising this is the lever if the observer count ever outgrows the budget;
 * see DECISIONS.md.
 */
export const VISUAL_PASSES_CACHE_TTL_MS = 5 * 60 * 1000;

export interface VisualPassesCacheParams {
  satId: number;
  observerLat: number;
  observerLng: number;
  observerAlt: number;
  days: number;
  minVisibility: number;
}

/**
 * SCHEMA.md's "source + query signature" convention. Every parameter that
 * changes the upstream response is in the key, so a future change to the
 * lookahead window or visibility floor cannot silently read another
 * request's rows. `v1` leaves room to invalidate the whole namespace by
 * bumping it rather than by writing a migration.
 */
export function visualPassesCacheKey(params: VisualPassesCacheParams): string {
  const lat = params.observerLat.toFixed(4);
  const lon = params.observerLng.toFixed(4);
  return [
    'n2yo:visualpasses:v1',
    params.satId,
    lat,
    lon,
    params.observerAlt,
    params.days,
    params.minVisibility,
  ].join(':');
}

export interface VisualPassesCacheDeps {
  prisma: PrismaClient;
  n2yoApiKey: string;
  fetchN2yoVisualPasses: typeof defaultFetchN2yoVisualPasses;
}

/**
 * Returns the cached payload when one is live, otherwise fetches and stores
 * it.
 *
 * The cache is never allowed to break the Brief: a read or write that
 * throws (Postgres down, say) is logged and stepped over, leaving the live
 * fetch as the answer. A cache is an optimisation, and an optimisation that
 * can take down the page it optimises is a liability.
 */
export async function fetchVisualPassesCached(
  deps: VisualPassesCacheDeps,
  params: VisualPassesCacheParams,
  now: Date,
): Promise<N2yoVisualPassesData> {
  const key = visualPassesCacheKey(params);

  try {
    const hit = await getCached<N2yoVisualPassesData>(deps.prisma, key, now);
    if (hit !== null) return hit;
  } catch (error) {
    console.error(
      `[brief] visual-passes cache read failed, falling through to N2YO: ${
        error instanceof Error ? error.name : 'unknown error'
      }`,
    );
  }

  const fresh = await deps.fetchN2yoVisualPasses(params, deps.n2yoApiKey, now);

  try {
    await setCached(deps.prisma, key, fresh, new Date(now.getTime() + VISUAL_PASSES_CACHE_TTL_MS));
  } catch (error) {
    console.error(
      `[brief] visual-passes cache write failed, serving live result: ${
        error instanceof Error ? error.name : 'unknown error'
      }`,
    );
  }

  return fresh;
}
