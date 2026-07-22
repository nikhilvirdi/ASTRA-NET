/**
 * Global prediction-accuracy history feeding the Causal Engine's f_hist
 * factor (FORMULAS.md §8/§9). Deliberately GLOBAL, not scoped to a
 * single user: `ARCHITECTURE.md` §8's `/accuracy` page shows one
 * system-wide track record, and prediction accuracy is a property of
 * the CME-arrival/Kp-forecast methodology itself, not of who happened
 * to be logged in when a given Brief was generated. Per-user scoping
 * would mean a user's Brief confidence and the public `/accuracy` page
 * were computed from different populations, breaking the premise that
 * confidence is grounded in the app's actual track record. See
 * DECISIONS.md.
 */

import type { PrismaClient } from '@prisma/client';

export interface PredictionHistory {
  hits: number;
  trials: number;
}

/** Beta prior with zero trials — same neutral starting point `historyFactor` itself falls back to. */
export const NEUTRAL_PREDICTION_HISTORY: PredictionHistory = { hits: 0, trials: 0 };

/** Rolling hits/trials across every scored prediction, regardless of which user triggered it. */
export async function getGlobalPredictionHistory(prisma: PrismaClient): Promise<PredictionHistory> {
  const [trials, hits] = await Promise.all([
    prisma.prediction.count({ where: { scored: true } }),
    prisma.prediction.count({ where: { scored: true, hit: true } }),
  ]);
  return { hits, trials };
}
