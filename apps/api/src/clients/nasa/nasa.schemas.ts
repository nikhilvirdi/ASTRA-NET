import { z } from 'zod';

// ---------------------------------------------------------------------------
// DONKI CME
// ---------------------------------------------------------------------------
export const DonkiCmeAnalysisSchema = z.object({
  isMostAccurate: z.boolean().optional(),
  time21_5: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  halfAngle: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  type: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});

export const DonkiCmeEventSchema = z.object({
  activityID: z.string(),
  startTime: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  cmeAnalyses: z.array(DonkiCmeAnalysisSchema).nullable().optional(),
});

export const DonkiCmeResponseSchema = z.array(DonkiCmeEventSchema);

// ---------------------------------------------------------------------------
// DONKI FLR (Solar Flares)
// ---------------------------------------------------------------------------
export const DonkiFlrEventSchema = z.object({
  flrID: z.string(),
  beginTime: z.string().nullable().optional(),
  peakTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  classType: z.string().nullable().optional(),
  sourceLocation: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});

export const DonkiFlrResponseSchema = z.array(DonkiFlrEventSchema);

// ---------------------------------------------------------------------------
// NeoWs Feed
// ---------------------------------------------------------------------------
export const NeowsEstimatedDiameterSchema = z.object({
  kilometers: z.object({
    estimated_diameter_min: z.number(),
    estimated_diameter_max: z.number(),
  }),
});

export const NeowsCloseApproachDataSchema = z.object({
  close_approach_date: z.string(),
  close_approach_date_full: z.string().nullable().optional(),
  epoch_date_close_approach: z.number(),
  relative_velocity: z.object({
    kilometers_per_second: z.string(),
    kilometers_per_hour: z.string(),
    miles_per_hour: z.string(),
  }),
  miss_distance: z.object({
    astronomical: z.string(),
    lunar: z.string(),
    kilometers: z.string(),
    miles: z.string(),
  }),
  orbiting_body: z.string(),
});

export const NeowsObjectSchema = z.object({
  id: z.string(),
  neo_reference_id: z.string(),
  name: z.string(),
  nasa_jpl_url: z.string(),
  absolute_magnitude_h: z.number().nullable().optional(),
  estimated_diameter: NeowsEstimatedDiameterSchema,
  is_potentially_hazardous_asteroid: z.boolean(),
  close_approach_data: z.array(NeowsCloseApproachDataSchema),
  is_sentry_object: z.boolean(),
});

export const NeowsFeedResponseSchema = z.object({
  element_count: z.number(),
  near_earth_objects: z.record(z.string(), z.array(NeowsObjectSchema)),
});

// Infered Types
export type DonkiCmeResponse = z.infer<typeof DonkiCmeResponseSchema>;
export type DonkiFlrResponse = z.infer<typeof DonkiFlrResponseSchema>;
export type NeowsFeedResponse = z.infer<typeof NeowsFeedResponseSchema>;
