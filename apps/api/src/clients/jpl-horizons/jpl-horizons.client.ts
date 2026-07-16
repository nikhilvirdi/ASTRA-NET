/**
 * JPL Horizons API client.
 *
 * Fetches ephemeris data for planetary bodies.
 * Uses timeout+retry, Zod validation, never throws.
 */

import { HorizonsData } from './jpl-horizons.types.js';
import { HorizonsResponseSchema } from './jpl-horizons.schemas.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

export interface FetchHorizonsParams {
  command: string; // e.g. '499' for Mars
  startTime: string; // YYYY-MM-DD
  stopTime: string; // YYYY-MM-DD
  stepSize?: string; // e.g. '1 d'
  center?: string; // e.g. '500@399' (Geocentric)
  makeEphem?: 'YES' | 'NO';
  ephemType?: 'OBSERVER' | 'VECTORS';
  csvFormat?: 'YES' | 'NO';
}

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

/**
 * Fetch ephemeris data from JPL Horizons.
 */
export async function fetchHorizons(
  params: FetchHorizonsParams,
  now: Date,
): Promise<HorizonsData> {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  url.searchParams.set('format', 'json');
  url.searchParams.set('COMMAND', `'${params.command}'`);
  url.searchParams.set('START_TIME', `'${params.startTime}'`);
  url.searchParams.set('STOP_TIME', `'${params.stopTime}'`);
  
  if (params.stepSize) url.searchParams.set('STEP_SIZE', `'${params.stepSize}'`);
  if (params.center) url.searchParams.set('CENTER', `'${params.center}'`);
  if (params.makeEphem) url.searchParams.set('MAKE_EPHEM', `'${params.makeEphem}'`);
  if (params.ephemType) url.searchParams.set('EPHEM_TYPE', `'${params.ephemType}'`);
  if (params.csvFormat) url.searchParams.set('CSV_FORMAT', `'${params.csvFormat}'`);

  try {
    const raw = await fetchWithRetry(url.toString());
    const result = HorizonsResponseSchema.safeParse(raw);
    
    if (!result.success) {
      return { ephemerisLines: null, fetchedAt: now.toISOString() };
    }

    const text = result.data.result;
    const soeIdx = text.indexOf('$$SOE');
    const eoeIdx = text.indexOf('$$EOE');

    if (soeIdx === -1 || eoeIdx === -1 || soeIdx >= eoeIdx) {
      console.warn('[jpl-horizons] Could not find $$SOE or $$EOE in response');
      return { ephemerisLines: null, fetchedAt: now.toISOString() };
    }

    // Extract everything between $$SOE and $$EOE, split by newline, drop empty lines
    const payload = text.slice(soeIdx + 5, eoeIdx);
    const lines = payload
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return {
      ephemerisLines: lines,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('[jpl-horizons] fetch failed:', err);
    return { ephemerisLines: null, fetchedAt: now.toISOString() };
  }
}

export { HORIZONS_FALLBACK } from './jpl-horizons.types.js';
