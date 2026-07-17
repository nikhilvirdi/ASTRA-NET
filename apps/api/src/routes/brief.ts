/**
 * `/api/brief?lat=&lon=` (WORKPLAN.md Phase 4). Thin HTTP wrapper around
 * `buildBrief` — validates the query params (Zod, per WORKPLAN.md rule #6
 * on validating everything at an external boundary, including client
 * input), makes the one per-request live call `buildBrief` itself can't
 * (ISS next-pass, observer-specific — see `iss-card.ts`), then composes
 * the response from the poller's current store snapshot. No prediction or
 * degradation logic lives here; it all belongs to `build-brief.ts`.
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { buildBrief } from '../brief/build-brief.js';
import { getAllSourceStates } from '../poller/store.js';
import {
  fetchN2yoVisualPasses as defaultFetchN2yoVisualPasses,
  type N2yoVisualPassesData,
} from '../clients/n2yo/index.js';

/** Same real-world ISS NORAD ID already used by the fast-tier poller (DECISIONS.md, 2026-07-16). */
const ISS_NORAD_ID = 25544;
/** Matches the fixture-established convention in n2yo.client.test.ts for this endpoint. */
const VISUAL_PASSES_DAYS = 2;
const VISUAL_PASSES_MIN_VISIBILITY_SECONDS = 300;

const BriefQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export interface BriefRouteDeps {
  n2yoApiKey: string;
  fetchN2yoVisualPasses?: typeof defaultFetchN2yoVisualPasses;
}

export function registerBriefRoute(app: Express, deps: BriefRouteDeps): void {
  const fetchVisualPasses = deps.fetchN2yoVisualPasses ?? defaultFetchN2yoVisualPasses;

  app.get('/api/brief', (req: Request, res: Response) => {
    const parsed = BriefQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'lat and lon query params are required and must be valid coordinates' });
      return;
    }
    const { lat, lon } = parsed.data;
    const now = new Date();

    fetchVisualPasses(
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
    )
      .then((visualPasses: N2yoVisualPassesData) => {
        res.json(buildBrief(getAllSourceStates(), lat, lon, now, visualPasses));
      })
      .catch(() => {
        // fetchN2yoVisualPasses is documented to never throw, but this guard
        // ensures a next-pass failure can never take down the rest of the
        // Brief — same "one source down blanks only its own card" contract.
        res.json(buildBrief(getAllSourceStates(), lat, lon, now, null));
      });
  });
}
