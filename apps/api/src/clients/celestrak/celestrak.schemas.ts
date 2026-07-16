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
