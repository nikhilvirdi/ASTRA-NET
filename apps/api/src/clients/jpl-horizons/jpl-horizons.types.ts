/**
 * Typed output types for the JPL Horizons client.
 */

export interface HorizonsData {
  /**
   * The raw block of text extracted between $$SOE and $$EOE.
   * If the fetch fails, this is null.
   */
  ephemerisLines: string[] | null;
  fetchedAt: string;
}

export const HORIZONS_FALLBACK: HorizonsData = {
  ephemerisLines: null,
  fetchedAt: new Date(0).toISOString(),
};

/** One OBSERVER-table ephemeris row parsed to typed degrees. */
export interface HorizonsRaDecEntry {
  /** Row timestamp (UT) as epoch milliseconds. */
  timestampUtcMs: number;
  raDeg: number;
  decDeg: number;
}

export interface HorizonsRaDecData {
  /** Parsed rows, or null if the fetch failed or no row survived validation. */
  entries: HorizonsRaDecEntry[] | null;
  fetchedAt: string;
}

export const HORIZONS_RA_DEC_FALLBACK: HorizonsRaDecData = {
  entries: null,
  fetchedAt: new Date(0).toISOString(),
};
