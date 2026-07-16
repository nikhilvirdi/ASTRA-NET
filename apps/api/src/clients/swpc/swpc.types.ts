/**
 * Typed output types for the NOAA SWPC client.
 *
 * These are the shapes the client returns to callers — clean, normalised
 * representations independent of raw wire format. The schemas in swpc.schemas.ts
 * validate and parse the raw responses into these types.
 */

/** Latest estimated Kp value from the 1-minute feed. */
export interface SwpcKpCurrent {
  /** ISO-8601 UTC timestamp of the reading. */
  timeTag: string;
  /** Integer Kp (0-9) from the 3-hour block. */
  kpIndex: number;
  /** Continuous estimated Kp (e.g. 1.33, 2.67). This is the primary Kp used by FORMULAS.md §7. */
  estimatedKp: number;
  /** Raw station-suffix string e.g. "1P". */
  kpCode: string;
}

/** One 3-hour observed Kp reading from the 7-day history. */
export interface SwpcKpObservedEntry {
  timeTag: string;
  kp: number;
  aRunning: number;
  stationCount: number;
}

/** Status of a Kp forecast entry. */
export type SwpcForecastStatus = 'observed' | 'estimated' | 'predicted';

/** One 3-hour Kp forecast entry (observed history + 3-day predictions). */
export interface SwpcKpForecastEntry {
  timeTag: string;
  kp: number;
  status: SwpcForecastStatus;
  /** NOAA geomagnetic storm scale, e.g. "G1"–"G5", or null when Kp < 5. */
  noaaScale: string | null;
}

/** One minute of propagated solar wind at L1. */
export interface SwpcSolarWindEntry {
  timeTag: string;
  /** Solar wind bulk speed, km/s. */
  speed: number | null;
  /** Proton density, p/cm³. */
  density: number | null;
  /** Proton temperature, K. */
  temperature: number | null;
  /** IMF Bx component, nT. */
  bx: number | null;
  /** IMF By component, nT. */
  by: number | null;
  /** IMF Bz component, nT. Southward (negative) drives geomagnetic storms. */
  bz: number | null;
  /** IMF total field magnitude, nT. */
  bt: number | null;
  /** Propagated arrival timestamp at Earth. */
  propagatedTimeTag: string | null;
}

/** Latest RTSW 1-minute plasma reading from the active source. */
export interface SwpcRtswPlasma {
  timeTag: string;
  source: string;
  protonSpeed: number | null; // km/s
  protonDensity: number | null; // p/cm³
  protonTemperature: number | null; // K
  overallQuality: number;
}

/**
 * The full normalised output from fetchSwpc().
 * Any field may be null if that specific endpoint was unavailable — per the
 * degradation contract (ARCHITECTURE.md §5), failure of one product within SWPC
 * only nulls that sub-field, it does not blank the entire SwpcData.
 */
export interface SwpcData {
  /** Most recent 1-minute Kp. Used by fast-tier poller. */
  kpCurrent: SwpcKpCurrent | null;
  /** Last ~7 days of 3-hour observed Kp. Used by the Causal Engine's history factor. */
  kpObserved: SwpcKpObservedEntry[] | null;
  /** 3-day Kp forecast (observed + estimated + predicted periods). Primary Kp for aurora prediction (FORMULAS.md §7). */
  kpForecast: SwpcKpForecastEntry[] | null;
  /** Recent 1-hour propagated solar wind (speed, density, Bz). Used by Heliosphere Pulse and Causal Engine. */
  solarWind: SwpcSolarWindEntry[] | null;
  /** Latest 1-minute RTSW plasma. Complements solarWind with fresher speed/density. */
  rtswPlasma: SwpcRtswPlasma | null;
  /** ISO-8601 fetch timestamp for freshness labelling. */
  fetchedAt: string;
}

/** Returned when the SWPC client cannot reach any endpoint. All data fields are null. */
export const SWPC_FALLBACK: SwpcData = {
  kpCurrent: null,
  kpObserved: null,
  kpForecast: null,
  solarWind: null,
  rtswPlasma: null,
  fetchedAt: new Date(0).toISOString(),
};
