/**
 * `/api/satellites` — Phase 8 backend prerequisite for the semantic-zoom
 * clustering system (`apps/web/src/lib/semantic-zoom.ts`), which currently
 * has no real population to cluster (only the ISS exists in production).
 *
 * Exposes the curated satellite population's raw TLE element sets from the
 * centrally-polled slow-tier store. Deliberately observer-independent
 * orbital elements only — no alt/az here. ARCHITECTURE.md §2 locks
 * satellite.js as a client-side library, and this payload is exactly what
 * a client-side `satellite.js` propagator consumes
 * (`twoline2satrec(line1, line2)`), not what it produces. See DECISIONS.md
 * for the full rationale on why propagation was kept off the backend.
 *
 * The ISS is deliberately excluded from this list: it already has its own,
 * more authoritative, live N2YO-sourced position (`brief/iss-card.ts`) and
 * is the semantic-zoom system's single pinned hero object. Exposing a
 * second, TLE-propagated ISS position here would let the two disagree —
 * the same class of bug the Sun-position consolidation (DECISIONS.md,
 * 2026-07-24) fixed for the Explore scene's Sun marker vs. Heliosphere
 * Pulse.
 *
 * `buildSatellitesPayload` is the testable core (pure function over the
 * store, no Express), mirroring every other route's pattern
 * (`health.ts`/`stream.ts`).
 */

import type { Express, Request, Response } from 'express';
import { getSourceState } from '../poller/store.js';

/** Same real-world ISS NORAD catalog number used across the codebase (fast-tier.ts, brief.ts). */
const ISS_NORAD_ID = 25544;

/** One satellite's raw orbital elements — input to a client-side satellite.js propagator. */
export interface SatelliteElementSet {
  /** NORAD catalog number as a string — stable, unique key. */
  id: string;
  name: string;
  line1: string;
  line2: string;
}

export interface SatellitesPayload {
  satellites: SatelliteElementSet[];
  fetchedAt: string | null;
  healthy: boolean;
}

export function buildSatellitesPayload(): SatellitesPayload {
  const state = getSourceState('satellites');
  const records = state.data?.records ?? [];

  const satellites: SatelliteElementSet[] = records
    .filter((record) => record.noradCatId !== ISS_NORAD_ID)
    .map((record) => ({
      id: String(record.noradCatId),
      name: record.name,
      line1: record.line1,
      line2: record.line2,
    }));

  return { satellites, fetchedAt: state.fetchedAt, healthy: state.healthy };
}

export function registerSatellitesRoute(app: Express): void {
  app.get('/api/satellites', (_req: Request, res: Response) => {
    res.json(buildSatellitesPayload());
  });
}
