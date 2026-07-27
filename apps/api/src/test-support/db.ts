/**
 * Shared test-only helper for the DB-backed route tests.
 *
 * `auth.test.ts`, `locations.test.ts`, `sky-log.test.ts` and
 * `brief.test.ts` each carry their own copy of this loader. Rather than
 * add four more copies for Phase 10, the new tests share one — the
 * existing copies are left alone, since refactoring passing tests was not
 * this task's scope.
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
