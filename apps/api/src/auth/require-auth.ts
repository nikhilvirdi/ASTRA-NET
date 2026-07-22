/**
 * `requireAuth` — Express guard middleware for protected routes
 * (WORKPLAN.md Phase 5's `verifyAccessToken` guard). `/health` and
 * `/stream` are explicitly public with no auth story at all; `/brief`
 * stays public too but has an optional-auth story now (`tryAuthenticate`
 * below) — Phase 6's other per-user routes (saved locations, sky log)
 * use the strict `requireAuth` guard.
 *
 * Validates the access token from the `Authorization: Bearer <token>`
 * header via the already-tested `verifyAccessToken` (`./jwt.js`) and
 * attaches the authenticated user's id to `req.userId` for downstream
 * handlers — never a DB lookup here, since the access token's whole
 * point (ARCHITECTURE.md §3 G) is to authenticate without a per-request
 * database hit.
 */

import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth` once the access token has been verified. */
      userId?: string;
    }
  }
}

export interface RequireAuthDeps {
  jwtAccessSecret: string;
}

const BEARER_PREFIX = 'Bearer ';

export function requireAuth(deps: RequireAuthDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.get('authorization');
    if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ error: 'missing or malformed Authorization header' });
      return;
    }
    const token = header.slice(BEARER_PREFIX.length);

    const payload = await verifyAccessToken(token, deps.jwtAccessSecret, new Date());
    if (payload === null) {
      res.status(401).json({ error: 'invalid or expired access token' });
      return;
    }

    req.userId = payload.userId;
    next();
  };
}

/**
 * Optional-auth variant for routes that serve both anonymous and
 * authenticated callers (`/api/brief` — genuinely public, Phase 6 adds
 * per-user prediction persistence as a bonus for logged-in requesters
 * only). A missing header, a malformed header, and an invalid/expired
 * token are all treated identically as "anonymous" (`null`) — never a
 * 401. Only a token that actually verifies unlocks the authenticated
 * behavior.
 */
export async function tryAuthenticate(req: Request, deps: RequireAuthDeps): Promise<string | null> {
  const header = req.get('authorization');
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length);

  const payload = await verifyAccessToken(token, deps.jwtAccessSecret, new Date());
  return payload?.userId ?? null;
}
