/**
 * NASA DONKI & NeoWs clients.
 *
 * Fetches CME/Flare data (DONKI) and Near-Earth Objects (NeoWs).
 * Uses timeout+retry, Zod validation, never throws.
 */

import { NasaDonkiData, NasaNeowsData } from './nasa.types.js';
import {
  DonkiCmeResponseSchema,
  DonkiFlrResponseSchema,
  NeowsFeedResponseSchema,
} from './nasa.schemas.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

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

export interface FetchNasaDonkiParams {
  startDate?: string;
  endDate?: string;
}

export async function fetchNasaDonki(
  params: FetchNasaDonkiParams,
  apiKey: string,
  now: Date,
): Promise<NasaDonkiData> {
  const cmeUrl = new URL('https://api.nasa.gov/DONKI/CME');
  cmeUrl.searchParams.set('api_key', apiKey);
  if (params.startDate) cmeUrl.searchParams.set('startDate', params.startDate);
  if (params.endDate) cmeUrl.searchParams.set('endDate', params.endDate);

  const flrUrl = new URL('https://api.nasa.gov/DONKI/FLR');
  flrUrl.searchParams.set('api_key', apiKey);
  if (params.startDate) flrUrl.searchParams.set('startDate', params.startDate);
  if (params.endDate) flrUrl.searchParams.set('endDate', params.endDate);

  try {
    const [cmeRaw, flrRaw] = await Promise.all([
      fetchWithRetry(cmeUrl.toString()).catch((e: unknown) => {
        console.error('[nasa/donki] CME fetch failed:', e instanceof Error ? e.message : String(e));
        return null; // Swallow so we can try parsing FLR
      }),
      fetchWithRetry(flrUrl.toString()).catch((e: unknown) => {
        console.error('[nasa/donki] FLR fetch failed:', e instanceof Error ? e.message : String(e));
        return null;
      }),
    ]);

    let cmes = null;
    let flares = null;

    if (cmeRaw) {
      const cmeRes = DonkiCmeResponseSchema.safeParse(cmeRaw);
      if (cmeRes.success) {
        cmes = cmeRes.data.map((cme) => ({
          activityId: cme.activityID,
          startTime: cme.startTime ?? null,
          note: cme.note ?? null,
          link: cme.link ?? null,
          analyses: (cme.cmeAnalyses ?? []).map((a) => ({
            isMostAccurate: a.isMostAccurate ?? false,
            time21_5: a.time21_5 ?? null,
            latitude: a.latitude ?? null,
            longitude: a.longitude ?? null,
            halfAngle: a.halfAngle ?? null,
            speed: a.speed ?? null,
            type: a.type ?? null,
          })),
        }));
      }
    }

    if (flrRaw) {
      const flrRes = DonkiFlrResponseSchema.safeParse(flrRaw);
      if (flrRes.success) {
        flares = flrRes.data.map((flr) => ({
          flrId: flr.flrID,
          beginTime: flr.beginTime ?? null,
          peakTime: flr.peakTime ?? null,
          endTime: flr.endTime ?? null,
          classType: flr.classType ?? null,
          sourceLocation: flr.sourceLocation ?? null,
          link: flr.link ?? null,
        }));
      }
    }

    // Both failing means overall failure
    if (cmeRaw === null && flrRaw === null) {
      return { cmes: null, flares: null, fetchedAt: now.toISOString() };
    }

    return { cmes, flares, fetchedAt: now.toISOString() };
  } catch (err) {
    console.error('[nasa/donki] unexpected error:', err);
    return { cmes: null, flares: null, fetchedAt: now.toISOString() };
  }
}

export interface FetchNasaNeowsParams {
  startDate: string;
  endDate: string;
}

export async function fetchNasaNeows(
  params: FetchNasaNeowsParams,
  apiKey: string,
  now: Date,
): Promise<NasaNeowsData> {
  const url = new URL('https://api.nasa.gov/neo/rest/v1/feed');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('start_date', params.startDate);
  url.searchParams.set('end_date', params.endDate);

  try {
    const raw = await fetchWithRetry(url.toString());
    const res = NeowsFeedResponseSchema.safeParse(raw);

    if (!res.success) {
      return { elementCount: 0, objects: null, fetchedAt: now.toISOString() };
    }

    const objects = Object.values(res.data.near_earth_objects)
      .flat()
      .map((neo) => ({
        id: neo.id,
        name: neo.name,
        nasaJplUrl: neo.nasa_jpl_url,
        absoluteMagnitudeH: neo.absolute_magnitude_h ?? null,
        estimatedDiameterMinKm: neo.estimated_diameter.kilometers.estimated_diameter_min,
        estimatedDiameterMaxKm: neo.estimated_diameter.kilometers.estimated_diameter_max,
        isPotentiallyHazardous: neo.is_potentially_hazardous_asteroid,
        isSentryObject: neo.is_sentry_object,
        closeApproaches: neo.close_approach_data.map((ca) => ({
          date: ca.close_approach_date,
          epochDate: ca.epoch_date_close_approach,
          velocityKmS: parseFloat(ca.relative_velocity.kilometers_per_second),
          missDistanceKm: parseFloat(ca.miss_distance.kilometers),
          orbitingBody: ca.orbiting_body,
        })),
      }));

    return {
      elementCount: res.data.element_count,
      objects,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('[nasa/neows] fetch failed:', err);
    return { elementCount: 0, objects: null, fetchedAt: now.toISOString() };
  }
}

export { NASA_DONKI_FALLBACK, NASA_NEOWS_FALLBACK } from './nasa.types.js';
