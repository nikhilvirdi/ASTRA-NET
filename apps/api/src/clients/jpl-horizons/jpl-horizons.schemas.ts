import { z } from 'zod';

export const HorizonsResponseSchema = z.object({
  signature: z
    .object({
      version: z.string(),
      source: z.string(),
    })
    .optional(),
  result: z.string(),
});

export type HorizonsResponse = z.infer<typeof HorizonsResponseSchema>;

/**
 * Validates one parsed OBSERVER-table ephemeris row (ANG_FORMAT='DEG').
 * RA/Dec bounds match the request's own units — a row outside them means
 * the line was misparsed, not that the sky moved.
 */
export const HorizonsRaDecEntrySchema = z.object({
  timestampUtcMs: z.number().int().finite(),
  raDeg: z.number().min(0).max(360),
  decDeg: z.number().min(-90).max(90),
});
