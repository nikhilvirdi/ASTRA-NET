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

/**
 * One parsed TLE (two-line element) record: the classic fixed-column format
 * satellite.js's `twoline2satrec` expects verbatim — unlike the OMM record
 * above, these are not decomposed into named numeric fields here. Consumers
 * (the client-side propagator) parse `line1`/`line2` themselves via
 * satellite.js; this client's job stops at "real, validated element set for
 * a real object," not orbital propagation (ARCHITECTURE.md §2: propagation
 * is client-side).
 */
export interface CelestrakTleRecord {
  /** Satellite name (TLE line 0), trimmed. */
  name: string;
  noradCatId: number;
  line1: string;
  line2: string;
  /**
   * Which CelesTrak group/catnr this record was fetched under — attached by
   * the poller's merge step (`poller/slow-tier.ts`'s `fetchAllSatelliteGroups`),
   * not by this client (which stays generic over any single group/catnr and
   * has no notion of category). Optional here purely so this client's own
   * parsed records satisfy the type before that tagging happens; always
   * populated by the time a record reaches the store.
   */
  category?:
    | 'stations'
    | 'starlink'
    | 'oneweb'
    | 'gps'
    | 'weather'
    | 'geo'
    | 'cubesat'
    | 'debris'
    | 'hubble';
}

/** Normalised output from fetchCelestrakTle(). Returns null if the fetch fails. */
export interface CelestrakTleData {
  records: CelestrakTleRecord[] | null;
  fetchedAt: string;
}

/** Returned when the client cannot reach the endpoint. */
export const CELESTRAK_TLE_FALLBACK: CelestrakTleData = {
  records: null,
  fetchedAt: new Date(0).toISOString(),
};
