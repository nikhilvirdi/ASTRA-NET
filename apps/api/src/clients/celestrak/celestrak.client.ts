/**
 * CelesTrak API client.
 *
 * Fetches JSON OMM data for satellites/constellations.
 * Validates with Zod, applies timeout+retry, never throws.
 */

import {
  CelestrakData,
  CelestrakOmmRecord,
  CelestrakTleData,
  CelestrakTleRecord,
} from './celestrak.types.js';
import { CelestrakOmmResponseSchema, CelestrakTleRecordsSchema } from './celestrak.schemas.js';
import { fetchWithRetry } from '../../lib/fetch-with-retry.js';

const BASE = 'https://celestrak.org/NORAD/elements/gp.php';

export interface FetchCelestrakParams {
  catnr?: number;
  group?: string;
}

function parseCelestrakOmm(raw: unknown): CelestrakOmmRecord[] | null {
  const result = CelestrakOmmResponseSchema.safeParse(raw);
  if (!result.success) return null;

  return result.data.map((entry) => ({
    objectName: entry.OBJECT_NAME,
    objectId: entry.OBJECT_ID,
    epoch: entry.EPOCH,
    meanMotion: entry.MEAN_MOTION,
    eccentricity: entry.ECCENTRICITY,
    inclination: entry.INCLINATION,
    raOfAscNode: entry.RA_OF_ASC_NODE,
    argOfPericenter: entry.ARG_OF_PERICENTER,
    meanAnomaly: entry.MEAN_ANOMALY,
    ephemerisType: entry.EPHEMERIS_TYPE,
    classificationType: entry.CLASSIFICATION_TYPE,
    noradCatId: entry.NORAD_CAT_ID,
    elementSetNo: entry.ELEMENT_SET_NO,
    revAtEpoch: entry.REV_AT_EPOCH,
    bstar: entry.BSTAR,
    meanMotionDot: entry.MEAN_MOTION_DOT,
    meanMotionDdot: entry.MEAN_MOTION_DDOT,
  }));
}

/**
 * Fetch OMM satellite elements from CelesTrak.
 * You must provide either a CATNR (catalog number, e.g., 25544 for ISS)
 * or a GROUP (e.g., 'active' or 'starlink').
 */
export async function fetchCelestrakOmm(
  params: FetchCelestrakParams,
  now: Date,
): Promise<CelestrakData> {
  const url = new URL(BASE);
  url.searchParams.set('FORMAT', 'json');
  if (params.catnr !== undefined) {
    url.searchParams.set('CATNR', params.catnr.toString());
  } else if (params.group) {
    url.searchParams.set('GROUP', params.group);
  } else {
    console.error('[celestrak] fetch failed: Must provide catnr or group');
    return { records: null, fetchedAt: now.toISOString() };
  }

  try {
    const raw = await fetchWithRetry(url.toString());
    const records = parseCelestrakOmm(raw);
    return { records, fetchedAt: now.toISOString() };
  } catch (err) {
    console.error('[celestrak] fetch failed:', err);
    return { records: null, fetchedAt: now.toISOString() };
  }
}

/**
 * Splits CelesTrak's FORMAT=tle plain-text response into name/line1/line2
 * triples. Each satellite is three lines (name, then the two fixed-column
 * element lines); trailing blank lines from the response are dropped before
 * chunking. Returns null if the text doesn't chunk evenly into triples —
 * a truncated/corrupt response, treated the same as any other parse failure.
 */
function parseCelestrakTleText(raw: string): CelestrakTleRecord[] | null {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0 || lines.length % 3 !== 0) return null;

  const candidates: unknown[] = [];
  for (let i = 0; i < lines.length; i += 3) {
    candidates.push({
      name: lines[i]?.trim() ?? '',
      line1: lines[i + 1]?.trimEnd() ?? '',
      line2: lines[i + 2]?.trimEnd() ?? '',
    });
  }

  const result = CelestrakTleRecordsSchema.safeParse(candidates);
  if (!result.success) return null;

  return result.data.map((entry) => ({
    name: entry.name,
    noradCatId: Number.parseInt(entry.line1.slice(2, 7), 10),
    line1: entry.line1,
    line2: entry.line2,
  }));
}

/**
 * Fetch raw TLE (two-line element) text from CelesTrak for a GROUP or CATNR
 * — the format satellite.js's `twoline2satrec` consumes directly. Sibling
 * to `fetchCelestrakOmm` (same retry/timeout pipeline, same endpoint, only
 * FORMAT differs) rather than a separate client, per the reuse-Phase-1
 * instruction.
 */
export async function fetchCelestrakTle(
  params: FetchCelestrakParams,
  now: Date,
): Promise<CelestrakTleData> {
  const url = new URL(BASE);
  url.searchParams.set('FORMAT', 'tle');
  if (params.catnr !== undefined) {
    url.searchParams.set('CATNR', params.catnr.toString());
  } else if (params.group) {
    url.searchParams.set('GROUP', params.group);
  } else {
    console.error('[celestrak] fetch failed: Must provide catnr or group');
    return { records: null, fetchedAt: now.toISOString() };
  }

  try {
    const raw = await fetchWithRetry<string>(url.toString(), (r) => r.text(), 20_000);
    const records = parseCelestrakTleText(raw);
    return { records, fetchedAt: now.toISOString() };
  } catch (err) {
    console.error('[celestrak] TLE fetch failed:', err);
    return { records: null, fetchedAt: now.toISOString() };
  }
}

export { CELESTRAK_FALLBACK, CELESTRAK_TLE_FALLBACK } from './celestrak.types.js';
