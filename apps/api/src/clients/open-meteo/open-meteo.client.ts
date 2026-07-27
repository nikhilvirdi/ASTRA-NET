/**
 * Open-Meteo API client.
 *
 * Fetches cloud cover and visibility forecasts for a specific location.
 * Uses timeout+retry, Zod validation, never throws.
 */

import { OpenMeteoData, OpenMeteoHourlyData } from './open-meteo.types.js';
import {
  OpenMeteoBatchResponseSchema,
  OpenMeteoResponseSchema,
  type OpenMeteoResponse,
} from './open-meteo.schemas.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

export interface FetchOpenMeteoParams {
  latitude: number;
  longitude: number;
}

export interface FetchOpenMeteoBatchParams {
  points: FetchOpenMeteoParams[];
  /** Days of hourly forecast to request. Keeps a many-point payload small. */
  forecastDays?: number;
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
 * Open-Meteo emits *naive* ISO timestamps ("2026-07-27T00:00") with no
 * zone designator even when the request sets `timezone=UTC` — verified
 * against the live API. `new Date()` parses those as **local** time, so on
 * any non-UTC machine every hour silently shifts by the host's offset and
 * "the cloud cover at 22:00 UTC" quietly becomes a different hour. Pin them
 * to UTC here, at the boundary, so no consumer can inherit that bug.
 */
function toUtcIso(time: string): string {
  const alreadyZoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(time);
  const parsed = new Date(alreadyZoned ? time : `${time}Z`);
  return Number.isNaN(parsed.getTime()) ? time : parsed.toISOString();
}

/**
 * The refine on OpenMeteoHourlySchema guarantees these arrays are the same length as
 * `time`, but TS's noUncheckedIndexedAccess can't see that invariant across the schema
 * boundary — narrow explicitly and drop any hour that's missing a value rather than
 * smuggling `undefined` through as a `number`.
 */
function mapHourly(hourly: OpenMeteoResponse['hourly']): OpenMeteoHourlyData[] {
  return hourly.time.reduce<OpenMeteoHourlyData[]>((acc, t, i) => {
    const cloudCoverPercent = hourly.cloudcover[i];
    const visibilityMeters = hourly.visibility[i];
    if (cloudCoverPercent === undefined || visibilityMeters === undefined) {
      return acc;
    }
    acc.push({ time: toUtcIso(t), cloudCoverPercent, visibilityMeters });
    return acc;
  }, []);
}

/**
 * Fetch local cloud cover and visibility.
 */
export async function fetchOpenMeteo(
  params: FetchOpenMeteoParams,
  now: Date,
): Promise<OpenMeteoData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', params.latitude.toString());
  url.searchParams.set('longitude', params.longitude.toString());
  url.searchParams.set('hourly', 'cloudcover,visibility');
  url.searchParams.set('timezone', 'UTC');

  try {
    const raw = await fetchWithRetry(url.toString());
    const res = OpenMeteoResponseSchema.safeParse(raw);

    if (!res.success) {
      return {
        latitude: params.latitude,
        longitude: params.longitude,
        hourly: null,
        fetchedAt: now.toISOString(),
      };
    }

    return {
      latitude: res.data.latitude,
      longitude: res.data.longitude,
      hourly: mapHourly(res.data.hourly),
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('[open-meteo] fetch failed:', err);
    return {
      latitude: params.latitude,
      longitude: params.longitude,
      hourly: null,
      fetchedAt: now.toISOString(),
    };
  }
}

/** Default forecast window for batch requests — enough for "tonight" without a 7-day payload per point. */
const BATCH_FORECAST_DAYS = 2;

/**
 * Fetch cloud cover and visibility for many coordinates in a *single*
 * request — Open-Meteo accepts comma-separated `latitude`/`longitude` lists
 * and answers with an array in request order.
 *
 * `/api/best-spot` scores dozens of candidate sites per call; one request
 * per site would multiply this endpoint's external API cost by the
 * candidate count for no added information.
 *
 * Returns one entry per requested point, **always in request order and
 * always the same length as `points`**. Callers must key results by index,
 * not by the returned coordinates: Open-Meteo snaps each request to its
 * model grid and echoes the snapped coordinate, so the values it returns
 * are not the ones that were asked for (verified live — a request for
 * 32.73 comes back as 32.724075).
 *
 * For that reason the returned `latitude`/`longitude` are the **requested**
 * coordinates, not the snapped ones: the candidate site is what the score
 * refers to, and letting a snapped coordinate leak into the response would
 * put a site's marker up to ~5 km from the place that was actually scored.
 *
 * Never throws; a failed or malformed batch degrades to one `hourly: null`
 * entry per point, which is exactly the "cloud data unavailable" case
 * DESIGN_SPEC.md §12 requires the ranking to survive.
 */
export async function fetchOpenMeteoBatch(
  params: FetchOpenMeteoBatchParams,
  now: Date,
): Promise<OpenMeteoData[]> {
  const { points } = params;
  const unavailable = (): OpenMeteoData[] =>
    points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      hourly: null,
      fetchedAt: now.toISOString(),
    }));

  if (points.length === 0) return [];

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', points.map((p) => p.latitude).join(','));
  url.searchParams.set('longitude', points.map((p) => p.longitude).join(','));
  url.searchParams.set('hourly', 'cloudcover,visibility');
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('forecast_days', String(params.forecastDays ?? BATCH_FORECAST_DAYS));

  try {
    const raw = await fetchWithRetry(url.toString());

    // A single-point batch still comes back as a bare object, not a
    // one-element array — accept both rather than failing the whole call.
    const normalized = Array.isArray(raw) ? raw : [raw];
    const res = OpenMeteoBatchResponseSchema.safeParse(normalized);

    if (!res.success || res.data.length !== points.length) {
      console.error(
        `[open-meteo] batch response did not match the request: expected ${points.length} entries, got ${res.success ? res.data.length : 'a schema-invalid payload'}`,
      );
      return unavailable();
    }

    return res.data.map((entry: OpenMeteoResponse, i) => ({
      latitude: points[i]!.latitude,
      longitude: points[i]!.longitude,
      hourly: mapHourly(entry.hourly),
      fetchedAt: now.toISOString(),
    }));
  } catch (err) {
    console.error('[open-meteo] batch fetch failed:', err);
    return unavailable();
  }
}

export { OPEN_METEO_FALLBACK } from './open-meteo.types.js';
