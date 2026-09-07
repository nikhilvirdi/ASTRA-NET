/**
 * Typed output types for the Space-Track client.
 *
 * Space-Track's format/3le output is the same fixed-column NORAD TLE format
 * as CelesTrak's FORMAT=tle — the standard element-set format every
 * downstream consumer (satellite.js's `twoline2satrec`) already expects.
 * The parsed output therefore reuses `CelestrakTleData` / `CelestrakTleRecord`
 * from the celestrak types: one type per logical concept, not one per source.
 *
 * Space-Track query paths per category (all verified live 2026-09-07):
 *   stations → OBJECT_NAME/~~ISS,~~CSS,~~TIANHE/format/3le
 *   starlink  → OBJECT_NAME/~~STARLINK/format/3le
 *   oneweb    → OBJECT_NAME/~~ONEWEB/format/3le
 *   gps       → OBJECT_NAME/~~NAVSTAR,~~GPS/format/3le
 *   weather   → OBJECT_NAME/~~NOAA,~~GOES,~~METEOR/format/3le
 *   geo       → MEAN_MOTION/0.98--1.02/ECCENTRICITY/<0.05/format/3le
 *   cubesat   → OBJECT_NAME/~~CUBESAT/format/3le
 *   debris    → OBJECT_NAME/~~COSMOS 2251 DEB,~~FENGYUN 1C DEB,~~IRIDIUM 33 DEB/format/3le
 *   hubble    → NORAD_CAT_ID/20580/format/3le
 */

export type { CelestrakTleData as SpaceTrackTleData } from '../celestrak/celestrak.types.js';
export type { CelestrakTleRecord as SpaceTrackTleRecord } from '../celestrak/celestrak.types.js';

/** Space-Track base URL (session-cookie auth). */
export const SPACE_TRACK_BASE = 'https://www.space-track.org';

/** Login endpoint for POST credentials → set session cookie. */
export const SPACE_TRACK_LOGIN_URL = `${SPACE_TRACK_BASE}/ajaxauth/login`;

/** Base of every data query. */
export const SPACE_TRACK_QUERY_BASE = `${SPACE_TRACK_BASE}/basicspacedata/query/class/gp`;

/**
 * Per-category Space-Track query path segments (after `…/query/class/gp/`).
 * Each string is the predicate portion of the URL — appended with `/format/3le`
 * at request time. All verified live against the real Space-Track API
 * (2026-09-07). The `limit` parameter is NOT included here; the caller
 * appends `/limit/N` before `/format/3le` when it needs to cap the result.
 */
export const SPACE_TRACK_CATEGORY_PATHS: Record<string, string> = {
  stations: 'OBJECT_NAME/~~ISS,~~CSS,~~TIANHE',
  starlink: 'OBJECT_NAME/~~STARLINK',
  oneweb: 'OBJECT_NAME/~~ONEWEB',
  gps: 'OBJECT_NAME/~~NAVSTAR,~~GPS',
  weather: 'OBJECT_NAME/~~NOAA,~~GOES,~~METEOR',
  geo: 'MEAN_MOTION/0.98--1.02/ECCENTRICITY/<0.05',
  cubesat: 'OBJECT_NAME/~~CUBESAT',
  debris: 'OBJECT_NAME/~~COSMOS 2251 DEB,~~FENGYUN 1C DEB,~~IRIDIUM 33 DEB',
  hubble: 'NORAD_CAT_ID/20580',
};
