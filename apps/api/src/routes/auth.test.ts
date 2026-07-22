/**
 * Signup-route integration tests against the real docker-compose
 * Postgres — no mocked Prisma Client, per WORKPLAN.md Phase 5's agent
 * expectations. Every credential below is obviously fake (reserved
 * `.invalid` TLD, placeholder passphrases); rows this file creates are
 * scoped to the `@signup-test.invalid` suffix and deleted before and
 * after the run.
 */

import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { verifyPassword } from '../auth/password.js';
import { registerAuthRoutes } from './auth.js';

const TEST_EMAIL_SUFFIX = '@signup-test.invalid';
const FAKE_PASSWORD = 'correct-horse-battery-staple';

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

function createTestApp(): express.Express {
  const app = express();
  registerAuthRoutes(app, { prisma });
  return app;
}

async function deleteTestUsers(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

beforeAll(deleteTestUsers);
afterAll(async () => {
  await deleteTestUsers();
  await prisma.$disconnect();
});

describe('POST /api/auth/signup', () => {
  it('creates a user, returns 201 with id+email, and stores an Argon2 hash — never the password', async () => {
    const email = `basic${TEST_EMAIL_SUFFIX}`;
    const res = await request(createTestApp())
      .post('/api/auth/signup')
      .send({ email, password: FAKE_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body as Record<string, unknown>).toEqual({
      id: expect.any(String) as unknown,
      email,
    });
    // The raw password and the hash must appear nowhere in the response.
    expect(res.text).not.toContain(FAKE_PASSWORD);
    expect(res.text).not.toContain('argon2');

    const row = await prisma.user.findUnique({ where: { email } });
    expect(row).not.toBeNull();
    expect(row?.passwordHash).toMatch(/^\$argon2/);
    expect(row?.passwordHash).not.toContain(FAKE_PASSWORD);
    await expect(verifyPassword(row?.passwordHash ?? '', FAKE_PASSWORD)).resolves.toBe(true);
  });

  it('lowercases the email so uniqueness is case-insensitive', async () => {
    const res = await request(createTestApp())
      .post('/api/auth/signup')
      .send({ email: `Mixed.Case${TEST_EMAIL_SUFFIX.toUpperCase()}`, password: FAKE_PASSWORD });

    expect(res.status).toBe(201);
    expect((res.body as { email: string }).email).toBe(`mixed.case${TEST_EMAIL_SUFFIX}`);
    await expect(
      prisma.user.findUnique({ where: { email: `mixed.case${TEST_EMAIL_SUFFIX}` } }),
    ).resolves.not.toBeNull();
  });

  it('returns 409 for a duplicate email, including a differently-cased duplicate', async () => {
    const email = `duplicate${TEST_EMAIL_SUFFIX}`;
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send({ email, password: FAKE_PASSWORD });

    const exact = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'another-fake-passphrase' });
    expect(exact.status).toBe(409);

    const recased = await request(app)
      .post('/api/auth/signup')
      .send({ email: `DUPLICATE${TEST_EMAIL_SUFFIX}`, password: 'another-fake-passphrase' });
    expect(recased.status).toBe(409);

    await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it.each([
    ['malformed email', { email: 'not-an-email', password: FAKE_PASSWORD }],
    [
      'password below the 8-char floor',
      { email: `short${TEST_EMAIL_SUFFIX}`, password: 'seven77' },
    ],
    [
      'password above the 128-char ceiling',
      { email: `long${TEST_EMAIL_SUFFIX}`, password: 'x'.repeat(129) },
    ],
    ['missing password', { email: `nopass${TEST_EMAIL_SUFFIX}` }],
    ['missing email', { password: FAKE_PASSWORD }],
    ['non-object body', 'just-a-string'],
  ])('rejects %s with 400 and creates no row', async (_label, body) => {
    const res = await request(createTestApp()).post('/api/auth/signup').send(body);

    expect(res.status).toBe(400);
    expect((res.body as { error: unknown }).error).toBeTypeOf('string');
    // A rejected password must never be echoed back.
    expect(res.text).not.toContain(FAKE_PASSWORD);
    expect(res.text).not.toContain('seven77');
  });

  it('created no rows for any rejected body', async () => {
    for (const email of [
      `short${TEST_EMAIL_SUFFIX}`,
      `long${TEST_EMAIL_SUFFIX}`,
      `nopass${TEST_EMAIL_SUFFIX}`,
    ]) {
      await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
    }
  });
});
