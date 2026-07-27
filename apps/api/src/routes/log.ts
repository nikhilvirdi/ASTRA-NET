/**
 * `GET /api/log` (WORKPLAN.md Phase 10, DESIGN_SPEC.md §13).
 *
 * The read-only *page* view over the Sky Log: timeline plus the header
 * stats. `/api/sky-log` (Phase 6) remains the CRUD resource for creating
 * and deleting individual entries — this route adds no write path and
 * duplicates none of it, it only composes what §13's page renders in one
 * round trip, the same way `/api/brief` composes cards.
 *
 * Auth required: ARCHITECTURE.md §8's route table marks `/log` "required",
 * and every query is scoped to `req.userId` per SCHEMA.md's per-user
 * isolation contract.
 */

import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { buildLog } from '../log/build-log.js';
import { LogPayloadSchema } from '../log/log.schemas.js';
import { requireAuth } from '../auth/require-auth.js';

export interface LogRouteDeps {
  prisma: PrismaClient;
  jwtAccessSecret: string;
}

export function registerLogRoute(app: Express, deps: LogRouteDeps): void {
  const { prisma, jwtAccessSecret } = deps;
  const auth = requireAuth({ jwtAccessSecret });

  app.get('/api/log', auth, async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId as string;
    try {
      // The whole history, not a page: the streak and nights-observed
      // stats are only correct over the complete set, and §13's timeline
      // is a personal record rather than an unbounded feed.
      const entries = await prisma.skyLogEntry.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
      });

      const payload = buildLog(entries, new Date());

      const validated = LogPayloadSchema.safeParse(payload);
      if (!validated.success) {
        console.error('[log] response failed its own schema:', validated.error.issues);
        res.status(500).json({ error: 'log payload failed validation' });
        return;
      }

      res.status(200).json(payload);
    } catch (error) {
      console.error(
        `[log] list failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
      res.status(500).json({ error: 'internal error' });
    }
  });
}
