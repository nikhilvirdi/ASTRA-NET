import { z } from 'zod';

export const OpenMeteoHourlySchema = z.object({
  time: z.array(z.string()),
  cloudcover: z.array(z.number()),
  visibility: z.array(z.number()),
});

export const OpenMeteoResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: OpenMeteoHourlySchema,
});

export type OpenMeteoResponse = z.infer<typeof OpenMeteoResponseSchema>;
