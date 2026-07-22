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
import { startCacheSweepLoop, sweepExpiredCache } from './cache/store.js';
import { runAccuracyJob, startAccuracyJobLoop } from './predictions/accuracy.js';
import { fetchN2yoPositions } from './clients/n2yo/index.js';
import { fetchSwpcFast, fetchSwpcSlow } from './clients/swpc/index.js';
import { fetchNasaDonki, fetchNasaNeows } from './clients/nasa/index.js';
import { fetchHorizons } from './clients/jpl-horizons/index.js';
import type { GoogleOAuthConfig } from './routes/auth.js';

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
const jwtAccessSecret = requireEnv('JWT_ACCESS_SECRET');
const port = Number(process.env.PORT ?? 3000);

/**
 * Google OAuth is additive, never a prerequisite (ARCHITECTURE.md §3 G)
 * — read optionally, not via `requireEnv`, so the app still boots (and
 * every other auth route still works) with no Google app registered
 * yet. Only enabled once every piece it needs is present.
 */
function readGoogleOAuthConfig(): GoogleOAuthConfig | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const webOrigin = process.env.WEB_ORIGIN;
  if (
    clientId === undefined ||
    clientId === '' ||
    clientSecret === undefined ||
    clientSecret === '' ||
    redirectUri === undefined ||
    redirectUri === '' ||
    webOrigin === undefined ||
    webOrigin === ''
  ) {
    console.warn(
      '[auth] Google OAuth is disabled — GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI/WEB_ORIGIN not all set',
    );
    return undefined;
  }
  return { clientId, clientSecret, redirectUri, webOrigin };
}

const googleOAuth = readGoogleOAuthConfig();

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
startCacheSweepLoop({ prisma, sweepExpiredCache });
startAccuracyJobLoop({ prisma, fetchSwpcSlow, runAccuracyJob });

const app = createApp({ n2yoApiKey, prisma, jwtAccessSecret, googleOAuth });
app.listen(port, () => {
  console.warn(`[api] listening on port ${port}`);
});
