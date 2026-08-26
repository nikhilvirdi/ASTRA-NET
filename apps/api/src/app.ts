/**
 * Express app factory (ARCHITECTURE.md §2: Node.js + Express is the locked
 * backend framework). Kept separate from `index.ts` so the app itself is
 * importable/testable (e.g. via supertest) without also starting the poller
 * loops or binding a real port.
 */

import express, { type Express } from 'express';
import cors from 'cors';
import type { PrismaClient } from '@prisma/client';
import { registerHealthRoute } from './routes/health.js';
import { registerStreamRoute } from './routes/stream.js';
import { registerBriefRoute, type BriefRouteDeps } from './routes/brief.js';
import { registerSatellitesRoute } from './routes/satellites.js';

/**
 * Vite's dev-server origin (`apps/web/vite.config.ts`). In production this
 * is never reachable (a different domain entirely), so it only ever widens
 * the allowlist during local development.
 */
const DEV_WEB_ORIGIN = 'http://localhost:5173';

export interface CreateAppDeps {
  n2yoApiKey: BriefRouteDeps['n2yoApiKey'];
  prisma: PrismaClient;
  fetchN2yoVisualPasses?: BriefRouteDeps['fetchN2yoVisualPasses'];
  /**
   * The deployed frontend's real origin (ARCHITECTURE.md §9: Cloudflare
   * Pages, a different domain from this API's own VPS in production) —
   * the CORS allowlist's production entry. Optional here (defaulting to
   * the dev-server origin) purely so existing tests that don't care about
   * CORS can keep constructing `createApp({...})` without it; the real
   * composition root (`index.ts`) always passes the actual `WEB_ORIGIN`
   * env var, fetched via `requireEnv` so a missing value fails loudly at
   * boot rather than silently falling back to this default.
   */
  webOrigin?: string;
  /** Defaults to `process.env.NODE_ENV` — injectable so tests can exercise the production branch without mutating global env state. */
  nodeEnv?: string;
}

/**
 * The CORS allowlist: the real frontend origin, always; the local Vite dev
 * server, only outside production. Never a wildcard (`*`) — a request from
 * any other origin gets no `Access-Control-Allow-Origin` header at all and
 * the browser blocks it, exactly as it should for a private API with no
 * account system and nothing to protect from a same-origin-only public
 * frontend other than being called from an unrelated page.
 */
export function buildCorsAllowedOrigins(webOrigin: string, nodeEnv: string | undefined): string[] {
  const origins = new Set([webOrigin]);
  if (nodeEnv !== 'production') {
    origins.add(DEV_WEB_ORIGIN);
  }
  return [...origins];
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  const allowedOrigins = buildCorsAllowedOrigins(
    deps.webOrigin ?? DEV_WEB_ORIGIN,
    deps.nodeEnv ?? process.env.NODE_ENV,
  );
  app.use(cors({ origin: allowedOrigins }));

  registerHealthRoute(app);
  registerStreamRoute(app);
  registerSatellitesRoute(app);
  registerBriefRoute(app, deps);

  return app;
}
