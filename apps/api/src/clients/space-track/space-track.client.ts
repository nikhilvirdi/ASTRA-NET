/**
 * Space-Track API client.
 *
 * Provides a fallback TLE source when CelesTrak is unreachable (confirmed
 * UND_ERR_CONNECT_TIMEOUT on Render's network — see DECISIONS.md).
 *
 * Auth: POST credentials to /ajaxauth/login → get a `chocolatechip` session
 * cookie → reuse across the process lifetime. On an expired/invalid session
 * Space-Track returns HTTP 500 with an HTML page (verified live 2026-09-07) —
 * the client re-logins once and retries on that signal.
 *
 * Rate limits: Space-Track caps at ~1 query every few seconds and imposes
 * hourly limits. This client is fallback-only: CelesTrak must have failed
 * before it is called, and it fires at most once per category per slow-tier
 * tick (every 10 min by default) — well within the documented limits.
 *
 * Never throws to callers — returns null on any failure, per the codebase's
 * degradation contract (ARCHITECTURE.md §5).
 */

import type { CelestrakTleData } from '../celestrak/celestrak.types.js';
import { parseTleText } from '../../lib/tle.js';
import {
  SPACE_TRACK_LOGIN_URL,
  SPACE_TRACK_QUERY_BASE,
  SPACE_TRACK_CATEGORY_PATHS,
} from './space-track.types.js';

const QUERY_TIMEOUT_MS = 30_000; // Space-Track can be slow; longer than fetchWithRetry's 10s.

// ─── Session cookie cache ─────────────────────────────────────────────────────

/** Module-level singleton: the raw `chocolatechip=…` cookie string. */
let cachedCookie: string | null = null;

/**
 * Visible for testing — resets the cached session so tests can exercise the
 * login path without sharing state between test cases.
 */
export function resetSessionCookie(): void {
  cachedCookie = null;
}

/**
 * Returns the current cached cookie without re-logging-in.
 * Exposed for testing only.
 */
export function getCachedCookie(): string | null {
  return cachedCookie;
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POSTs credentials to Space-Track and caches the session cookie.
 * Returns the cookie string on success, null on any failure.
 * Env vars: `SPACETRACK_USERNAME`, `SPACETRACK_PASSWORD`.
 */
export async function loginSpaceTrack(): Promise<string | null> {
  const username = process.env['SPACETRACK_USERNAME'];
  const password = process.env['SPACETRACK_PASSWORD'];

  if (!username || !password) {
    console.error('[space-track] SPACETRACK_USERNAME / SPACETRACK_PASSWORD not set — skipping.');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const res = await fetch(SPACE_TRACK_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ identity: username, password }).toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[space-track] Login failed with HTTP ${res.status}`);
      return null;
    }

    const rawCookies = res.headers.get('set-cookie');
    if (!rawCookies) {
      console.error('[space-track] Login response had no Set-Cookie header');
      return null;
    }

    // `set-cookie` may contain multiple directives (Secure; HttpOnly; Path=/).
    // The actual key=value pair is the first semicolon-delimited token.
    const cookie = rawCookies.split(';')[0]?.trim() ?? '';
    if (!cookie) {
      console.error('[space-track] Could not parse session cookie from Set-Cookie header');
      return null;
    }

    cachedCookie = cookie;
    return cookie;
  } catch (err) {
    console.error('[space-track] Login request failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Detects an expired/invalid session response. Space-Track returns HTTP 500
 * with an HTML page when the session cookie is missing, expired, or invalid
 * (verified live 2026-09-07 — `curl` without a cookie → 500 + HTML body;
 * same with an invalid `chocolatechip=bad_value` cookie).
 */
function isExpiredSessionResponse(status: number, contentType: string | null): boolean {
  return status === 500 || (status !== 200 && (contentType ?? '').includes('text/html'));
}

/**
 * Executes a single Space-Track query URL (already fully formed, including
 * `/format/3le`). Handles expired-session detection: if the response looks
 * like an auth failure, re-logins once and retries the query. Returns the
 * raw response text on success, null on any persistent failure.
 */
async function querySpaceTrack(url: string): Promise<string | null> {
  // Ensure we have a cookie to use.
  let cookie = cachedCookie ?? (await loginSpaceTrack());
  if (!cookie) return null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: { Cookie: cookie },
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type');

      if (isExpiredSessionResponse(res.status, contentType)) {
        if (attempt === 1) {
          // Session likely expired — re-login and retry once.
          console.warn('[space-track] Session expired, re-logging in...');
          cachedCookie = null;
          const fresh = await loginSpaceTrack();
          if (!fresh) return null;
          cookie = fresh;
          continue;
        }
        console.error('[space-track] Re-login did not fix session; giving up.');
        return null;
      }

      if (!res.ok) {
        console.error(`[space-track] Query failed with HTTP ${res.status}: ${url}`);
        return null;
      }

      return await res.text();
    } catch (err) {
      console.error(`[space-track] Query request failed (attempt ${attempt}):`, err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches TLE data for a named satellite category from Space-Track.
 * Uses the category → query-path mapping in `SPACE_TRACK_CATEGORY_PATHS`
 * (verified live against the real API 2026-09-07 — see DECISIONS.md).
 * Returns `{ records: null }` on any failure — never throws.
 *
 * @param category   One of the category strings in SPACE_TRACK_CATEGORY_PATHS.
 * @param limit      Optional per-category object cap (matches CelesTrak client's
 *                   MAX_SATELLITES_PER_SOURCE convention, applied by the caller
 *                   after merging, but passed here to bound large constellations
 *                   before parsing).
 * @param now        Injected clock (makes the function testable without real time).
 */
export async function fetchSpaceTrackTle(
  category: string,
  now: Date,
  limit?: number,
): Promise<CelestrakTleData> {
  const queryPath = SPACE_TRACK_CATEGORY_PATHS[category];
  if (!queryPath) {
    console.error(`[space-track] Unknown category "${category}" — no query path defined.`);
    return { records: null, fetchedAt: now.toISOString() };
  }

  const limitSegment = limit !== undefined ? `/limit/${limit}` : '';
  const url = `${SPACE_TRACK_QUERY_BASE}/${queryPath}${limitSegment}/format/3le`;

  const raw = await querySpaceTrack(url);
  if (raw === null) {
    return { records: null, fetchedAt: now.toISOString() };
  }

  const records = parseTleText(raw);
  if (records === null) {
    console.error(
      '[space-track] TLE fetch succeeded but response body did not parse into valid records:',
      url,
    );
    return { records: null, fetchedAt: now.toISOString() };
  }

  return { records, fetchedAt: now.toISOString() };
}
