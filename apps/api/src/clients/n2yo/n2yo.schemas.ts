/**
 * Zod schemas for N2YO endpoints.
 */
import { z } from 'zod';

export const N2yoInfoSchema = z.object({
  satname: z.string(),
  satid: z.number().int(),
  transactionscount: z.number().int(),
});

export const N2yoPositionEntrySchema = z.object({
  satlatitude: z.number(),
  satlongitude: z.number(),
  sataltitude: z.number(),
  azimuth: z.number(),
  elevation: z.number(),
  ra: z.number(),
  dec: z.number(),
  timestamp: z.number().int(), // Unix timestamp (seconds)
  eclipsed: z.boolean().optional(),
});

export const N2yoPositionsResponseSchema = z.object({
  info: N2yoInfoSchema,
  positions: z.array(N2yoPositionEntrySchema).optional().default([]),
});

export const N2yoPassEntrySchema = z.object({
  startAz: z.number(),
  startAzCompass: z.string(),
  startEl: z.number(),
  startUTC: z.number().int(), // Unix timestamp (seconds)
  maxAz: z.number(),
  maxAzCompass: z.string(),
  maxEl: z.number(),
  maxUTC: z.number().int(),
  endAz: z.number(),
  endAzCompass: z.string(),
  endEl: z.number(),
  endUTC: z.number().int(),
  mag: z.number(),
  duration: z.number(),
  startVisibility: z.number().int().optional(),
});

export const N2yoVisualPassesResponseSchema = z.object({
  info: N2yoInfoSchema.extend({ passescount: z.number().int() }),
  passes: z.array(N2yoPassEntrySchema).nullable().optional(), // N2YO sometimes omits or nulls this if passescount=0
});

export type N2yoPositionsResponse = z.infer<typeof N2yoPositionsResponseSchema>;
export type N2yoVisualPassesResponse = z.infer<typeof N2yoVisualPassesResponseSchema>;
