/**
 * `GET /api/accuracy` (WORKPLAN.md Phase 10, DESIGN_SPEC.md §14).
 *
 * **Public** — confirmed against two locked docs, not assumed:
 * ARCHITECTURE.md §8's route table lists `/accuracy` as `public`, and
 * DESIGN_SPEC.md §14 opens with "Public. The most important screen for
 * trust". No auth guard, and correspondingly no user-identifying field in
 * the response.
 *
 * **This route accepts no query parameters at all.** DESIGN_SPEC.md §14:
 * "No cherry-picking controls. No date-range selector that lets the page
 * show only its best week. The default and only view is the full record.
 * That constraint _is_ the design." Enforcing that in the API rather than
 * trusting the frontend means there is no server-side way to ask for a
 * flattering window — see `build-accuracy.ts` for the full reasoning, and
 * note that `limit` is absent for the same reason as `from`/`to`.
 *
 * Every figure comes from real scored `Prediction` rows written by Phase
 * 6's accuracy loop, with the rolling rate reusing the same global
 * `getGlobalPredictionHistory` that feeds every Brief's f_hist.
 */

import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { buildAccuracy } from '../accuracy/build-accuracy.js';
import { AccuracyPayloadSchema } from '../accuracy/accuracy.schemas.js';
import { getGlobalPredictionHistory } from '../predictions/history.js';

export interface AccuracyRouteDeps {
  prisma: PrismaClient;
}

export function registerAccuracyRoute(app: Express, deps: AccuracyRouteDeps): void {
  const { prisma } = deps;

  app.get('/api/accuracy', async (_req: Request, res: Response): Promise<void> => {
    try {
      // `select` rather than the whole row: this is a public endpoint, so
      // `userId` and the prediction id must not be able to reach it even
      // if the response shape later changed by accident.
      const [rows, history] = await Promise.all([
        prisma.prediction.findMany({
          where: { scored: true },
          orderBy: { targetTime: 'asc' },
          select: { targetTime: true, predictedKp: true, actualKp: true, hit: true },
        }),
        getGlobalPredictionHistory(prisma),
      ]);

      const payload = buildAccuracy(rows, history, new Date());

      const validated = AccuracyPayloadSchema.safeParse(payload);
      if (!validated.success) {
        console.error('[accuracy] response failed its own schema:', validated.error.issues);
        res.status(500).json({ error: 'accuracy payload failed validation' });
        return;
      }

      res.status(200).json(payload);
    } catch (error) {
      console.error(
        `[accuracy] read failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
      res.status(500).json({ error: 'internal error' });
    }
  });
}
