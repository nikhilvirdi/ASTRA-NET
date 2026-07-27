/**
 * `buildAccuracy` — the pure core of `/api/accuracy` (WORKPLAN.md Phase 10,
 * DESIGN_SPEC.md §14).
 *
 * Every number here comes from real scored `Prediction` rows written by
 * Phase 6's accuracy loop (`predictions/accuracy.ts`). Nothing is
 * simulated, smoothed, or back-filled — WORKPLAN.md Phase 10 is explicit
 * that `/accuracy` "must reflect the *real* recorded track record from
 * Phase 6 — never fabricated numbers".
 *
 * ## Why this endpoint takes no filter parameters
 *
 * DESIGN_SPEC.md §14: *"**No cherry-picking controls.** No date-range
 * selector that lets the page show only its best week. The default and
 * only view is the full record. That constraint _is_ the design."*
 *
 * That constraint is enforced **here, in the API**, not left to the
 * frontend to respect. `/api/accuracy` accepts no `from`, `to`, `range`,
 * `limit`, `since` or ordering parameter of any kind, so there is no
 * server-side way to request a flattering subset — a client that wanted
 * to show only its best week would have to fetch the whole record and
 * discard part of it, which makes the omission a visible, reviewable act
 * in frontend code rather than an innocuous query string. A `limit` would
 * have been the easy way to bound the payload; it is deliberately absent,
 * because "most recent N" is exactly the selector §14 forbids.
 *
 * ## Why the hit rate is global and the series carries no user
 *
 * `/accuracy` is public (ARCHITECTURE.md §8's route table and
 * DESIGN_SPEC.md §14's opening line both say so), so no row may carry a
 * `userId` or prediction id. The rolling rate reuses
 * `getGlobalPredictionHistory` and `historyFactor` unchanged — the same
 * global hits/trials that feed every Brief's f_hist. Computing a second,
 * differently-scoped rate here would let the public track record disagree
 * with the confidence figure the Brief shows, which is the exact premise
 * `predictions/history.ts` exists to protect.
 */

import { historyFactor } from '@astranet/shared';
import type { PredictionHistory } from '../predictions/history.js';

/** The scored-prediction fields safe to publish — deliberately no id, no userId. */
export interface AccuracyPoint {
  /** UTC ISO — the instant the prediction was for. */
  targetTime: string;
  predictedKp: number;
  actualKp: number;
  /** FORMULAS.md §9's rule: |predicted - actual| <= 1. Read from the row, not recomputed. */
  hit: boolean;
}

/** A scored prediction row as the HTTP layer hands it over. */
export interface ScoredPredictionRow {
  targetTime: Date;
  predictedKp: number;
  actualKp: number | null;
  hit: boolean | null;
}

export interface AccuracyPayload {
  generatedAt: string;
  /**
   * Chronological, oldest first — a step plot reads left to right, and a
   * fixed order removes any question of the server having sorted for
   * flattery.
   */
  series: AccuracyPoint[];
  hitRate: {
    /** Raw scored counts. `trials` is the honest denominator, never padded. */
    hits: number;
    trials: number;
    /**
     * FORMULAS.md §8/§9's Beta posterior mean, `(hits + 2) / (trials + 4)`
     * — the figure DESIGN_SPEC.md §14 puts on screen. Reuses
     * `historyFactor` from packages/shared rather than restating it.
     */
    rate: number;
    /**
     * The naive `hits / trials`, or null with zero trials. Exposed
     * alongside `rate` so the page can be honest about the prior's effect
     * instead of the difference being invisible.
     */
    rawRate: number | null;
    /** DESIGN_SPEC.md §14 requires the prior be explained, so its terms are stated, not hidden. */
    prior: { hits: number; trials: number };
  };
  /**
   * True only when there is nothing scored yet. The page still renders —
   * §14's empty record is a real state, not an error.
   */
  empty: boolean;
}

/** The +2/+4 neutral Beta prior baked into FORMULAS.md §8's f_hist. */
export const BETA_PRIOR = { hits: 2, trials: 4 } as const;

export function buildAccuracy(
  rows: ScoredPredictionRow[],
  history: PredictionHistory,
  now: Date,
): AccuracyPayload {
  const series: AccuracyPoint[] = rows
    // A row can be `scored` yet still carry a null actualKp/hit only if it
    // were written inconsistently; drop rather than coerce a null to 0,
    // which would plot a fabricated observation.
    .filter(
      (row): row is ScoredPredictionRow & { actualKp: number; hit: boolean } =>
        row.actualKp !== null && row.hit !== null,
    )
    .map((row) => ({
      targetTime: row.targetTime.toISOString(),
      predictedKp: row.predictedKp,
      actualKp: row.actualKp,
      hit: row.hit,
    }))
    .sort((a, b) => a.targetTime.localeCompare(b.targetTime));

  return {
    generatedAt: now.toISOString(),
    series,
    hitRate: {
      hits: history.hits,
      trials: history.trials,
      rate: historyFactor(history.hits, history.trials),
      rawRate: history.trials > 0 ? history.hits / history.trials : null,
      prior: { hits: BETA_PRIOR.hits, trials: BETA_PRIOR.trials },
    },
    empty: history.trials === 0 && series.length === 0,
  };
}
