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
import { registerAuthRoutes, type AuthRouteDeps } from './routes/auth.js';
import { registerLocationsRoutes } from './routes/locations.js';
import { registerSkyLogRoutes } from './routes/sky-log.js';
import { registerSatellitesRoute } from './routes/satellites.js';
import { registerBestSpotRoute, type BestSpotRouteDeps } from './routes/best-spot.js';
import { registerLogRoute } from './routes/log.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerAccuracyRoute } from './routes/accuracy.js';

export interface CreateAppDeps {
  n2yoApiKey: BriefRouteDeps['n2yoApiKey'];
  prisma: PrismaClient;
  jwtAccessSecret: string;
  fetchN2yoVisualPasses?: BriefRouteDeps['fetchN2yoVisualPasses'];
  googleOAuth?: AuthRouteDeps['googleOAuth'];
  exchangeGoogleAuthCode?: AuthRouteDeps['exchangeGoogleAuthCode'];
  verifyGoogleIdToken?: AuthRouteDeps['verifyGoogleIdToken'];
  fetchOpenMeteoBatch?: BestSpotRouteDeps['fetchOpenMeteoBatch'];
  bortleAt?: BestSpotRouteDeps['bortleAt'];
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  registerHealthRoute(app);
  registerStreamRoute(app);
  registerSatellitesRoute(app);
  registerBestSpotRoute(app, {
    fetchOpenMeteoBatch: deps.fetchOpenMeteoBatch,
    bortleAt: deps.bortleAt,
  });
  registerBriefRoute(app, deps);
  registerAuthRoutes(app, {
    prisma: deps.prisma,
    jwtAccessSecret: deps.jwtAccessSecret,
    googleOAuth: deps.googleOAuth,
    exchangeGoogleAuthCode: deps.exchangeGoogleAuthCode,
    verifyGoogleIdToken: deps.verifyGoogleIdToken,
  });
  registerLocationsRoutes(app, { prisma: deps.prisma, jwtAccessSecret: deps.jwtAccessSecret });
  registerSkyLogRoutes(app, { prisma: deps.prisma, jwtAccessSecret: deps.jwtAccessSecret });
  registerLogRoute(app, { prisma: deps.prisma, jwtAccessSecret: deps.jwtAccessSecret });
  registerSettingsRoutes(app, { prisma: deps.prisma, jwtAccessSecret: deps.jwtAccessSecret });
  registerAccuracyRoute(app, { prisma: deps.prisma });

  return app;
}
