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
 * Fast-tier SWPC output (ARCHITECTURE.md §4: "SWPC solar wind + Kp-index",
 * polled 30-60s): the 1-minute Kp feed and the real-time RTSW plasma feed —
 * the two SWPC products that actually move on that timescale. Either field
 * may be null if its endpoint was unavailable — per the degradation contract
 * (ARCHITECTURE.md §5), failure of one product only nulls that sub-field.
 */
export interface SwpcFastData {
  /** Most recent 1-minute Kp. */
  kpCurrent: SwpcKpCurrent | null;
  /** Latest 1-minute RTSW plasma. Fresher speed/density than the slow-tier solar wind product. */
  rtswPlasma: SwpcRtswPlasma | null;
  /** ISO-8601 fetch timestamp for freshness labelling. */
  fetchedAt: string;
}

/**
 * Slow-tier SWPC output (ARCHITECTURE.md §4: "SWPC 3-day forecast / OVATION
 * oval", polled 5-15min): observed Kp history, the 3-day Kp forecast, and
 * propagated solar wind — none of these need faster refresh than the slow
 * tier's cadence.
 */
export interface SwpcSlowData {
  /** Last ~7 days of 3-hour observed Kp. Used by the Causal Engine's history factor. */
  kpObserved: SwpcKpObservedEntry[] | null;
  /** 3-day Kp forecast (observed + estimated + predicted periods). Primary Kp for aurora prediction (FORMULAS.md §7). */
  kpForecast: SwpcKpForecastEntry[] | null;
  /** Recent 1-hour propagated solar wind (speed, density, Bz). Used by Heliosphere Pulse and Causal Engine. */
  solarWind: SwpcSolarWindEntry[] | null;
  /** ISO-8601 fetch timestamp for freshness labelling. */
  fetchedAt: string;
}

/** Returned when the fast-tier SWPC client cannot reach any endpoint. All data fields are null. */
export const SWPC_FAST_FALLBACK: SwpcFastData = {
  kpCurrent: null,
  rtswPlasma: null,
  fetchedAt: new Date(0).toISOString(),
};

/** Returned when the slow-tier SWPC client cannot reach any endpoint. All data fields are null. */
export const SWPC_SLOW_FALLBACK: SwpcSlowData = {
  kpObserved: null,
  kpForecast: null,
  solarWind: null,
  fetchedAt: new Date(0).toISOString(),
};
