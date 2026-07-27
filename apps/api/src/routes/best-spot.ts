/**
 * `/api/best-spot?lat=&lon=[&event=aurora][&at=ISO]` (WORKPLAN.md Phase 9).
 *
 * Thin HTTP wrapper around `buildBestSpot`, following `brief.ts`'s split
 * exactly: this layer does the per-request impure work the pure core can't
 * — generating candidates, batch-fetching their cloud forecasts, reading
 * the Bortle atlas, and picking the Kp off the poller — then hands
 * everything to the core. No scoring or degradation policy lives here.
 *
 * Public, like `/api/brief`: finding a dark site needs no account.
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { generateCandidateSites } from '../best-spot/candidates.js';
import {
  buildBestSpot,
  type BestSpotEvent,
  type CandidateObservation,
} from '../best-spot/build-best-spot.js';
import { BestSpotPayloadSchema } from '../best-spot/best-spot.schemas.js';
import { bortleAt } from '../clients/static/light-pollution.client.js';
import {
  fetchOpenMeteoBatch as defaultFetchOpenMeteoBatch,
  type OpenMeteoData,
} from '../clients/open-meteo/index.js';
import { selectNearestForecastEntry } from '../brief/space-weather-card.js';
import { getSourceState } from '../poller/store.js';

const BestSpotQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  /** Tunes the ranking for tonight's event (WORKPLAN.md Phase 9's filter). */
  event: z.enum(['aurora']).optional(),
  /**
   * Instant to rank for, defaulting to now. The caller decides what
   * "tonight" means — this endpoint does not invent an observing-hour
   * policy that no doc specifies (see DECISIONS.md).
   */
  at: z.coerce.date().optional(),
});

export interface BestSpotRouteDeps {
  fetchOpenMeteoBatch?: typeof defaultFetchOpenMeteoBatch;
  /** Test seam for the Bortle atlas; defaults to the real static grid. */
  bortleAt?: typeof bortleAt;
}

export function registerBestSpotRoute(app: Express, deps: BestSpotRouteDeps = {}): void {
  const fetchCloud = deps.fetchOpenMeteoBatch ?? defaultFetchOpenMeteoBatch;
  const lookupBortle = deps.bortleAt ?? bortleAt;

  app.get('/api/best-spot', async (req: Request, res: Response): Promise<void> => {
    const parsed = BestSpotQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error:
          'lat and lon query params are required and must be valid coordinates; event must be "aurora" if given; at must be a valid date',
      });
      return;
    }

    const { lat, lon, event, at } = parsed.data;
    const now = new Date();
    const targetTime = at ?? now;
    const observer = { latDeg: lat, lonDeg: lon };

    const candidates = generateCandidateSites(observer);

    // One batch request for every candidate — see `fetchOpenMeteoBatch`.
    // Never throws, so a cloud outage degrades rather than 500s.
    const cloud: OpenMeteoData[] = await fetchCloud(
      { points: candidates.map((c) => ({ latitude: c.latDeg, longitude: c.lonDeg })) },
      now,
    );

    const observations: CandidateObservation[] = candidates.map((candidate, i) => ({
      candidate,
      cloud: cloud[i] ?? null,
      bortle: lookupBortle(candidate.latDeg, candidate.lonDeg),
    }));

    // Same Kp the Brief's aurora card ranks on — reused, not re-selected,
    // so the two screens can never disagree about tonight's Kp.
    const forecastEntries = getSourceState('spaceWeatherForecast').data?.kpForecast ?? null;
    const kp = forecastEntries
      ? (selectNearestForecastEntry(forecastEntries, targetTime)?.kp ?? null)
      : null;

    const payload = buildBestSpot({
      observer,
      observations,
      kp,
      event: (event ?? null) as BestSpotEvent,
      targetTime,
      now,
    });

    // Validate our own contract on the way out: a shape regression should be
    // a caught server error here, not a crash in the client.
    const validated = BestSpotPayloadSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[best-spot] response failed its own schema:', validated.error.issues);
      res.status(500).json({ error: 'best-spot payload failed validation' });
      return;
    }

    res.json(payload);
  });
}
