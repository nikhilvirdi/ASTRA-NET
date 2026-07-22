/**
 * Cache table access (SCHEMA.md's Cache model, ARCHITECTURE.md §3.B): a
 * standalone Postgres-backed TTL store for upstream API payloads — the
 * "no Redis" decision. No per-user scope (SCHEMA.md: standalone), so
 * unlike locations/sky-log there is no userId isolation here.
 *
 * Plain get/set/sweep functions over an injected PrismaClient — the same
 * "small, testable interface other code calls, not routes" shape as
 * `poller/store.ts`, except this one is DB-backed rather than in-memory,
 * so a PrismaClient is a parameter rather than a hidden module import
 * (same injected-dependency discipline as `db/client.ts`). Nothing
 * user-facing consumes this directly yet — it exists for other server
 * code (e.g. slow-tier payload caching) to call.
 *
 * Expiry is cleaned two ways, both required by SCHEMA.md: on read (a
 * stale row is deleted the moment it's found, never returned) and via a
 * periodic sweep (`sweepExpiredCache`) for rows nobody ever reads again.
 */

import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Reads a cache entry. A missing key or an expired one (`expiresAt <=
 * now`) is a miss — an expired row is deleted before returning `null`,
 * so a stale value is never handed back and never lingers past its first
 * read.
 */
export async function getCached<T>(
  prisma: PrismaClient,
  key: string,
  now: Date,
): Promise<T | null> {
  const row = await prisma.cache.findUnique({ where: { key } });
  if (row === null) {
    return null;
  }

  if (row.expiresAt <= now) {
    await prisma.cache.delete({ where: { key } }).catch(() => {
      // Already gone (e.g. the periodic sweep raced this same row) — a
      // miss either way, nothing further to do.
    });
    return null;
  }

  return row.value as T;
}

/** Writes (or overwrites) a cache entry with its expiry. */
export async function setCached<T>(
  prisma: PrismaClient,
  key: string,
  value: T,
  expiresAt: Date,
): Promise<void> {
  const jsonValue = value as Prisma.InputJsonValue;
  await prisma.cache.upsert({
    where: { key },
    create: { key, value: jsonValue, expiresAt },
    update: { value: jsonValue, expiresAt },
  });
}

/**
 * Deletes every row whose `expiresAt` has passed, regardless of whether
 * it's ever read again. Returns the number of rows removed, for the
 * sweep loop's own logging and for direct testing.
 */
export async function sweepExpiredCache(prisma: PrismaClient, now: Date): Promise<number> {
  const result = await prisma.cache.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}

/** No doc pins a sweep cadence — see DECISIONS.md. */
export const CACHE_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

export interface CacheSweepDeps {
  prisma: PrismaClient;
  /** Injected rather than called directly, same shape as `FastTierClients`/`SlowTierClients` — lets tests exercise the loop's tick/interval/stop wiring against a fast mock instead of racing a real DB round-trip under fake timers. */
  sweepExpiredCache: typeof sweepExpiredCache;
}

/**
 * Starts the periodic sweep: an immediate pass (so long-stale rows from
 * a previous run don't wait a full interval), then one every
 * `CACHE_SWEEP_INTERVAL_MS`. Returns a stop function that clears the
 * interval — same shape as `startFastTierLoop`/`startSlowTierLoop`.
 */
export function startCacheSweepLoop(deps: CacheSweepDeps): () => void {
  const tick = (): void => {
    void deps.sweepExpiredCache(deps.prisma, new Date()).catch((err: unknown) => {
      console.error('[cache/store] sweep failed unexpectedly:', err);
    });
  };

  tick();
  const timer = setInterval(tick, CACHE_SWEEP_INTERVAL_MS);

  return () => clearInterval(timer);
}
