/**
 * Express app factory (ARCHITECTURE.md §2: Node.js + Express is the locked
 * backend framework). Kept separate from `index.ts` so the app itself is
 * importable/testable (e.g. via supertest) without also starting the poller
 * loops or binding a real port.
 */

import express, { type Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { registerHealthRoute } from './routes/health.js';
import { registerStreamRoute } from './routes/stream.js';
import { registerBriefRoute, type BriefRouteDeps } from './routes/brief.js';
import { registerSatellitesRoute } from './routes/satellites.js';

export interface CreateAppDeps {
  n2yoApiKey: BriefRouteDeps['n2yoApiKey'];
  prisma: PrismaClient;
  fetchN2yoVisualPasses?: BriefRouteDeps['fetchN2yoVisualPasses'];
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  registerHealthRoute(app);
  registerStreamRoute(app);
  registerSatellitesRoute(app);
  registerBriefRoute(app, deps);

  return app;
}
