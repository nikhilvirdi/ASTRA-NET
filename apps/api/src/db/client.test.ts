/**
 * Integration test against the real docker-compose Postgres — no mocked
 * Prisma Client, per WORKPLAN.md Phase 5's agent expectations. An
 * unreachable database or missing `DATABASE_URL` is a real failure here,
 * not a skip condition: from Phase 5 on, the database is part of the
 * test environment.
 *
 * The one row this test writes uses an obviously-fake email on the
 * reserved `.invalid` TLD and is deleted both before (stale-run cleanup)
 * and after the round-trip.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from './client.js';

const TEST_EMAIL = 'db-client-integration-test@example.invalid';

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
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe('shared Prisma client against real Postgres', () => {
  it('executes a raw query over a real connection', async () => {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it('sees the migrated User and Session tables', async () => {
    // count() throws if the table is missing, so a numeric result proves
    // the init migration is actually applied, not just recorded.
    await expect(prisma.user.count()).resolves.toBeTypeOf('number');
    await expect(prisma.session.count()).resolves.toBeTypeOf('number');
  });

  it('round-trips a real write: create, read back, delete', async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    const created = await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash: 'not-a-real-hash-integration-placeholder' },
    });
    expect(created.id).toBeTruthy();
    expect(created.settings).toEqual({});

    const found = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(found?.id).toBe(created.id);

    await prisma.user.delete({ where: { id: created.id } });
    await expect(prisma.user.findUnique({ where: { email: TEST_EMAIL } })).resolves.toBeNull();
  });
});
