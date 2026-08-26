/**
 * `/api/brief?lat=&lon=` (WORKPLAN.md Phase 4). Thin HTTP wrapper around
 * `buildBrief` — validates the query params (Zod, per WORKPLAN.md rule #6
 * on validating everything at an external boundary, including client
 * input), makes the per-request live/impure work `buildBrief` itself
 * can't: ISS next-pass (observer-specific, see `iss-card.ts`), the
 * global accuracy-loop history feeding f_hist (`predictions/history.ts`),
 * and persisting the Brief's aurora prediction (`predictions/accuracy.ts`'s
 * daily job later scores it) whenever there's an active CME. No prediction
 * *math* or degradation logic lives here; that all belongs to
 * `build-brief.ts`.
 *
 * There is no account system: every request is anonymous, `lat`/`lon` are
 * always required from the caller, and every qualifying Brief view writes
 * a `Prediction` row — the global accuracy track record (`/api/accuracy`)
 * is a property of the forecasting methodology itself, not of who was
 * looking, so it isn't gated on identity that no longer exists.
 */

import type { Express, Request, Response } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  composeBriefForObserver,
  logUnexpectedBriefError,
  type ComposeBriefDeps,
} from '../brief/compose-brief.js';
import type { fetchN2yoVisualPasses as defaultFetchN2yoVisualPasses } from '../clients/n2yo/index.js';

const BriefQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export interface BriefRouteDeps extends ComposeBriefDeps {
  n2yoApiKey: string;
  prisma: PrismaClient;
  fetchN2yoVisualPasses?: typeof defaultFetchN2yoVisualPasses;
}

export function registerBriefRoute(app: Express, deps: BriefRouteDeps): void {
  app.get('/api/brief', async (req: Request, res: Response): Promise<void> => {
    const parsed = BriefQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'lat and lon query params are required and must be valid coordinates' });
      return;
    }
    const now = new Date();
    const { lat, lon } = parsed.data;

    const brief = await composeBriefForObserver(deps, lat, lon, now);

    res.json(brief);

    const aurora = brief.spaceWeather.data?.aurora;
    if (
      aurora?.hasActiveCme === true &&
      aurora.cmeArrivalTime !== null &&
      aurora.confidence !== null &&
      aurora.cmeActivityId !== null
    ) {
      const cmeActivityId = aurora.cmeActivityId;
      void Promise.resolve().then(async () => {
        try {
          // A single atomic INSERT guarded by `Prediction.cmeActivityId`'s
          // real unique constraint (see prisma/schema.prisma) — race-safe
          // by construction, unlike the find-then-create this replaced.
          // Two near-simultaneous requests for the same active CME both
          // attempt this insert; the database allows exactly one to
          // succeed and rejects the other with a P2002 unique-constraint
          // violation, which is the expected "someone else already
          // recorded this CME" outcome, not an error.
          await deps.prisma.prediction.create({
            data: {
              cmeActivityId,
              targetTime: new Date(aurora.cmeArrivalTime!),
              predictedKp: aurora.kpPredicted,
              confidence: aurora.confidence!,
              context: {
                confidenceBand: aurora.confidenceBand,
                geomagneticLatitudeDeg: aurora.geomagneticLatitudeDeg,
                leadHours: aurora.leadHours,
                factors: aurora.factors,
              } as Prisma.InputJsonValue,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return;
          }
          logUnexpectedBriefError('prediction persistence', error);
        }
      });
    }
  });
}
