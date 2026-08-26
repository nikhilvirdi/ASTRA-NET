/**
 * Shared fetch-with-timeout-and-retry helper for every external API client
 * (celestrak, jpl-horizons, n2yo, nasa, open-meteo, swpc). All six
 * previously reimplemented this identical logic independently — same
 * per-attempt `AbortController` timeout, same exponential backoff, same
 * "don't retry a 4xx" rule, even the same `FETCH_TIMEOUT_MS = 10_000`
 * constant copy-pasted verbatim in each — consolidated here (see
 * DECISIONS.md). The one genuine difference across the six (celestrak's
 * plain-text TLE endpoint needs `response.text()` instead of
 * `response.json()`) is preserved via the `parseResponse` parameter, not
 * lost in the consolidation.
 *
 * Never throws to a caller mid-retry: it throws only once, on final
 * failure, same contract every prior copy had — each client's own
 * try/catch at the call site remains the actual "never throws to the
 * poller" boundary, unchanged by this extraction.
 */

/** Timeout per individual fetch attempt, in milliseconds. */
export const FETCH_TIMEOUT_MS = 10_000;

/** Maximum number of total attempts per request (1 initial + retries). */
export const MAX_ATTEMPTS = 3;

/** Initial backoff delay before the first retry, in milliseconds; doubles each attempt. */
export const INITIAL_BACKOFF_MS = 500;

/**
 * Fetches a URL with a per-attempt timeout and exponential-backoff retry.
 * `parseResponse` extracts the body (JSON by default; a plain-text endpoint
 * passes `(r) => r.text()`). A 4xx response is a client error and is never
 * retried; a 5xx, network failure, or timeout retries up to `maxAttempts`
 * total attempts with doubling backoff. Throws on final failure — callers
 * catch per-product.
 */
export async function fetchWithRetry<T = unknown>(
  url: string,
  parseResponse: (response: Response) => Promise<T> = (r) => r.json() as Promise<T>,
  timeoutMs: number = FETCH_TIMEOUT_MS,
  maxAttempts: number = MAX_ATTEMPTS,
  initialBackoffMs: number = INITIAL_BACKOFF_MS,
): Promise<T> {
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

      return await parseResponse(response);
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
