/**
 * Global prediction-accuracy history feeding the Causal Engine's f_hist
 * factor (FORMULAS.md §8/§9). Deliberately GLOBAL, not scoped to a
 * single user: prediction accuracy is a property of the CME-arrival/
 * Kp-forecast methodology itself, not of who happened to be looking
 * when a given Brief was generated — and there is no account system at
 * all (SCHEMA.md), so there is no "per-user" population to scope to in
 * the first place. See DECISIONS.md.
 *
 * Current consumer: the Daily Brief's aurora-confidence composition
 * (`brief/space-weather-card.ts`'s `buildAuroraCard`), which this
 * module's result reaches via `brief/compose-brief.ts`. The `/accuracy`
 * page this history once also fed no longer exists.
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
