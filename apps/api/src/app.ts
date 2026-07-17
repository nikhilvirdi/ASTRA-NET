/**
 * Express app factory (ARCHITECTURE.md §2: Node.js + Express is the locked
 * backend framework). Kept separate from `index.ts` so the app itself is
 * importable/testable (e.g. via supertest) without also starting the poller
 * loops or binding a real port.
 */

import express, { type Express } from 'express';
import { registerHealthRoute } from './routes/health.js';
import { registerStreamRoute } from './routes/stream.js';

export function createApp(): Express {
  const app = express();

  registerHealthRoute(app);
  registerStreamRoute(app);

  return app;
}
