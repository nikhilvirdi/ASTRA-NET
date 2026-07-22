/**
 * Composition root (ARCHITECTURE.md §2/§4): starts both poller loops with
 * the real Phase-1 clients and real API keys, then serves the Express app.
 * Everything wired here is otherwise unit-tested in isolation — this file
 * is deliberately thin, no branching logic of its own beyond reading env
 * vars and failing fast if a required one is missing.
 */

import { createApp } from './app.js';
import { createPrismaClient } from './db/client.js';
import { startFastTierLoop } from './poller/fast-tier.js';
import { startSlowTierLoop } from './poller/slow-tier.js';
import { fetchN2yoPositions } from './clients/n2yo/index.js';
import { fetchSwpcFast, fetchSwpcSlow } from './clients/swpc/index.js';
import { fetchNasaDonki, fetchNasaNeows } from './clients/nasa/index.js';
import { fetchHorizons } from './clients/jpl-horizons/index.js';

/**
 * `.env` is loaded on a best-effort basis: local dev relies on it, but
 * production (the always-on VPS, ARCHITECTURE.md §3.D) injects env vars
 * directly, so a missing file here is not an error.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file found relative to cwd — fine when env vars are injected directly.
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nasaApiKey = requireEnv('NASA_API_KEY');
const n2yoApiKey = requireEnv('N2YO_API_KEY');
const databaseUrl = requireEnv('DATABASE_URL');
const port = Number(process.env.PORT ?? 3000);

/**
 * Fail fast, before any poller or the HTTP listener starts: Prisma
 * otherwise connects lazily on first query, which would boot an app
 * whose every DB-backed route 500s. The error message is logged without
 * the connection string (it contains credentials).
 */
const prisma = createPrismaClient(databaseUrl);
try {
  await prisma.$connect();
} catch (error) {
  console.error('[api] cannot connect to Postgres — is the docker compose service running?');
  console.error(`[api] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

startFastTierLoop({ fetchN2yoPositions, fetchSwpcFast, n2yoApiKey });
startSlowTierLoop({ fetchNasaDonki, fetchNasaNeows, fetchHorizons, fetchSwpcSlow, nasaApiKey });

const app = createApp({ n2yoApiKey, prisma });
app.listen(port, () => {
  console.warn(`[api] listening on port ${port}`);
});
