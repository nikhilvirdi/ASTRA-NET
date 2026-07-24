/**
 * Zod schemas for CelesTrak JSON OMM endpoints.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// CelesTrak JSON OMM
// ---------------------------------------------------------------------------
export const CelestrakOmmEntrySchema = z.object({
  OBJECT_NAME: z.string(),
  OBJECT_ID: z.string(),
  EPOCH: z.string(),
  MEAN_MOTION: z.number(),
  ECCENTRICITY: z.number(),
  INCLINATION: z.number(),
  RA_OF_ASC_NODE: z.number(),
  ARG_OF_PERICENTER: z.number(),
  MEAN_ANOMALY: z.number(),
  EPHEMERIS_TYPE: z.number(),
  CLASSIFICATION_TYPE: z.string(),
  NORAD_CAT_ID: z.number().int(),
  ELEMENT_SET_NO: z.number().int(),
  REV_AT_EPOCH: z.number().int(),
  BSTAR: z.number(),
  MEAN_MOTION_DOT: z.number(),
  MEAN_MOTION_DDOT: z.number(),
});

export const CelestrakOmmResponseSchema = z.array(CelestrakOmmEntrySchema);

export type CelestrakOmmEntry = z.infer<typeof CelestrakOmmEntrySchema>;
export type CelestrakOmmResponse = z.infer<typeof CelestrakOmmResponseSchema>;

// ---------------------------------------------------------------------------
// CelesTrak TLE (FORMAT=tle) — a name line + two fixed-column element lines.
// Validated structurally (length, line-number marker, matching catalog
// number between the two element lines) rather than by TLE checksum: every
// other Phase 1 client validates upstream *shape*, not upstream arithmetic,
// and satellite.js's own `twoline2satrec` does not verify checksums either.
// ---------------------------------------------------------------------------
export const CelestrakTleRecordSchema = z
  .object({
    name: z.string().min(1),
    line1: z.string().length(69).startsWith('1 '),
    line2: z.string().length(69).startsWith('2 '),
  })
  .refine((r) => r.line1.slice(2, 7) === r.line2.slice(2, 7), {
    message: 'line1/line2 catalog number mismatch',
  });

export const CelestrakTleRecordsSchema = z.array(CelestrakTleRecordSchema);

export type CelestrakTleRecordParsed = z.infer<typeof CelestrakTleRecordSchema>;
