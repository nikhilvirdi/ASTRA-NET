/**
 * `/api/brief?lat=&lon=` (WORKPLAN.md Phase 4). Thin HTTP wrapper around
 * `buildBrief` — validates the query params (Zod, per WORKPLAN.md rule #6
 * on validating everything at an external boundary, including client
 * input), makes the per-request live/impure work `buildBrief` itself
 * can't: ISS next-pass (observer-specific, see `iss-card.ts`), the
 * global accuracy-loop history feeding f_hist (`predictions/history.ts`),
 * and — new in Phase 6 — persisting the Brief's aurora prediction
 * (`predictions/accuracy.ts`'s daily job later scores it) when there's
 * an active CME and the caller is authenticated. No prediction *math* or
 * degradation logic lives here; that all belongs to `build-brief.ts`.
 *
 * Auth is optional, not required: this endpoint is genuinely public
 * (`require-auth.ts`'s header comment), so `tryAuthenticate` — never
 * `requireAuth` — decides whether persistence happens, without ever
 * gating the Brief response itself on being logged in.
 */

import type { Express, Request, Response } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { buildBrief } from '../brief/build-brief.js';
import { getAllSourceStates } from '../poller/store.js';
import { tryAuthenticate } from '../auth/require-auth.js';
import { getGlobalPredictionHistory, NEUTRAL_PREDICTION_HISTORY } from '../predictions/history.js';
import {
  fetchN2yoVisualPasses as defaultFetchN2yoVisualPasses,
  type N2yoVisualPassesData,
} from '../clients/n2yo/index.js';

/** Same real-world ISS NORAD ID already used by the fast-tier poller (DECISIONS.md, 2026-07-16). */
const ISS_NORAD_ID = 25544;
/** Matches the fixture-established convention in n2yo.client.test.ts for this endpoint. */
const VISUAL_PASSES_DAYS = 2;
const VISUAL_PASSES_MIN_VISIBILITY_SECONDS = 300;

/**
 * `lat`/`lon` are optional so an authenticated caller can fall back to
 * their saved default location — ARCHITECTURE.md §8: "Logged-out =
 * generic location; logged-in = saved location". Explicit coordinates
 * always win, so an authenticated user can still look at another sky.
 * An anonymous caller with neither still gets the same 400 as before.
 */
const BriefQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

export interface BriefRouteDeps {
  n2yoApiKey: string;
  prisma: PrismaClient;
  jwtAccessSecret: string;
  fetchN2yoVisualPasses?: typeof defaultFetchN2yoVisualPasses;
}

function logUnexpectedBriefError(label: string, error: unknown): void {
  console.error(
    `[brief] ${label} failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
  );
}

export function registerBriefRoute(app: Express, deps: BriefRouteDeps): void {
  const fetchVisualPasses = deps.fetchN2yoVisualPasses ?? defaultFetchN2yoVisualPasses;

  app.get('/api/brief', async (req: Request, res: Response): Promise<void> => {
    const parsed = BriefQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'lat and lon query params are required and must be valid coordinates' });
      return;
    }
    const now = new Date();
    const pollerState = getAllSourceStates();

    const userId = await tryAuthenticate(req, { jwtAccessSecret: deps.jwtAccessSecret });

    // Both coordinates or neither: a lone `lat` is a malformed request,
    // not an invitation to fill the other half in from the saved location
    // (which would silently discard the coordinate the caller did send).
    let lat = parsed.data.lat;
    let lon = parsed.data.lon;
    if ((lat === undefined) !== (lon === undefined)) {
      res
        .status(400)
        .json({ error: 'lat and lon query params are required and must be valid coordinates' });
      return;
    }
    if (lat === undefined || lon === undefined) {
      const saved =
        userId === null
          ? null
          : await deps.prisma.location
              .findFirst({
                where: { userId, isDefault: true },
                select: { latitude: true, longitude: true },
              })
              .catch((error: unknown) => {
                logUnexpectedBriefError('default-location lookup', error);
                return null;
              });
      if (saved === null) {
        res
          .status(400)
          .json({ error: 'lat and lon query params are required and must be valid coordinates' });
        return;
      }
      lat = saved.latitude;
      lon = saved.longitude;
    }

    // f_hist is global, not per-request (DECISIONS.md), but only worth a
    // DB round-trip when there's any chance of an active CME — a poller
    // state with zero CME records at all can never produce one (the
    // real selection in build-brief.ts's space-weather-card.ts can only
    // narrow this set further), so this is a safe, cheap fast path, not
    // a re-derivation of that selection policy.
    const mayHaveActiveCme = (pollerState.donki.data?.cmes?.length ?? 0) > 0;
    let history = NEUTRAL_PREDICTION_HISTORY;
    if (mayHaveActiveCme) {
      try {
        history = await getGlobalPredictionHistory(deps.prisma);
      } catch (error) {
        // A history-lookup failure degrades to the neutral prior, same as
        // "no accuracy-loop data yet" — it never blanks the whole Brief.
        logUnexpectedBriefError('prediction history lookup', error);
      }
    }

    let visualPasses: N2yoVisualPassesData | null;
    try {
      visualPasses = await fetchVisualPasses(
        {
          satId: ISS_NORAD_ID,
          observerLat: lat,
          observerLng: lon,
          observerAlt: 0,
          days: VISUAL_PASSES_DAYS,
          minVisibility: VISUAL_PASSES_MIN_VISIBILITY_SECONDS,
        },
        deps.n2yoApiKey,
        now,
      );
    } catch {
      // fetchN2yoVisualPasses is documented to never throw, but this guard
      // ensures a next-pass failure can never take down the rest of the
      // Brief — same "one source down blanks only its own card" contract.
      visualPasses = null;
    }

    const brief = buildBrief(pollerState, lat, lon, now, visualPasses, history);

    const aurora = brief.spaceWeather.data?.aurora;
    if (
      userId !== null &&
      aurora?.hasActiveCme === true &&
      aurora.cmeArrivalTime !== null &&
      aurora.confidence !== null
    ) {
      try {
        await deps.prisma.prediction.create({
          data: {
            userId,
            targetTime: new Date(aurora.cmeArrivalTime),
            predictedKp: aurora.kpPredicted,
            confidence: aurora.confidence,
            context: {
              cmeActivityId: aurora.cmeActivityId,
              confidenceBand: aurora.confidenceBand,
              geomagneticLatitudeDeg: aurora.geomagneticLatitudeDeg,
              leadHours: aurora.leadHours,
              factors: aurora.factors,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        logUnexpectedBriefError('prediction persistence', error);
      }
    }

    res.json(brief);
  });
}
