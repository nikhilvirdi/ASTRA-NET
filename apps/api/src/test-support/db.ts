/**
 * Shared test-only helper for the DB-backed route tests, resolving
 * `DATABASE_URL` from the repo-root `.env` regardless of the test file's cwd.
 */

import { fileURLToPath } from 'node:url';

export function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
    } catch {
      // No .env — the explicit check below produces the real error.
    }
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set and no repo-root .env was found — start the docker compose Postgres and set it before running these tests.',
    );
  }
  return url;
}
