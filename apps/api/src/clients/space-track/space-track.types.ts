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
 *   cubesat  → NORAD_CAT_ID/<88 IDs, see CUBESAT_NORAD_IDS>/DECAY_DATE/null-val/format/3le
 *     2026-09-08 follow-up: the `~~CUBESAT` wildcard undermatched CelesTrak's
 *     ~85 (single digits — most cataloged cubesats don't have "CUBESAT" in
 *     their Space-Track OBJECT_NAME) and, unlike every other category here,
 *     no Space-Track query predicate can derive CelesTrak's curated
 *     membership — "cubesat" is an editorial selection, not a name pattern
 *     or orbital regime. CelesTrak itself was unreachable from every
 *     available tool at fix time (DNS resolved but every TCP connect to
 *     celestrak.org was refused, both from this dev network and from
 *     WebFetch's separate infrastructure — a real outage, not a local
 *     block). Recovered the real list via the Wayback Machine's archived
 *     snapshot of `gp.php?GROUP=cubesat&FORMAT=json` (2026-02-09, 88
 *     objects — not guessed from memory) instead. Exact `NORAD_CAT_ID`
 *     list, `DECAY_DATE/null-val` added so objects that decay after this
 *     list was written silently drop out rather than needing a manual edit:
 *     88 → 83 live today (`DECAY_DATE/null-val` applied), 5 of the
 *     snapshot's 88 have since deorbited.
 *     Same staleness tradeoff as `stations` in reverse — this list won't
 *     pick up cubesats CelesTrak has added to the group since 2026-02-09.
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
 * CelesTrak's real `GROUP=cubesat` membership, recovered via the Wayback
 * Machine (`web.archive.org`'s 2026-02-09 snapshot of
 * `celestrak.org/NORAD/elements/gp.php?GROUP=cubesat&FORMAT=json`) because
 * celestrak.org itself was unreachable from every available tool when this
 * was written — not guessed from memory. 88 real NORAD catalog IDs; see the
 * `cubesat` note above for the live-verified current count.
 */
const CUBESAT_NORAD_IDS = [
  27844, 27848, 28895, 32785, 32790, 32791, 35932, 35933, 35935, 36799, 38767, 39090, 39091, 39151,
  39269, 39270, 39417, 39423, 39427, 39430, 39440, 39441, 39444, 39446, 40020, 40021, 40024, 40025,
  40032, 40037, 40039, 40042, 40043, 40045, 40046, 40055, 40056, 40074, 40119, 40965, 40966, 40967,
  40968, 40970, 40971, 40972, 40973, 40974, 40975, 40976, 40977, 41340, 41849, 41850, 41851, 41852,
  41853, 42846, 42847, 43016, 43759, 43767, 43816, 43850, 45727, 46504, 46505, 46506, 46507, 47941,
  53109, 57176, 57192, 57193, 57194, 57199, 57201, 57204, 57208, 59066, 59067, 59068, 59071, 60237,
  60240, 60243, 62391, 62394,
] as const;

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
  cubesat: `NORAD_CAT_ID/${CUBESAT_NORAD_IDS.join(',')}/DECAY_DATE/null-val`,
  debris: 'OBJECT_NAME/~~COSMOS 2251 DEB,~~FENGYUN 1C DEB,~~IRIDIUM 33 DEB/DECAY_DATE/null-val',
  hubble: 'NORAD_CAT_ID/20580/DECAY_DATE/null-val',
};
