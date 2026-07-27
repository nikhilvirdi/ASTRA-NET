/**
 * Zod schemas for `/api/log`.
 *
 * Validated on the way out as well as in, same as `/api/best-spot`: the
 * response is the contract `apps/web` will be written against, and the
 * stats are derived numbers where a regression (a NaN streak, a negative
 * count) would otherwise surface as a broken page rather than a caught
 * server error.
 */

import { z } from 'zod';
import { SKY_LOG_EVENT_TYPES } from '../util/event-types.js';

const nonNegativeInt = () => z.number().int().min(0);

export const LogEntrySchema = z.object({
  id: z.string().min(1),
  eventType: z.enum(SKY_LOG_EVENT_TYPES),
  timestamp: z.string().datetime(),
  source: z.enum(['manual', 'auto']),
  details: z.unknown(),
  night: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'night must be a YYYY-MM-DD UTC date'),
});

export const LogStatsSchema = z.object({
  totalSightings: nonNegativeInt(),
  nightsObserved: nonNegativeInt(),
  issPassesCaught: nonNegativeInt(),
  lastAuroraSighting: z.string().datetime().nullable(),
  currentStreakNights: nonNegativeInt(),
});

export const LogPayloadSchema = z
  .object({
    generatedAt: z.string().datetime(),
    stats: LogStatsSchema,
    entries: z.array(LogEntrySchema),
  })
  .superRefine((payload, ctx) => {
    const { stats, entries } = payload;

    if (stats.totalSightings !== entries.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'totalSightings must equal the number of entries returned',
        path: ['stats', 'totalSightings'],
      });
    }
    // Derived counts can never exceed the population they are drawn from.
    if (stats.nightsObserved > entries.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'nightsObserved cannot exceed the number of entries',
        path: ['stats', 'nightsObserved'],
      });
    }
    if (stats.currentStreakNights > stats.nightsObserved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currentStreakNights cannot exceed nightsObserved',
        path: ['stats', 'currentStreakNights'],
      });
    }
    if (stats.issPassesCaught > entries.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'issPassesCaught cannot exceed the number of entries',
        path: ['stats', 'issPassesCaught'],
      });
    }
    // The timeline is the page's reading order; ranks aren't numbered here,
    // so ordering is the only guarantee a client can rely on.
    const newestFirst = entries.every(
      (entry, i) => i === 0 || entry.timestamp <= entries[i - 1]!.timestamp,
    );
    if (!newestFirst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'entries must be ordered newest first',
        path: ['entries'],
      });
    }
  });

export type LogPayloadParsed = z.infer<typeof LogPayloadSchema>;
