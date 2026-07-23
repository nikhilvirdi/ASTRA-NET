/**
 * JPL Horizons API client.
 *
 * Fetches ephemeris data for planetary bodies.
 * Uses timeout+retry, Zod validation, never throws.
 */

import { HorizonsData, HorizonsRaDecData, HorizonsRaDecEntry } from './jpl-horizons.types.js';
import { HorizonsRaDecEntrySchema, HorizonsResponseSchema } from './jpl-horizons.schemas.js';

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
  quantities?: string; // e.g. '1' (astrometric RA/Dec) — OBSERVER tables only
  angFormat?: 'HMS' | 'DEG';
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
export async function fetchHorizons(params: FetchHorizonsParams, now: Date): Promise<HorizonsData> {
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
  if (params.quantities) url.searchParams.set('QUANTITIES', `'${params.quantities}'`);
  if (params.angFormat) url.searchParams.set('ANG_FORMAT', `'${params.angFormat}'`);

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

export interface FetchHorizonsRaDecParams {
  command: string; // e.g. '599' for Jupiter
  startTime: string; // YYYY-MM-DD
  stopTime: string; // YYYY-MM-DD
  stepSize?: string; // e.g. '1 h'
  center?: string; // e.g. '500@399' (Geocentric)
}

const EPHEM_MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

/** Horizons OBSERVER-table date column, e.g. `2026-Jul-23 01:00` (UT). */
const EPHEM_DATE_RE = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})/;

function parseEphemerisTimestampUtcMs(dateField: string): number | null {
  const match = EPHEM_DATE_RE.exec(dateField);
  if (!match) return null;
  const [, year, monthName, day, hour, minute] = match;
  if (!year || !monthName || !day || !hour || !minute) return null;
  const month = EPHEM_MONTHS[monthName];
  if (month === undefined) return null;
  return Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute));
}

/**
 * Parses CSV-format OBSERVER ephemeris lines requested with QUANTITIES='1'
 * and ANG_FORMAT='DEG': `date, solar-presence, lunar-presence, RA_deg, Dec_deg,`.
 * Each parsed row is Zod-validated (finite, RA in [0,360], Dec in [-90,90]);
 * rows that don't match are skipped rather than failing the whole set, and a
 * set with zero valid rows degrades to null like a failed fetch.
 */
export function parseEphemerisRaDecLines(lines: string[]): HorizonsRaDecEntry[] | null {
  const entries: HorizonsRaDecEntry[] = [];

  for (const line of lines) {
    const fields = line.split(',');
    if (fields.length < 5) continue;

    const timestampUtcMs = parseEphemerisTimestampUtcMs(fields[0].trim());
    if (timestampUtcMs === null) continue;

    const result = HorizonsRaDecEntrySchema.safeParse({
      timestampUtcMs,
      raDeg: Number(fields[3].trim()),
      decDeg: Number(fields[4].trim()),
    });
    if (result.success) entries.push(result.data);
  }

  return entries.length > 0 ? entries : null;
}

/**
 * Fetch a body's RA/Dec ephemeris from JPL Horizons as typed, validated
 * degrees. Thin composition over `fetchHorizons` (same retry/timeout/never-
 * throws pipeline) that pins the query to the one table shape
 * `parseEphemerisRaDecLines` understands.
 */
export async function fetchHorizonsRaDec(
  params: FetchHorizonsRaDecParams,
  now: Date,
): Promise<HorizonsRaDecData> {
  const raw = await fetchHorizons(
    {
      ...params,
      makeEphem: 'YES',
      ephemType: 'OBSERVER',
      csvFormat: 'YES',
      quantities: '1',
      angFormat: 'DEG',
    },
    now,
  );

  if (raw.ephemerisLines === null) {
    return { entries: null, fetchedAt: raw.fetchedAt };
  }

  return { entries: parseEphemerisRaDecLines(raw.ephemerisLines), fetchedAt: raw.fetchedAt };
}

export { HORIZONS_FALLBACK } from './jpl-horizons.types.js';
