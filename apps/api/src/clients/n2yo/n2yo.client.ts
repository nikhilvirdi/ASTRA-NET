/**
 * N2YO API client.
 *
 * Fetches satellite positions and visual passes.
 * Uses timeout+retry, never throws.
 */

import { N2yoPositionsData, N2yoVisualPassesData } from './n2yo.types.js';
import { N2yoPositionsResponseSchema, N2yoVisualPassesResponseSchema } from './n2yo.schemas.js';

const BASE = 'https://api.n2yo.com/rest/v1/satellite';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

export interface FetchN2yoPositionsParams {
  satId: number;
  observerLat: number;
  observerLng: number;
  observerAlt: number;
  seconds: number;
}

export interface FetchN2yoVisualPassesParams {
  satId: number;
  observerLat: number;
  observerLng: number;
  observerAlt: number;
  days: number;
  minVisibility: number;
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
 * Fetch generic positions for a satellite.
 * Assumes apiKey is provided.
 */
export async function fetchN2yoPositions(
  params: FetchN2yoPositionsParams,
  apiKey: string,
  now: Date,
): Promise<N2yoPositionsData> {
  const url = `${BASE}/positions/${params.satId}/${params.observerLat}/${params.observerLng}/${params.observerAlt}/${params.seconds}/?apiKey=${apiKey}`;

  try {
    const raw = await fetchWithRetry(url);
    const result = N2yoPositionsResponseSchema.safeParse(raw);
    if (!result.success) {
      return { satId: params.satId, satName: 'Unknown', positions: null, fetchedAt: now.toISOString() };
    }

    const data = result.data;
    const positions = data.positions.map((p) => ({
      latitude: p.satlatitude,
      longitude: p.satlongitude,
      altitude: p.sataltitude,
      azimuth: p.azimuth,
      elevation: p.elevation,
      ra: p.ra,
      dec: p.dec,
      timestamp: p.timestamp,
      eclipsed: p.eclipsed ?? false,
    }));

    return {
      satId: data.info.satid,
      satName: data.info.satname,
      positions: positions.length > 0 ? positions : null,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('[n2yo] fetch positions failed:', err);
    return { satId: params.satId, satName: 'Unknown', positions: null, fetchedAt: now.toISOString() };
  }
}

/**
 * Fetch visual passes for a satellite.
 */
export async function fetchN2yoVisualPasses(
  params: FetchN2yoVisualPassesParams,
  apiKey: string,
  now: Date,
): Promise<N2yoVisualPassesData> {
  const url = `${BASE}/visualpasses/${params.satId}/${params.observerLat}/${params.observerLng}/${params.observerAlt}/${params.days}/${params.minVisibility}/?apiKey=${apiKey}`;

  try {
    const raw = await fetchWithRetry(url);
    const result = N2yoVisualPassesResponseSchema.safeParse(raw);
    
    if (!result.success) {
      return { satId: params.satId, satName: 'Unknown', passes: null, fetchedAt: now.toISOString() };
    }

    const data = result.data;
    // N2YO can return passescount = 0 with no passes array
    if (!data.passes || data.info.passescount === 0) {
      return {
        satId: data.info.satid,
        satName: data.info.satname,
        passes: [],
        fetchedAt: now.toISOString(),
      };
    }

    const passes = data.passes.map((p) => ({
      startAzimuth: p.startAz,
      startAzimuthCompass: p.startAzCompass,
      startElevation: p.startEl,
      startUtc: p.startUTC,
      maxAzimuth: p.maxAz,
      maxAzimuthCompass: p.maxAzCompass,
      maxElevation: p.maxEl,
      maxUtc: p.maxUTC,
      endAzimuth: p.endAz,
      endAzimuthCompass: p.endAzCompass,
      endElevation: p.endEl,
      endUtc: p.endUTC,
      magnitude: p.mag,
      duration: p.duration,
    }));

    return {
      satId: data.info.satid,
      satName: data.info.satname,
      passes,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('[n2yo] fetch passes failed:', err);
    return { satId: params.satId, satName: 'Unknown', passes: null, fetchedAt: now.toISOString() };
  }
}

export { N2YO_POSITIONS_FALLBACK, N2YO_VISUAL_PASSES_FALLBACK } from './n2yo.types.js';
