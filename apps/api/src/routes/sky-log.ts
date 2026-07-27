/**
 * `/api/sky-log` routes (WORKPLAN.md Phase 6 — Personal Sky Log). Every
 * route requires `requireAuth` and every query/mutation is scoped to
 * `req.userId`, matching `locations.ts`'s per-user-isolation contract:
 * cross-user access to a real entry id and a nonexistent id both return
 * an identical generic 404, never a 403.
 *
 * Scope note: `SCHEMA.md`'s `source` flag distinguishes auto-logged
 * entries (a system-detected pass/aurora night the user was alerted to)
 * from manual ones, but nothing upstream of this route creates
 * auto-logged entries yet — alert wiring is Phase 10. This API only
 * ever writes `source: 'manual'`; it never accepts `source` from the
 * client, so a caller can't mislabel a manual entry as system-verified.
 *
 * Entries are immutable once logged, aside from deletion — a sky log is
 * a historical record of what a user witnessed, not an editable form.
 * No `PATCH` route is exposed for that reason (a mistaken entry is
 * deleted and re-logged, not silently rewritten).
 */

import express, { type Express, type Request, type Response } from 'express';
import { type Prisma, type PrismaClient, type SkyLogEntry } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../auth/require-auth.js';
import { SKY_LOG_EVENT_TYPES } from '../util/event-types.js';

export interface SkyLogRouteDeps {
  prisma: PrismaClient;
  jwtAccessSecret: string;
}

/**
 * Closed set matching `SCHEMA.md`'s own examples ("ISS pass, aurora
 * night, meteor shower, NEO approach…") plus `other` for anything a
 * user wants to log manually that doesn't fit those categories.
 *
 * Shared with Phase 10's alert preferences via `util/event-types.ts` —
 * the alertable subset is the same four real events, so both features
 * name them identically rather than maintaining parallel vocabularies.
 */
const EventTypeSchema = z.enum(SKY_LOG_EVENT_TYPES);

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

const CreateSkyLogBodySchema = z.object({
  eventType: EventTypeSchema,
  timestamp: z.coerce.date(),
  details: z.record(z.string(), z.unknown()).optional().default({}),
});

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).optional().default(DEFAULT_LIST_LIMIT),
});

function logUnexpectedSkyLogError(routeLabel: string, error: unknown): void {
  console.error(
    `[sky-log] ${routeLabel} failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
  );
}

/** Fetches an entry and confirms it belongs to `userId`; null for "not found or not yours" alike. */
async function findOwnedEntry(
  prisma: PrismaClient,
  entryId: string,
  userId: string,
): Promise<SkyLogEntry | null> {
  const entry = await prisma.skyLogEntry.findUnique({ where: { id: entryId } });
  if (entry === null || entry.userId !== userId) return null;
  return entry;
}

export function registerSkyLogRoutes(app: Express, deps: SkyLogRouteDeps): void {
  const { prisma, jwtAccessSecret } = deps;
  const auth = requireAuth({ jwtAccessSecret });

  app.get('/api/sky-log', auth, async (req: Request, res: Response) => {
    const userId = req.userId as string;
    const parsedQuery = ListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      res.status(400).json({ error: 'limit must be a number between 1 and 500' });
      return;
    }
    try {
      const entries = await prisma.skyLogEntry.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: parsedQuery.data.limit,
      });
      res.status(200).json(entries);
    } catch (error) {
      logUnexpectedSkyLogError('list', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  app.get('/api/sky-log/:id', auth, async (req: Request, res: Response) => {
    const userId = req.userId as string;
    try {
      const entry = await findOwnedEntry(prisma, req.params.id as string, userId);
      if (entry === null) {
        res.status(404).json({ error: 'sky log entry not found' });
        return;
      }
      res.status(200).json(entry);
    } catch (error) {
      logUnexpectedSkyLogError('get', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  app.post('/api/sky-log', auth, express.json(), async (req: Request, res: Response) => {
    const userId = req.userId as string;
    const parsed = CreateSkyLogBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'eventType and timestamp are required and must be valid' });
      return;
    }
    try {
      const { details, ...rest } = parsed.data;
      const entry = await prisma.skyLogEntry.create({
        data: { userId, ...rest, details: details as Prisma.InputJsonValue, source: 'manual' },
      });
      res.status(201).json(entry);
    } catch (error) {
      logUnexpectedSkyLogError('create', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  app.delete('/api/sky-log/:id', auth, async (req: Request, res: Response) => {
    const userId = req.userId as string;
    const entryId = req.params.id as string;
    try {
      const existing = await findOwnedEntry(prisma, entryId, userId);
      if (existing === null) {
        res.status(404).json({ error: 'sky log entry not found' });
        return;
      }
      await prisma.skyLogEntry.delete({ where: { id: entryId } });
      res.status(204).send();
    } catch (error) {
      logUnexpectedSkyLogError('delete', error);
      res.status(500).json({ error: 'internal error' });
    }
  });
}
