import { z } from 'zod';

export const OpenMeteoHourlySchema = z
  .object({
    time: z.array(z.string()),
    cloudcover: z.array(z.number()),
    visibility: z.array(z.number()),
  })
  .refine((h) => h.cloudcover.length === h.time.length && h.visibility.length === h.time.length, {
    message: 'hourly time/cloudcover/visibility arrays must be the same length',
  });

export const OpenMeteoResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: OpenMeteoHourlySchema,
});

export type OpenMeteoResponse = z.infer<typeof OpenMeteoResponseSchema>;
