/**
 * Typed output types for the CelesTrak client.
 */

/** One parsed OMM satellite record. */
export interface CelestrakOmmRecord {
  objectName: string;
  objectId: string;
  epoch: string; // ISO-8601 UTC timestamp of the element set
  meanMotion: number; // revs/day
  eccentricity: number;
  inclination: number; // degrees
  raOfAscNode: number; // degrees
  argOfPericenter: number; // degrees
  meanAnomaly: number; // degrees
  ephemerisType: number;
  classificationType: string;
  noradCatId: number;
  elementSetNo: number;
  revAtEpoch: number;
  bstar: number;
  meanMotionDot: number;
  meanMotionDdot: number;
}

/**
 * Normalised output from fetchCelestrakOmm().
 * Returns null if the fetch fails (per degradation contract).
 */
export interface CelestrakData {
  records: CelestrakOmmRecord[] | null;
  fetchedAt: string;
}

/** Returned when the client cannot reach the endpoint. */
export const CELESTRAK_FALLBACK: CelestrakData = {
  records: null,
  fetchedAt: new Date(0).toISOString(),
};
