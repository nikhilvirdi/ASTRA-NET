/**
 * In-memory poller state store (ARCHITECTURE.md §4).
 *
 * Holds the latest normalized result from each Phase-1 client, keyed by source.
 * Rebuilt by re-fetching on boot, never persisted — a restart self-heals.
 *
 * This file is intentionally pure state management: plain get/set functions
 * over a module-level object. No timers, no fetch calls, no clock reads, no I/O.
 * The fast/slow-tier polling loops (later pieces) own the clock and the network
 * calls; they pass `fetchedAt` and `healthy` in explicitly rather than this file
 * inferring either.
 */

import type { N2yoPositionsData } from '../clients/n2yo/index.js';
import type { SwpcFastData, SwpcSlowData } from '../clients/swpc/index.js';
import type { NasaDonkiData, NasaNeowsData } from '../clients/nasa/index.js';
import type { HorizonsData } from '../clients/jpl-horizons/index.js';
import type { GibsLayerOptions } from '../clients/gibs/index.js';

/** Per-source state: the latest data, when it was fetched, and whether that fetch succeeded. */
export interface SourceState<T> {
  data: T | null;
  /** ISO-8601 timestamp of the last successful fetch, or null if never populated. */
  fetchedAt: string | null;
  healthy: boolean;
}

export interface PollerState {
  iss: SourceState<N2yoPositionsData>;
  /** Fast-tier SWPC: 1-min Kp + RTSW plasma (ARCHITECTURE.md §4). */
  solarWind: SourceState<SwpcFastData>;
  /** Slow-tier SWPC: observed Kp history, 3-day forecast, propagated solar wind (ARCHITECTURE.md §4). */
  spaceWeatherForecast: SourceState<SwpcSlowData>;
  donki: SourceState<NasaDonkiData>;
  neows: SourceState<NasaNeowsData>;
  /** GIBS has no fetch step (pure URL construction) — data holds the last-selected layer config. */
  gibs: SourceState<GibsLayerOptions>;
  horizons: SourceState<HorizonsData>;
}

export type SourceKey = keyof PollerState;

function createInitialState(): PollerState {
  const empty = <T>(): SourceState<T> => ({ data: null, fetchedAt: null, healthy: false });
  return {
    iss: empty(),
    solarWind: empty(),
    spaceWeatherForecast: empty(),
    donki: empty(),
    neows: empty(),
    gibs: empty(),
    horizons: empty(),
  };
}

let state: PollerState = createInitialState();

/** Returns the current state for a single source. */
export function getSourceState<K extends SourceKey>(key: K): PollerState[K] {
  return state[key];
}

/** Returns a shallow copy of the full store, e.g. for composing a REST/SSE payload. */
export function getAllSourceStates(): PollerState {
  return { ...state };
}

/** Writes a source's latest fetch result. Caller supplies `fetchedAt` and `healthy`. */
export function setSourceState<K extends SourceKey>(
  key: K,
  data: PollerState[K]['data'],
  fetchedAt: string,
  healthy: boolean,
): void {
  state = { ...state, [key]: { data, fetchedAt, healthy } };
}

/** Resets the store to its initial (all-empty) shape. Primarily for test isolation. */
export function resetStore(): void {
  state = createInitialState();
}
