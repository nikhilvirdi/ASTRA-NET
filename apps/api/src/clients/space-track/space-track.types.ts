/**
 * Typed output types for the Space-Track client.
 *
 * Space-Track's format/3le output is the same fixed-column NORAD TLE format
 * as CelesTrak's FORMAT=tle — the standard element-set format every
 * downstream consumer (satellite.js's `twoline2satrec`) already expects.
 * The parsed output therefore reuses `CelestrakTleData` / `CelestrakTleRecord`
 * from the celestrak types: one type per logical concept, not one per source.
 *
 * Space-Track query paths per category (2026-09-08 retightening — see
 * DECISIONS.md "Space-Track fallback query predicates tightened"). The
 * 2026-09-07 originals used bare `~~` substring wildcards, which matched far
 * more than CelesTrak's equivalent curated GROUPs (verified live: stations
 * 164, weather 1071, geo 1562 real objects, vs CelesTrak's ~20/~72/~567) —
 * e.g. `~~ISS` matched "UME 1 (ISS 1)" (NORAD 8709), an unrelated 1976
 * satellite whose program code happens to contain "ISS". All paths below
 * re-verified live against the real API 2026-09-08:
 *   stations → NORAD_CAT_ID/25544,48274,53239,54216/format/3le
 *     Exact IDs for ISS (ZARYA) + the three crewed CSS (Tiangong) modules —
 *     no wildcard. Returns 4 (not ~20): CelesTrak's stations GROUP also
 *     includes whichever Soyuz/Progress/Dragon/Shenzhou/Tianzhou vehicles
 *     happen to be docked right now, which rotates every few months — a
 *     hardcoded ID for those would go stale, so this deliberately covers
 *     only the four permanent modules.
 *   starlink → OBJECT_NAME/~~STARLINK/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/format/3le
 *   oneweb   → OBJECT_NAME/~~ONEWEB/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/format/3le
 *     654 live (CelesTrak ~650).
 *   gps      → OBJECT_NAME/~~NAVSTAR,~~GPS/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/format/3le
 *   weather  → OBJECT_NAME/~~NOAA,~~GOES,~~METEOR/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/format/3le
 *     90 live (CelesTrak ~72). The bare wildcard's 1071 was almost entirely
 *     decayed debris fragments from old Meteor/NOAA satellite breakups
 *     (OBJECT_TYPE=DEBRIS, e.g. "METEOR 1-4 DEB") plus decades-defunct 1960s
 *     "METEOR 1-N"/"NOAA 1" payloads — both excluded by OBJECT_TYPE/PAYLOAD
 *     and DECAY_DATE/null-val respectively.
 *   geo      → MEAN_MOTION/0.98--1.02/ECCENTRICITY/<0.05/INCLINATION/<5/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/format/3le
 *     565 live (CelesTrak ~567 — near-exact). The bare orbital-element
 *     predicate's 1562 was mostly derelict graveyard objects: satellites
 *     that once station-kept at GEO but have drifted to several degrees of
 *     inclination after years without stationkeeping, while still satisfying
 *     the mean-motion/eccentricity bounds. Adding INCLINATION/<5 (true
 *     near-equatorial GEO) cut 1562 → ~565 almost exactly matching
 *     CelesTrak's curated count — confirmed empirically by inclination
 *     histogram (663 of 1261 PAYLOAD/non-decayed matches sat in the 5-15°
 *     band, overwhelmingly pre-2000 launches).
 *   cubesat  → OBJECT_NAME/~~CUBESAT/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/format/3le
 *     Undermatches CelesTrak's ~85 (returns single digits) both before and
 *     after this change — most cataloged cubesats don't have "CUBESAT" in
 *     their Space-Track OBJECT_NAME. Pre-existing, not what this pass fixes
 *     (not reported as broken; a real fix needs a curated ID list, same
 *     staleness tradeoff as stations).
 *   debris   → OBJECT_NAME/~~COSMOS 2251 DEB,~~FENGYUN 1C DEB,~~IRIDIUM 33 DEB/DECAY_DATE/null-val/format/3le
 *     3046 live (CelesTrak's three groups summed ~2658) — no OBJECT_TYPE
 *     filter here since these rows are legitimately OBJECT_TYPE=DEBRIS;
 *     DECAY_DATE/null-val alone dropped the bare wildcard's 5900 (which
 *     included decades of already-reentered fragments) down to this range.
 *   hubble   → NORAD_CAT_ID/20580/DECAY_DATE/null-val/format/3le
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
 * (2026-09-08 — see the retightening note above and DECISIONS.md). The
 * `limit` parameter is NOT included here; the caller appends `/limit/N`
 * before `/format/3le` when it needs to cap the result.
 */
export const SPACE_TRACK_CATEGORY_PATHS: Record<string, string> = {
  stations: 'NORAD_CAT_ID/25544,48274,53239,54216',
  starlink: 'OBJECT_NAME/~~STARLINK/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val',
  oneweb: 'OBJECT_NAME/~~ONEWEB/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val',
  gps: 'OBJECT_NAME/~~NAVSTAR,~~GPS/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val',
  weather: 'OBJECT_NAME/~~NOAA,~~GOES,~~METEOR/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val',
  geo: 'MEAN_MOTION/0.98--1.02/ECCENTRICITY/<0.05/INCLINATION/<5/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val',
  cubesat: 'OBJECT_NAME/~~CUBESAT/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val',
  debris: 'OBJECT_NAME/~~COSMOS 2251 DEB,~~FENGYUN 1C DEB,~~IRIDIUM 33 DEB/DECAY_DATE/null-val',
  hubble: 'NORAD_CAT_ID/20580/DECAY_DATE/null-val',
};
