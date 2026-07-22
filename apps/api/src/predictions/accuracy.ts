/**
 * Daily accuracy job (WORKPLAN.md Phase 6 Task 4, FORMULAS.md §9): scores
 * every stored `Prediction` whose `targetTime` has elapsed but hasn't
 * been scored yet, by matching it against SWPC's observed Kp history
 * (reusing the existing `fetchSwpcSlow` client, not a new one) and
 * writing back `actualKp`/`hit`/`scored`. The resulting rolling
 * hits/trials feed the Causal Engine's f_hist factor via
 * `predictions/history.ts` — global scope, not per-user (DECISIONS.md).
 */

import type { PrismaClient } from '@prisma/client';
import type { SwpcSlowData } from '../clients/swpc/index.js';
import { selectNearestByTimeTag } from '../util/time-match.js';

/**
 * SWPC's observed-Kp product is a 3-hour-cadence series, so a genuine
 * reading is never more than 1.5h from any instant it actually covers.
 * A `targetTime` whose nearest observed entry is farther than that has
 * aged out of (or was never inside) the observed window — left
 * unscored rather than scored against a fabricated "nearest" match.
 */
const MAX_OBSERVED_MATCH_AGE_MS = 1.5 * 3_600_000;

/** FORMULAS.md §9 — the exact hit rule: within 1 Kp step counts as a hit. */
export function isHit(predictedKp: number, actualKp: number): boolean {
  return Math.abs(predictedKp - actualKp) <= 1;
}

export interface AccuracyJobDeps {
  prisma: PrismaClient;
  fetchSwpcSlow: (now: Date) => Promise<SwpcSlowData>;
}

export async function runAccuracyJob(
  deps: AccuracyJobDeps,
  now: Date,
): Promise<{ scored: number }> {
  const unscored = await deps.prisma.prediction.findMany({
    where: { scored: false, targetTime: { lte: now } },
  });
  if (unscored.length === 0) {
    return { scored: 0 };
  }

  const { kpObserved } = await deps.fetchSwpcSlow(now);
  if (kpObserved === null || kpObserved.length === 0) {
    return { scored: 0 };
  }

  let scored = 0;
  for (const prediction of unscored) {
    try {
      const nearest = selectNearestByTimeTag(kpObserved, prediction.targetTime);
      if (nearest === null) continue;

      const ageMs = Math.abs(new Date(nearest.timeTag).getTime() - prediction.targetTime.getTime());
      if (ageMs > MAX_OBSERVED_MATCH_AGE_MS) continue;

      const actualKp = nearest.kp;
      await deps.prisma.prediction.update({
        where: { id: prediction.id },
        data: { actualKp, hit: isHit(prediction.predictedKp, actualKp), scored: true },
      });
      scored += 1;
    } catch (error) {
      console.error(`[predictions/accuracy] failed to score prediction ${prediction.id}:`, error);
    }
  }

  return { scored };
}

/** No cadence pinned by any doc beyond "daily" — see DECISIONS.md. */
export const ACCURACY_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface AccuracyJobLoopDeps extends AccuracyJobDeps {
  /** Injected rather than called directly — lets tests exercise tick/interval/stop wiring against a fast mock. */
  runAccuracyJob: typeof runAccuracyJob;
}

/**
 * Starts the daily scoring loop: an immediate pass (so predictions that
 * elapsed while the server was down don't wait a full day), then one
 * every `ACCURACY_JOB_INTERVAL_MS`. Same shape as `startCacheSweepLoop`.
 */
export function startAccuracyJobLoop(deps: AccuracyJobLoopDeps): () => void {
  const tick = (): void => {
    void deps.runAccuracyJob(deps, new Date()).catch((err: unknown) => {
      console.error('[predictions/accuracy] job failed unexpectedly:', err);
    });
  };

  tick();
  const timer = setInterval(tick, ACCURACY_JOB_INTERVAL_MS);

  return () => clearInterval(timer);
}
