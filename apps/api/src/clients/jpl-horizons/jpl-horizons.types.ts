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
