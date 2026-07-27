/**
 * Zod schemas for `/api/accuracy`.
 *
 * The response schema is also where DESIGN_SPEC.md §14's honesty
 * constraints become mechanically checkable: the series must be whole and
 * chronological, `trials` must not be inflated past the points actually
 * published, and no field may carry a user identifier — this endpoint is
 * public.
 */

import { z } from 'zod';

/** Kp is a 0-9 index. Rejects NaN, which `z.number()` alone permits. */
const kp = () => z.number().finite().min(0).max(9);

export const AccuracyPointSchema = z
  .object({
    targetTime: z.string().datetime(),
    predictedKp: kp(),
    actualKp: kp(),
    hit: z.boolean(),
  })
  .strict(); // no id, no userId — a public endpoint must not grow one by accident

export const AccuracyHitRateSchema = z.object({
  hits: z.number().int().min(0),
  trials: z.number().int().min(0),
  rate: z.number().finite().min(0).max(1),
  rawRate: z.number().finite().min(0).max(1).nullable(),
  prior: z.object({
    hits: z.number().int().min(0),
    trials: z.number().int().min(0),
  }),
});

export const AccuracyPayloadSchema = z
  .object({
    generatedAt: z.string().datetime(),
    series: z.array(AccuracyPointSchema),
    hitRate: AccuracyHitRateSchema,
    empty: z.boolean(),
  })
  .superRefine((payload, ctx) => {
    const { series, hitRate, empty } = payload;

    if (hitRate.hits > hitRate.trials) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'hits cannot exceed trials',
        path: ['hitRate', 'hits'],
      });
    }
    // Chronological order is part of the contract: a step plot drawn in
    // array order would misrepresent the record if the server reordered it.
    const chronological = series.every(
      (point, i) => i === 0 || point.targetTime >= series[i - 1]!.targetTime,
    );
    if (!chronological) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'series must be ordered oldest first',
        path: ['series'],
      });
    }
    if (empty && series.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'empty cannot be true while the series has points',
        path: ['empty'],
      });
    }
    // The full-record guarantee, made checkable: every scored trial must be
    // represented as a published point. A truncated series with an intact
    // trials count would be exactly the quiet cherry-pick §14 forbids.
    if (series.length < hitRate.trials) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'series must publish every scored trial — a shorter series than trials means the record was truncated',
        path: ['series'],
      });
    }
  });

export type AccuracyPayloadParsed = z.infer<typeof AccuracyPayloadSchema>;
