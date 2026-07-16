/**
 * CelesTrak API client.
 *
 * Fetches JSON OMM data for satellites/constellations.
 * Validates with Zod, applies timeout+retry, never throws.
 */

import { CelestrakData, CelestrakOmmRecord } from './celestrak.types.js';
import { CelestrakOmmResponseSchema } from './celestrak.schemas.js';

const BASE = 'https://celestrak.org/NORAD/elements/gp.php';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

export interface FetchCelestrakParams {
  catnr?: number;
  group?: string;
}

/**
 * Fetches a URL with a per-request timeout and exponential-backoff retry.
 * Returns the parsed JSON body on success.
 * Throws on final failure (caller catches per-product).
 */
async function fetchWithRetry(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS,
  maxAttempts: number = MAX_ATTEMPTS,
  initialBackoffMs: number = INITIAL_BACKOFF_MS,
): Promise<unknown> {
  let lastError: unknown;
  let backoff = initialBackoffMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`HTTP ${response.status} for ${url} — not retrying (client error)`);
        }
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
      const is4xx = err instanceof Error && err.message.includes('not retrying');
      if (is4xx || attempt === maxAttempts) break;

      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
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

export { CELESTRAK_FALLBACK } from './celestrak.types.js';
