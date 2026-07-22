/**
 * Integration tests against the real docker-compose Postgres (no mocked
 * Prisma Client), per this project's standing Phase 5+ DB-testing
 * convention. Cache has no per-user scope (SCHEMA.md: standalone), so
 * unlike locations/sky-log there is no cross-user isolation to test here
 * — instead this exercises the actual TTL/expiry/cleanup behavior:
 * a fresh entry is retrievable, an expired entry is a miss (never
 * returned stale), cleanup-on-read actually removes the expired row,
 * and the periodic sweep catches what cleanup-on-read didn't.
 *
 * All test keys are prefixed so cleanup can target only this file's rows.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import {
  CACHE_SWEEP_INTERVAL_MS,
  getCached,
  setCached,
  startCacheSweepLoop,
  sweepExpiredCache,
} from './store.js';

const KEY_PREFIX = 'cache-store-test:';

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

async function cleanup(): Promise<void> {
  await prisma.cache.deleteMany({ where: { key: { startsWith: KEY_PREFIX } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('cache/store against real Postgres', () => {
  it('returns null for a key that was never set', async () => {
    const result = await getCached(prisma, `${KEY_PREFIX}never-set`, new Date());
    expect(result).toBeNull();
  });

  it('a fresh entry is retrievable', async () => {
    const key = `${KEY_PREFIX}fresh`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);

    await setCached(prisma, key, { speed: 402, kp: 3 }, expiresAt);
    const result = await getCached<{ speed: number; kp: number }>(prisma, key, now);

    expect(result).toEqual({ speed: 402, kp: 3 });
  });

  it('an expired entry is treated as a miss, never returned stale', async () => {
    const key = `${KEY_PREFIX}expired`;
    const expiresAt = new Date('2026-01-01T00:01:00Z');
    const readAt = new Date('2026-01-01T00:02:00Z'); // after expiresAt

    await setCached(prisma, key, { stale: true }, expiresAt);
    const result = await getCached(prisma, key, readAt);

    expect(result).toBeNull();
  });

  it('cleanup-on-read actually removes the expired row', async () => {
    const key = `${KEY_PREFIX}cleanup-on-read`;
    const expiresAt = new Date('2026-01-01T00:01:00Z');
    const readAt = new Date('2026-01-01T00:02:00Z');

    await setCached(prisma, key, { stale: true }, expiresAt);
    await getCached(prisma, key, readAt);

    const row = await prisma.cache.findUnique({ where: { key } });
    expect(row).toBeNull();
  });

  it('an entry exactly at its expiry instant is treated as expired', async () => {
    const key = `${KEY_PREFIX}boundary`;
    const expiresAt = new Date('2026-01-01T00:01:00Z');

    await setCached(prisma, key, { boundary: true }, expiresAt);
    const result = await getCached(prisma, key, expiresAt);

    expect(result).toBeNull();
  });

  it('setCached upserts: a second write overwrites value and expiry', async () => {
    const key = `${KEY_PREFIX}upsert`;
    const now = new Date();

    await setCached(prisma, key, { version: 1 }, new Date(now.getTime() + 60_000));
    await setCached(prisma, key, { version: 2 }, new Date(now.getTime() + 120_000));

    const result = await getCached<{ version: number }>(prisma, key, now);
    expect(result).toEqual({ version: 2 });

    const rows = await prisma.cache.findMany({ where: { key } });
    expect(rows).toHaveLength(1);
  });

  it('sweepExpiredCache deletes expired rows and leaves live ones', async () => {
    const now = new Date('2026-01-01T00:02:00Z');
    const expiredKeyA = `${KEY_PREFIX}sweep-expired-a`;
    const expiredKeyB = `${KEY_PREFIX}sweep-expired-b`;
    const liveKey = `${KEY_PREFIX}sweep-live`;

    await setCached(prisma, expiredKeyA, { n: 1 }, new Date('2026-01-01T00:01:00Z'));
    await setCached(prisma, expiredKeyB, { n: 2 }, new Date('2026-01-01T00:01:59Z'));
    await setCached(prisma, liveKey, { n: 3 }, new Date('2026-01-01T00:10:00Z'));

    const deletedCount = await sweepExpiredCache(prisma, now);

    expect(deletedCount).toBe(2);
    await expect(prisma.cache.findUnique({ where: { key: expiredKeyA } })).resolves.toBeNull();
    await expect(prisma.cache.findUnique({ where: { key: expiredKeyB } })).resolves.toBeNull();
    await expect(prisma.cache.findUnique({ where: { key: liveKey } })).resolves.not.toBeNull();
  });

  it('sweepExpiredCache catches what cleanup-on-read did not (never-read expired rows)', async () => {
    const key = `${KEY_PREFIX}sweep-catches-unread`;
    const now = new Date('2026-01-01T00:02:00Z');

    // Written and expired, but never read via getCached — cleanup-on-read
    // alone would never touch this row.
    await setCached(prisma, key, { unread: true }, new Date('2026-01-01T00:01:00Z'));

    const row = await prisma.cache.findUnique({ where: { key } });
    expect(row).not.toBeNull();

    await sweepExpiredCache(prisma, now);

    await expect(prisma.cache.findUnique({ where: { key } })).resolves.toBeNull();
  });

  it('sweepExpiredCache returns 0 when nothing is expired', async () => {
    const key = `${KEY_PREFIX}sweep-none-expired`;
    const now = new Date();
    await setCached(prisma, key, { n: 1 }, new Date(now.getTime() + 60_000));

    const deletedCount = await sweepExpiredCache(prisma, now);
    expect(deletedCount).toBe(0);
  });
});

describe('startCacheSweepLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately, then again on each interval, and stops on demand', async () => {
    const mockSweep = vi.fn().mockResolvedValue(0);

    const stop = startCacheSweepLoop({ prisma, sweepExpiredCache: mockSweep });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockSweep).toHaveBeenCalledTimes(1);
    // Reference (not deep) equality on `prisma` — it's a real PrismaClient
    // with circular internal state, so a deep-equal matcher would recurse
    // into it and blow the stack.
    expect(mockSweep.mock.calls[0]?.[0]).toBe(prisma);
    expect(mockSweep.mock.calls[0]?.[1]).toBeInstanceOf(Date);

    await vi.advanceTimersByTimeAsync(CACHE_SWEEP_INTERVAL_MS);
    expect(mockSweep).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(CACHE_SWEEP_INTERVAL_MS * 2);
    expect(mockSweep).toHaveBeenCalledTimes(2);
  });

  it('does not throw out of the tick when the sweep rejects', async () => {
    const mockSweep = vi.fn().mockRejectedValue(new Error('sweep failed'));

    expect(() => startCacheSweepLoop({ prisma, sweepExpiredCache: mockSweep })).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockSweep).toHaveBeenCalledTimes(1);
  });
});
