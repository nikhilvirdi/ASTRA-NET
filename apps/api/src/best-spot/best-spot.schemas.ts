/**
 * Zod schemas for `/api/best-spot`.
 *
 * WORKPLAN.md rule #6 requires validating everything at an external
 * boundary. For this endpoint that cuts both ways: the query params are
 * untrusted client input, and the *response* is the contract `apps/web`
 * will be written against — so it is validated on the way out too, before
 * it can reach a client.
 *
 * Validating our own response is not paranoia here: the payload is composed
 * from three independently-degradable sources, and a silent shape
 * regression (a factor going `undefined`, a NaN score from a bad Bortle
 * cell) would otherwise surface as a frontend crash rather than a caught
 * server-side error.
 */

import { z } from 'zod';

/** Rejects NaN/Infinity, which `z.number()` alone permits and JSON renders as `null`. */
const finite = () => z.number().finite();

/** Every §11 factor is a [0,1] multiplier by construction. */
const factor = () => finite().min(0).max(1);

export const ClarityComponentSchema = z.object({
  factor: factor().nullable(),
  cloudCoverPercent: finite().min(0).max(100).nullable(),
  forecastTime: z.string().datetime().nullable(),
  available: z.boolean(),
});

export const DarknessComponentSchema = z.object({
  factor: factor(),
  bortleClass: z.number().int().min(1).max(9),
});

export const TravelComponentSchema = z.object({
  factor: factor(),
  distanceKm: finite().min(0),
  bearingDeg: finite().min(0).lt(360).nullable(),
  compass: z.string().nullable(),
  travelMinutes: finite().min(0).nullable(),
});

export const AuroraComponentSchema = z.object({
  factor: factor(),
  strengthDeg: finite(),
  visible: z.boolean(),
  kp: finite().min(0).max(9),
});

export const BestSpotSiteSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  latDeg: finite().min(-90).max(90),
  lonDeg: finite().min(-180).max(180),
  rank: z.number().int().positive(),
  score: factor(),
  clarity: ClarityComponentSchema,
  darkness: DarknessComponentSchema,
  travel: TravelComponentSchema,
  aurora: AuroraComponentSchema.nullable(),
});

export const BestSpotRankingSchema = z.object({
  basis: z.enum(['clarity-darkness-travel', 'darkness-travel']),
  clarityAvailable: z.boolean(),
  auroraApplied: z.boolean(),
  note: z.string().nullable(),
});

export const BestSpotPayloadSchema = z
  .object({
    observer: z.object({
      latDeg: finite().min(-90).max(90),
      lonDeg: finite().min(-180).max(180),
    }),
    generatedAt: z.string().datetime(),
    targetTime: z.string().datetime(),
    status: z.enum(['ok', 'unavailable']),
    ranking: BestSpotRankingSchema,
    sites: z.array(BestSpotSiteSchema),
  })
  .superRefine((payload, ctx) => {
    if (payload.status === 'ok' && payload.sites.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status 'ok' requires at least one scored site",
        path: ['sites'],
      });
    }
    // The list is the ranking — a client that renders it in array order must
    // get the same order the ranks claim.
    const misordered = payload.sites.some((site, i) => site.rank !== i + 1);
    if (misordered) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sites must be sorted best-first with ranks 1..n',
        path: ['sites'],
      });
    }
    const descending = payload.sites.every(
      (site, i) => i === 0 || site.score <= payload.sites[i - 1]!.score,
    );
    if (!descending) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sites must be ordered by descending score',
        path: ['sites'],
      });
    }
  });

export type BestSpotPayloadParsed = z.infer<typeof BestSpotPayloadSchema>;
