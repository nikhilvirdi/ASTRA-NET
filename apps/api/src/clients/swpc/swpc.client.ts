/**
 * NOAA SWPC (Space Weather Prediction Center) data client.
 *
 * Fetches five products (Kp 1-min, Kp observed, Kp forecast, propagated solar wind,
 * RTSW plasma), validates each with Zod, and returns a typed SwpcData object.
 *
 * Design principles (per AGENTS.md):
 * - Never throws. Any network or validation failure is caught, logged, and results
 *   in that product's field being null in the returned SwpcData.
 * - Timeout + exponential-backoff retry on transient failures (5xx, network errors).
 * - 2xx responses with invalid shapes are also caught (Zod parse error).
 * - No side effects, no DB, no clock globals — `now` injected as parameter.
 * - Each product fetch is independent; one failing does not abort the others.
 *
 * Fallback behaviour (API_SOURCES.md §NOAA SWPC):
 *   Failure → return last known values held by the poller's in-memory store.
 *   This client's job is only to fetch + validate; the poller manages the cache.
 *
 * Rate limit: No API key required. SWPC asks for reasonable use; the poller
 * calls this at the two-tier schedule (fast: 30-60s, slow: 5-15min), which
 * means ≤ 2 req/min in steady state — well within informal limits.
 */

import {
  SwpcData,
  SwpcKpCurrent,
  SwpcKpForecastEntry,
  SwpcKpObservedEntry,
  SwpcRtswPlasma,
  SwpcSolarWindEntry,
} from './swpc.types.js';
import {
  KpForecastResponseSchema,
  KpObservedResponseSchema,
  KpOneMinuteResponseSchema,
  RtswWindResponseSchema,
  SolarWindEntrySchema,
  SolarWindRawResponseSchema,
} from './swpc.schemas.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE = 'https://services.swpc.noaa.gov';

const ENDPOINTS = {
  kpOneMin: `${BASE}/json/planetary_k_index_1m.json`,
  kpObserved: `${BASE}/products/noaa-planetary-k-index.json`,
  kpForecast: `${BASE}/products/noaa-planetary-k-index-forecast.json`,
  solarWind: `${BASE}/products/geospace/propagated-solar-wind-1-hour.json`,
  rtswPlasma: `${BASE}/json/rtsw/rtsw_wind_1m.json`,
} as const;

/** Timeout per individual fetch attempt, in milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;

/** Maximum number of total attempts per product (1 initial + N retries). */
const MAX_ATTEMPTS = 3;

/** Initial backoff delay before first retry, in milliseconds. */
const INITIAL_BACKOFF_MS = 500;

// ---------------------------------------------------------------------------
// Low-level fetch helper with timeout + exponential backoff
// ---------------------------------------------------------------------------

/**
 * Fetches a URL with a per-request timeout and exponential-backoff retry.
 * Returns the parsed JSON body on success.
 * Throws on final failure (caller catches per-product).
 *
 * @param url - The URL to fetch.
 * @param timeoutMs - Per-attempt timeout in ms.
 * @param maxAttempts - Total attempts (1 + retries).
 * @param initialBackoffMs - First retry delay; doubles each attempt.
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
        // 4xx are not retried (client errors — URL is wrong)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`HTTP ${response.status} for ${url} — not retrying (client error)`);
        }
        // 5xx: log and retry
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

// ---------------------------------------------------------------------------
// Per-product parsers
// ---------------------------------------------------------------------------

/** Parse the 1-minute Kp feed and return the most-recent entry. */
function parseKpCurrent(raw: unknown): SwpcKpCurrent | null {
  const result = KpOneMinuteResponseSchema.safeParse(raw);
  if (!result.success || result.data.length === 0) return null;

  // Entries are in ascending time order; last element is most recent.
  const latest = result.data[result.data.length - 1];
  if (!latest) return null;

  return {
    timeTag: latest.time_tag,
    kpIndex: latest.kp_index,
    estimatedKp: latest.estimated_kp,
    kpCode: latest.kp,
  };
}

/** Parse the observed 3-hour Kp history. */
function parseKpObserved(raw: unknown): SwpcKpObservedEntry[] | null {
  const result = KpObservedResponseSchema.safeParse(raw);
  if (!result.success) return null;

  return result.data.map((entry) => ({
    timeTag: entry.time_tag,
    kp: entry.Kp,
    aRunning: entry.a_running,
    stationCount: entry.station_count,
  }));
}

/** Parse the 3-day Kp forecast. */
function parseKpForecast(raw: unknown): SwpcKpForecastEntry[] | null {
  const result = KpForecastResponseSchema.safeParse(raw);
  if (!result.success) return null;

  return result.data.map((entry) => ({
    timeTag: entry.time_tag,
    kp: entry.kp,
    status: entry.observed,
    noaaScale: entry.noaa_scale,
  }));
}

/**
 * Parse the propagated solar wind tuple array.
 *
 * Wire format: first element is string[] header row, subsequent elements are
 * (string | number | null)[] value tuples. We convert to named objects.
 */
function parseSolarWind(raw: unknown): SwpcSolarWindEntry[] | null {
  const rawResult = SolarWindRawResponseSchema.safeParse(raw);
  if (!rawResult.success || rawResult.data.length < 2) return null;

  const [headerRow, ...dataRows] = rawResult.data;
  if (!headerRow) return null;

  // Safety: confirm header matches expected shape
  const expectedHeaders = [
    'time_tag',
    'speed',
    'density',
    'temperature',
    'bx',
    'by',
    'bz',
    'bt',
    'vx',
    'vy',
    'vz',
    'propagated_time_tag',
  ];
  if (!expectedHeaders.every((h, i) => headerRow[i] === h)) {
    console.error('[swpc] solar wind header mismatch — skipping product');
    return null;
  }

  const entries: SwpcSolarWindEntry[] = [];
  for (const row of dataRows) {
    const candidate = {
      time_tag: row[0] as string,
      speed: row[1] as number | null,
      density: row[2] as number | null,
      temperature: row[3] as number | null,
      bx: row[4] as number | null,
      by: row[5] as number | null,
      bz: row[6] as number | null,
      bt: row[7] as number | null,
      vx: row[8] as number | null,
      vy: row[9] as number | null,
      vz: row[10] as number | null,
      propagated_time_tag: row[11] as string | null,
    };
    const parsed = SolarWindEntrySchema.safeParse(candidate);
    if (parsed.success) {
      entries.push({
        timeTag: parsed.data.time_tag,
        speed: parsed.data.speed,
        density: parsed.data.density,
        temperature: parsed.data.temperature,
        bx: parsed.data.bx,
        by: parsed.data.by,
        bz: parsed.data.bz,
        bt: parsed.data.bt,
        propagatedTimeTag: parsed.data.propagated_time_tag,
      });
    }
  }

  return entries.length > 0 ? entries : null;
}

/**
 * Parse the RTSW 1-minute plasma feed and return the most-recent active reading.
 * Entries are in descending time order; we find the first `active: true` entry.
 */
function parseRtswPlasma(raw: unknown): SwpcRtswPlasma | null {
  const result = RtswWindResponseSchema.safeParse(raw);
  if (!result.success || result.data.length === 0) return null;

  // Entries are descending; find first active reading
  const active = result.data.find((e) => e.active);
  if (!active) return null;

  return {
    timeTag: active.time_tag,
    source: active.source,
    protonSpeed: active.proton_speed,
    protonDensity: active.proton_density,
    protonTemperature: active.proton_temperature,
    overallQuality: active.overall_quality,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all NOAA SWPC products and return a typed SwpcData object.
 *
 * @param now - Current timestamp (injected, never reads Date.now() internally).
 * @returns SwpcData with per-product fields nullable on failure.
 *          Never throws — any failure is caught and that field is set to null.
 */
export async function fetchSwpc(now: Date): Promise<SwpcData> {
  // Fire all five product fetches in parallel; capture errors per product.
  const [kpOneMinRaw, kpObservedRaw, kpForecastRaw, solarWindRaw, rtswPlasmaRaw] =
    await Promise.allSettled([
      fetchWithRetry(ENDPOINTS.kpOneMin),
      fetchWithRetry(ENDPOINTS.kpObserved),
      fetchWithRetry(ENDPOINTS.kpForecast),
      fetchWithRetry(ENDPOINTS.solarWind),
      fetchWithRetry(ENDPOINTS.rtswPlasma),
    ]);

  const extract = (result: PromiseSettledResult<unknown>): unknown => {
    if (result.status === 'fulfilled') return result.value;
    console.error('[swpc] fetch failed:', result.reason);
    return null;
  };

  return {
    kpCurrent: parseKpCurrent(extract(kpOneMinRaw)) ?? null,
    kpObserved: parseKpObserved(extract(kpObservedRaw)) ?? null,
    kpForecast: parseKpForecast(extract(kpForecastRaw)) ?? null,
    solarWind: parseSolarWind(extract(solarWindRaw)) ?? null,
    rtswPlasma: parseRtswPlasma(extract(rtswPlasmaRaw)) ?? null,
    fetchedAt: now.toISOString(),
  };
}

/**
 * Convenience re-export of the fallback value.
 * The poller uses this as the initial state before the first successful fetch.
 */
export { SWPC_FALLBACK } from './swpc.types.js';
