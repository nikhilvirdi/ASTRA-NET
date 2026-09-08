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
import type { HorizonsData, HorizonsRaDecData } from '../clients/jpl-horizons/index.js';
import type { GibsLayerOptions } from '../clients/gibs/index.js';
import type { CelestrakTleData, CelestrakTleRecord } from '../clients/celestrak/index.js';

/**
 * The satellite category taxonomy, derived from `CelestrakTleRecord.category`
 * (the single source of truth for the union) rather than redeclared — see
 * DECISIONS.md "Per-category satellite source tracking exposed on /health".
 */
export type SatelliteCategory = NonNullable<CelestrakTleRecord['category']>;

/** Which network source actually served a satellite category's last successful fetch. */
export type SatelliteSource = 'celestrak' | 'space-track-fallback';

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
  /**
   * Per-body geocentric RA/Dec ephemerides — same JPL Horizons source as
   * `horizons` (the Sun), different target body each, same pattern for all
   * five (see DECISIONS.md).
   */
  horizonsJupiter: SourceState<HorizonsRaDecData>;
  horizonsVenus: SourceState<HorizonsRaDecData>;
  horizonsMars: SourceState<HorizonsRaDecData>;
  horizonsSaturn: SourceState<HorizonsRaDecData>;
  horizonsMercury: SourceState<HorizonsRaDecData>;
  /**
   * Curated satellite population's raw TLE element sets (CelesTrak, GROUP
   * "visual" — see DECISIONS.md). Observer-independent orbital elements
   * only; alt/az propagation stays client-side (ARCHITECTURE.md §2).
   */
  satellites: SourceState<CelestrakTleData>;
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
    horizonsJupiter: empty(),
    horizonsVenus: empty(),
    horizonsMars: empty(),
    horizonsSaturn: empty(),
    horizonsMercury: empty(),
    satellites: empty(),
  };
}

let state: PollerState = createInitialState();

/**
 * Per-category satellite source tracking: which network source (CelesTrak or
 * the Space-Track fallback) actually served each category's *last successful*
 * fetch. Deliberately separate from `PollerState.satellites` (whose `data` is
 * the merged, category-tagged TLE population) — this map has different
 * persistence semantics: a category here is only ever overwritten when it
 * succeeds again, on either source, and stays at its last-known source
 * (or `null` if it has never once succeeded) through ticks where it fails on
 * both sources, mirroring `satellites`' own "keep last known-good on failure"
 * rule but tracked per-category instead of for the merged whole.
 */
function createInitialSatelliteCategorySources(): Record<
  SatelliteCategory,
  SatelliteSource | null
> {
  return {
    stations: null,
    starlink: null,
    oneweb: null,
    gps: null,
    weather: null,
    geo: null,
    cubesat: null,
    debris: null,
    hubble: null,
  };
}

let satelliteCategorySources: Record<SatelliteCategory, SatelliteSource | null> =
  createInitialSatelliteCategorySources();

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

/** Returns a shallow copy of the per-category satellite source map. */
export function getSatelliteCategorySources(): Record<SatelliteCategory, SatelliteSource | null> {
  return { ...satelliteCategorySources };
}

/**
 * Merges per-category source updates in — only categories present in
 * `updates` are overwritten; every other category keeps its last-known
 * source. Callers pass only the categories that succeeded on this tick (see
 * `fetchAllSatelliteGroups` in `slow-tier.ts`).
 */
export function setSatelliteCategorySources(
  updates: Partial<Record<SatelliteCategory, SatelliteSource>>,
): void {
  satelliteCategorySources = { ...satelliteCategorySources, ...updates };
}

/** Resets the store to its initial (all-empty) shape. Primarily for test isolation. */
export function resetStore(): void {
  state = createInitialState();
  satelliteCategorySources = createInitialSatelliteCategorySources();
}
