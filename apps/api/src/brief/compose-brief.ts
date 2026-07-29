/**
 * The live, per-request half of building a Brief — everything `buildBrief`
 * deliberately cannot do because it is pure: read the poller's in-memory
 * state, fetch the observer-specific ISS next-pass from N2YO, and look up
 * the global accuracy-loop history that feeds `f_hist`.
 *
 * Extracted from `routes/brief.ts` when Phase 11 needed the identical
 * composition to freeze a share snapshot. Two routes composing a Brief two
 * slightly different ways is exactly the drift `CLAUDE.md` makes the lead
 * agent responsible for preventing — a shared card that disagreed with the
 * Brief it was shared from would undermine the whole point of the card.
 *
 * Route-specific concerns stay in their routes: `/api/brief` keeps its
 * saved-location fallback and its prediction persistence, `/api/share`
 * keeps its snapshot write. This module only produces a `DailyBrief`.
 */

import type { PrismaClient } from '@prisma/client';
import { buildBrief, type DailyBrief } from './build-brief.js';
import { getAllSourceStates } from '../poller/store.js';
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

export function logUnexpectedBriefError(label: string, error: unknown): void {
  console.error(
    `[brief] ${label} failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
  );
}

export interface ComposeBriefDeps {
  prisma: PrismaClient;
  n2yoApiKey: string;
  fetchN2yoVisualPasses?: typeof defaultFetchN2yoVisualPasses;
}

export async function composeBriefForObserver(
  deps: ComposeBriefDeps,
  latDeg: number,
  lonDeg: number,
  now: Date,
): Promise<DailyBrief> {
  const fetchVisualPasses = deps.fetchN2yoVisualPasses ?? defaultFetchN2yoVisualPasses;
  const pollerState = getAllSourceStates();

  // f_hist is global, not per-request (DECISIONS.md), but only worth a
  // DB round-trip when there's any chance of an active CME — a poller
  // state with zero CME records at all can never produce one (the real
  // selection in build-brief.ts's space-weather-card.ts can only narrow
  // this set further), so this is a safe, cheap fast path, not a
  // re-derivation of that selection policy.
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
        observerLat: latDeg,
        observerLng: lonDeg,
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

  return buildBrief(pollerState, latDeg, lonDeg, now, visualPasses, history);
}
