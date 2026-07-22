/**
 * `requireAuth` — Express guard middleware for protected routes
 * (WORKPLAN.md Phase 5's `verifyAccessToken` guard). Not consumed by
 * any route yet: `/brief`, `/health`, and `/stream` are all explicitly
 * public, and this exists ahead of Phase 6, whose per-user routes
 * (saved locations, sky log, predictions) need it.
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
