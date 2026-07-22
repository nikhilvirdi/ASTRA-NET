/**
 * Shared Prisma Client factory (Phase 5, ARCHITECTURE.md §2's locked
 * Postgres + Prisma choice). The single module every DB-touching piece
 * imports — routes never instantiate `PrismaClient` ad hoc; they receive
 * an instance via dependency injection (the same shape as
 * `BriefRouteDeps`), and the composition root (`index.ts`) owns the one
 * real instance and its lifecycle.
 *
 * A factory rather than a module-level singleton (contrast
 * `poller/store.ts`): a Prisma Client owns a connection pool with a real
 * lifecycle (`$connect`/`$disconnect`), and integration tests need to
 * create and tear down their own instance rather than share hidden
 * module state across test files.
 *
 * `databaseUrl` is an explicit parameter, not an env read inside this
 * module — the same "inject the dependency, don't reach for a hidden
 * global" discipline as the engines' injected `now` (WORKPLAN.md rule
 * #4). Only `index.ts` reads `DATABASE_URL` from the environment.
 */

import { PrismaClient } from '@prisma/client';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}
