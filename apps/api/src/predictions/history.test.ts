/**
 * Integration tests against the real docker-compose Postgres (no mocked
 * Prisma Client), matching this project's standing Phase 5+ DB-testing
 * convention. Exercises the GLOBAL scope decision directly (DECISIONS.md):
 * hits/trials aggregate across every scored prediction with no ownership
 * filter at all — there is no account system, so "global" is simply the
 * whole table.
 */

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { getGlobalPredictionHistory, NEUTRAL_PREDICTION_HISTORY } from './history.js';

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

/** Every prediction this file writes is tracked here, so cleanup is exact. */
const createdIds: string[] = [];

async function createTestPrediction(data: {
  predictedKp: number;
  confidence: number;
  scored: boolean;
  hit?: boolean;
  actualKp?: number;
}): Promise<void> {
  const prediction = await prisma.prediction.create({
    data: { targetTime: NOW, cmeActivityId: randomUUID(), ...data },
  });
  createdIds.push(prediction.id);
}

async function cleanup(): Promise<void> {
  if (createdIds.length > 0) {
    await prisma.prediction.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
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
    await createTestPrediction({
      predictedKp: 4,
      confidence: 0.6,
      scored: true,
      hit: true,
      actualKp: 4,
    });
    await createTestPrediction({
      predictedKp: 5,
      confidence: 0.6,
      scored: true,
      hit: false,
      actualKp: 8,
    });
    await createTestPrediction({ predictedKp: 3, confidence: 0.6, scored: false }); // not yet elapsed/scored

    const result = await getGlobalPredictionHistory(prisma);
    expect(result).toEqual({ hits: 1, trials: 2 });
  });

  it('aggregates every scored prediction — GLOBAL scope, no ownership filter (DECISIONS.md)', async () => {
    await createTestPrediction({
      predictedKp: 4,
      confidence: 0.6,
      scored: true,
      hit: true,
      actualKp: 4,
    });
    await createTestPrediction({
      predictedKp: 5,
      confidence: 0.6,
      scored: true,
      hit: true,
      actualKp: 5,
    });

    const result = await getGlobalPredictionHistory(prisma);
    expect(result).toEqual({ hits: 2, trials: 2 });
  });
});
