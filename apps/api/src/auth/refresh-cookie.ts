/**
 * Refresh-token cookie helpers (Phase 5, ARCHITECTURE.md §3 G: "30 days,
 * httpOnly cookie, rotated on use"). Centralized here since login,
 * logout, and refresh all set/read/clear the same cookie — one place
 * owns its name, path, and attributes so the three routes can't drift.
 *
 * Reading requires the `cookie` package directly: Express (v5, no
 * `cookie-parser` in this project) never parses the incoming `Cookie`
 * header into `req.cookies` on its own. Setting/clearing uses Express's
 * own built-in `res.cookie`/`res.clearCookie`, which already depend on
 * `cookie` internally for serialization — this file adds no new
 * capability beyond the read side. See DECISIONS.md.
 */

import { parse } from 'cookie';
import type { Request, Response } from 'express';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/**
 * Scoped to `/api/auth` — only logout and refresh ever need to read this
 * cookie back, so it's never sent on unrelated requests (e.g. `/api/brief`).
 */
const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';

export function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: REFRESH_TOKEN_COOKIE_PATH });
}

/** Returns `null` when no cookie header is present or the cookie itself is absent. */
export function readRefreshTokenCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (header === undefined) return null;
  return parse(header)[REFRESH_TOKEN_COOKIE_NAME] ?? null;
}
