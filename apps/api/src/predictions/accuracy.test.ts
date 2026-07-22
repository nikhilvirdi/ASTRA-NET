/**
 * Integration tests against the real docker-compose Postgres (no mocked
 * Prisma Client), matching this project's standing Phase 5+ DB-testing
 * convention. Covers the exact FORMULAS.md §9 hit boundary, the daily
 * job's real read-observed/write-back cycle, its "leave stale/unmatched
 * predictions unscored rather than fabricate a match" behavior, and —
 * closing the loop end-to-end — that the resulting real hits/trials
 * actually pull `historyFactor` toward the observed rate rather than
 * sitting at an overconfident 0%/100%, proving the Beta prior
 * (FORMULAS.md §9) holds against genuinely stored data, not just in
 * isolation.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { historyFactor } from '@astranet/shared';
import { createPrismaClient } from '../db/client.js';
import type { SwpcKpObservedEntry, SwpcSlowData } from '../clients/swpc/index.js';
import { getGlobalPredictionHistory } from './history.js';
import {
  ACCURACY_JOB_INTERVAL_MS,
  isHit,
  runAccuracyJob,
  startAccuracyJobLoop,
} from './accuracy.js';

const TEST_EMAIL_SUFFIX = '@predictions-accuracy-test.invalid';

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

function observedEntry(hoursFromNow: number, kp: number): SwpcKpObservedEntry {
  return {
    timeTag: new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString(),
    kp,
    aRunning: 0,
    stationCount: 10,
  };
}

function fakeFetchSwpcSlow(
  kpObserved: SwpcKpObservedEntry[] | null,
): (now: Date) => Promise<SwpcSlowData> {
  return () =>
    Promise.resolve({
      kpObserved,
      kpForecast: null,
      solarWind: null,
      fetchedAt: NOW.toISOString(),
    });
}

describe('isHit — FORMULAS.md §9 exact boundary', () => {
  it('is a hit when predicted and actual are identical', () => {
    expect(isHit(4, 4)).toBe(true);
  });

  it('is a hit exactly at |diff| = 1, in both directions', () => {
    expect(isHit(3, 4)).toBe(true);
    expect(isHit(4, 3)).toBe(true);
  });

  it('is a miss just past the boundary, |diff| = 1.0001', () => {
    expect(isHit(3, 4.0001)).toBe(false);
  });

  it('is a hit at a fractional boundary, |diff| = 1 exactly with non-integer Kp', () => {
    expect(isHit(3.33, 4.33)).toBe(true);
  });

  it('is a miss well past the boundary', () => {
    expect(isHit(2, 6)).toBe(false);
  });
});

describe('runAccuracyJob against real Postgres', () => {
  it('returns scored: 0 and touches nothing when there are no unscored elapsed predictions', async () => {
    const fetchSwpcSlow = vi.fn(fakeFetchSwpcSlow([observedEntry(0, 4)]));
    const result = await runAccuracyJob({ prisma, fetchSwpcSlow }, NOW);

    expect(result).toEqual({ scored: 0 });
    expect(fetchSwpcSlow).not.toHaveBeenCalled();
  });

  it('scores an elapsed unscored prediction as a hit and writes actualKp/hit/scored back', async () => {
    const userId = await createTestUser('hit-case');
    const prediction = await prisma.prediction.create({
      data: { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
    });

    const result = await runAccuracyJob(
      { prisma, fetchSwpcSlow: fakeFetchSwpcSlow([observedEntry(0, 5)]) },
      NOW,
    );

    expect(result).toEqual({ scored: 1 });
    const updated = await prisma.prediction.findUniqueOrThrow({ where: { id: prediction.id } });
    expect(updated.scored).toBe(true);
    expect(updated.actualKp).toBe(5);
    expect(updated.hit).toBe(true);
  });

  it('scores an elapsed unscored prediction as a miss when actual Kp is far off', async () => {
    const userId = await createTestUser('miss-case');
    const prediction = await prisma.prediction.create({
      data: { userId, targetTime: NOW, predictedKp: 2, confidence: 0.6 },
    });

    await runAccuracyJob({ prisma, fetchSwpcSlow: fakeFetchSwpcSlow([observedEntry(0, 7)]) }, NOW);

    const updated = await prisma.prediction.findUniqueOrThrow({ where: { id: prediction.id } });
    expect(updated.scored).toBe(true);
    expect(updated.actualKp).toBe(7);
    expect(updated.hit).toBe(false);
  });

  it('leaves a not-yet-elapsed prediction untouched', async () => {
    const userId = await createTestUser('not-elapsed');
    const future = new Date(NOW.getTime() + 3_600_000);
    const prediction = await prisma.prediction.create({
      data: { userId, targetTime: future, predictedKp: 4, confidence: 0.6 },
    });

    const result = await runAccuracyJob(
      { prisma, fetchSwpcSlow: fakeFetchSwpcSlow([observedEntry(0, 4)]) },
      NOW,
    );

    expect(result).toEqual({ scored: 0 });
    const untouched = await prisma.prediction.findUniqueOrThrow({ where: { id: prediction.id } });
    expect(untouched.scored).toBe(false);
    expect(untouched.actualKp).toBeNull();
  });

  it('leaves an already-scored prediction untouched', async () => {
    const userId = await createTestUser('already-scored');
    const prediction = await prisma.prediction.create({
      data: {
        userId,
        targetTime: NOW,
        predictedKp: 4,
        confidence: 0.6,
        scored: true,
        hit: true,
        actualKp: 4,
      },
    });

    const result = await runAccuracyJob(
      { prisma, fetchSwpcSlow: fakeFetchSwpcSlow([observedEntry(0, 9)]) },
      NOW,
    );

    expect(result).toEqual({ scored: 0 });
    const untouched = await prisma.prediction.findUniqueOrThrow({ where: { id: prediction.id } });
    expect(untouched.actualKp).toBe(4); // unchanged, not overwritten with the fake 9
  });

  it('leaves a prediction unscored (never fabricates a match) when no observed entry is close enough', async () => {
    const userId = await createTestUser('too-stale');
    const prediction = await prisma.prediction.create({
      data: { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
    });
    // Nearest observed entry is 5 hours away — past MAX_OBSERVED_MATCH_AGE_MS (1.5h).
    const result = await runAccuracyJob(
      { prisma, fetchSwpcSlow: fakeFetchSwpcSlow([observedEntry(-5, 4)]) },
      NOW,
    );

    expect(result).toEqual({ scored: 0 });
    const untouched = await prisma.prediction.findUniqueOrThrow({ where: { id: prediction.id } });
    expect(untouched.scored).toBe(false);
  });

  it('returns scored: 0 without throwing when SWPC has no observed data at all', async () => {
    const userId = await createTestUser('no-observed-data');
    await prisma.prediction.create({
      data: { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
    });

    const result = await runAccuracyJob({ prisma, fetchSwpcSlow: fakeFetchSwpcSlow(null) }, NOW);
    expect(result).toEqual({ scored: 0 });
  });

  it('scores multiple elapsed predictions in one run, each against its own nearest observed entry', async () => {
    const userId = await createTestUser('batch');
    const predictionA = await prisma.prediction.create({
      data: { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
    });
    const predictionB = await prisma.prediction.create({
      data: {
        userId,
        targetTime: new Date(NOW.getTime() - 3_600_000),
        predictedKp: 6,
        confidence: 0.6,
      },
    });

    const observed = [observedEntry(0, 5), observedEntry(-1, 6)];
    const result = await runAccuracyJob(
      { prisma, fetchSwpcSlow: fakeFetchSwpcSlow(observed) },
      NOW,
    );

    expect(result).toEqual({ scored: 2 });
    const updatedA = await prisma.prediction.findUniqueOrThrow({ where: { id: predictionA.id } });
    const updatedB = await prisma.prediction.findUniqueOrThrow({ where: { id: predictionB.id } });
    expect(updatedA.actualKp).toBe(5);
    expect(updatedA.hit).toBe(true);
    expect(updatedB.actualKp).toBe(6);
    expect(updatedB.hit).toBe(true);
  });

  it('closes the loop: real scored predictions pull historyFactor toward the observed rate, never to 0% or 100%', async () => {
    const userId = await createTestUser('beta-prior');
    // 3 hits, 1 miss, all elapsed and unscored going in.
    await prisma.prediction.createMany({
      data: [
        { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
        { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
        { userId, targetTime: NOW, predictedKp: 4, confidence: 0.6 },
        { userId, targetTime: NOW, predictedKp: 8, confidence: 0.6 }, // will miss
      ],
    });

    await runAccuracyJob({ prisma, fetchSwpcSlow: fakeFetchSwpcSlow([observedEntry(0, 4)]) }, NOW);

    const history = await getGlobalPredictionHistory(prisma);
    expect(history).toEqual({ hits: 3, trials: 4 });

    // FORMULAS.md §8/§9: (hits + 2) / (trials + 4) = 5/8 = 0.625 — pulled
    // toward neutral from the naive 3/4 = 0.75, never a raw 0%/100% swing.
    expect(historyFactor(history.hits, history.trials)).toBeCloseTo(5 / 8, 10);
    expect(historyFactor(history.hits, history.trials)).not.toBeCloseTo(3 / 4, 2);
  });
});

describe('startAccuracyJobLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately, then again on each interval, and stops on demand', async () => {
    const mockJob = vi.fn<typeof runAccuracyJob>().mockResolvedValue({ scored: 0 });
    const fetchSwpcSlow = fakeFetchSwpcSlow(null);

    const stop = startAccuracyJobLoop({ prisma, fetchSwpcSlow, runAccuracyJob: mockJob });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockJob).toHaveBeenCalledTimes(1);
    // Reference (not deep) equality — `prisma` is a real PrismaClient with
    // circular internal state; a deep-equal matcher would blow the stack.
    expect(mockJob.mock.calls[0]?.[0]?.prisma).toBe(prisma);
    expect(mockJob.mock.calls[0]?.[1]).toBeInstanceOf(Date);

    await vi.advanceTimersByTimeAsync(ACCURACY_JOB_INTERVAL_MS);
    expect(mockJob).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(ACCURACY_JOB_INTERVAL_MS * 2);
    expect(mockJob).toHaveBeenCalledTimes(2);
  });

  it('does not throw out of the tick when the job rejects', async () => {
    const mockJob = vi.fn<typeof runAccuracyJob>().mockRejectedValue(new Error('job failed'));
    const fetchSwpcSlow = fakeFetchSwpcSlow(null);

    expect(() =>
      startAccuracyJobLoop({ prisma, fetchSwpcSlow, runAccuracyJob: mockJob }),
    ).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockJob).toHaveBeenCalledTimes(1);
  });
});
