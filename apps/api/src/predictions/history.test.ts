/**
 * Integration tests against the real docker-compose Postgres (no mocked
 * Prisma Client), matching this project's standing Phase 5+ DB-testing
 * convention. Exercises the GLOBAL scope decision directly (DECISIONS.md):
 * hits/trials must aggregate across every user's scored predictions, not
 * just one user's — the opposite of `locations.test.ts`'s per-user
 * isolation contract.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { getGlobalPredictionHistory, NEUTRAL_PREDICTION_HISTORY } from './history.js';

const TEST_EMAIL_SUFFIX = '@predictions-history-test.invalid';

function loadDatabaseUrl(): string {
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

const prisma = createPrismaClient(loadDatabaseUrl());
const NOW = new Date('2026-07-22T12:00:00Z');

async function createTestUser(prefix: string): Promise<string> {
  const user = await prisma.user.create({ data: { email: `${prefix}${TEST_EMAIL_SUFFIX}` } });
  return user.id;
}

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('getGlobalPredictionHistory against real Postgres', () => {
  it('returns the neutral prior when no predictions exist at all', async () => {
    const result = await getGlobalPredictionHistory(prisma);
    expect(result).toEqual(NEUTRAL_PREDICTION_HISTORY);
  });

  it('counts only scored predictions as trials, and only scored+hit ones as hits', async () => {
    const userId = await createTestUser('single-user');
    await prisma.prediction.createMany({
      data: [
        {
          userId,
          targetTime: NOW,
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
        {
          userId,
          targetTime: NOW,
          predictedKp: 5,
          confidence: 0.6,
          scored: true,
          hit: false,
          actualKp: 8,
        },
        { userId, targetTime: NOW, predictedKp: 3, confidence: 0.6, scored: false }, // not yet elapsed/scored
      ],
    });

    const result = await getGlobalPredictionHistory(prisma);
    expect(result).toEqual({ hits: 1, trials: 2 });
  });

  it('aggregates across users — GLOBAL scope, not per-user (DECISIONS.md)', async () => {
    const userA = await createTestUser('user-a');
    const userB = await createTestUser('user-b');
    await prisma.prediction.createMany({
      data: [
        {
          userId: userA,
          targetTime: NOW,
          predictedKp: 4,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 4,
        },
        {
          userId: userB,
          targetTime: NOW,
          predictedKp: 5,
          confidence: 0.6,
          scored: true,
          hit: true,
          actualKp: 5,
        },
      ],
    });

    const result = await getGlobalPredictionHistory(prisma);
    expect(result).toEqual({ hits: 2, trials: 2 });
  });
});
