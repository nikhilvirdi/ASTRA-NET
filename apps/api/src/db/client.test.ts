/**
 * Integration test against the real docker-compose Postgres — no mocked
 * Prisma Client, per WORKPLAN.md Phase 5's agent expectations. An
 * unreachable database or missing `DATABASE_URL` is a real failure here,
 * not a skip condition: from Phase 5 on, the database is part of the
 * test environment.
 *
 * The one row this test writes uses an obviously-fake cache key and is
 * deleted both before (stale-run cleanup) and after the round-trip.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from './client.js';

const TEST_KEY = 'db-client-integration-test.invalid';

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    // Vitest doesn't load the repo-root .env on its own; resolve it
    // relative to this file so the test works regardless of cwd.
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
    } catch {
      // No .env — the explicit check below produces the real error.
    }
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set and no repo-root .env was found — start the docker compose Postgres and set it before running Phase 5+ tests.',
    );
  }
  return url;
}

const prisma = createPrismaClient(loadDatabaseUrl());

afterAll(async () => {
  await prisma.cache.deleteMany({ where: { key: TEST_KEY } });
  await prisma.$disconnect();
});

describe('shared Prisma client against real Postgres', () => {
  it('executes a raw query over a real connection', async () => {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it('sees the migrated Prediction and Cache tables', async () => {
    // count() throws if the table is missing, so a numeric result proves
    // the migration is actually applied, not just recorded.
    await expect(prisma.prediction.count()).resolves.toBeTypeOf('number');
    await expect(prisma.cache.count()).resolves.toBeTypeOf('number');
  });

  it('round-trips a real write: create, read back, delete', async () => {
    await prisma.cache.deleteMany({ where: { key: TEST_KEY } });

    const created = await prisma.cache.create({
      data: {
        key: TEST_KEY,
        value: { placeholder: true },
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(created.key).toBe(TEST_KEY);
    expect(created.value).toEqual({ placeholder: true });

    const found = await prisma.cache.findUnique({ where: { key: TEST_KEY } });
    expect(found?.key).toBe(TEST_KEY);

    await prisma.cache.delete({ where: { key: created.key } });
    await expect(prisma.cache.findUnique({ where: { key: TEST_KEY } })).resolves.toBeNull();
  });
});
