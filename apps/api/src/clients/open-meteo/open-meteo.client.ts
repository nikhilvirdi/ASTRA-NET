/**
 * Open-Meteo API client.
 *
 * Fetches cloud cover and visibility forecasts for a specific location.
 * Uses timeout+retry, Zod validation, never throws.
 */

import { OpenMeteoData } from './open-meteo.types.js';
import { OpenMeteoResponseSchema } from './open-meteo.schemas.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

export interface FetchOpenMeteoParams {
  latitude: number;
  longitude: number;
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
      return { latitude: params.latitude, longitude: params.longitude, hourly: null, fetchedAt: now.toISOString() };
    }

    const hourly = res.data.hourly.time.map((t, i) => ({
      time: t,
      cloudCoverPercent: res.data.hourly.cloudcover[i],
      visibilityMeters: res.data.hourly.visibility[i],
    }));

    return {
      latitude: res.data.latitude,
      longitude: res.data.longitude,
      hourly,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('[open-meteo] fetch failed:', err);
    return { latitude: params.latitude, longitude: params.longitude, hourly: null, fetchedAt: now.toISOString() };
  }
}

export { OPEN_METEO_FALLBACK } from './open-meteo.types.js';
