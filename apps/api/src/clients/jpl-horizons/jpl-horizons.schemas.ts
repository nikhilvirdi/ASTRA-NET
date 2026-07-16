import { z } from 'zod';

export const HorizonsResponseSchema = z.object({
  signature: z.object({
    version: z.string(),
    source: z.string(),
  }).optional(),
  result: z.string(),
});

export type HorizonsResponse = z.infer<typeof HorizonsResponseSchema>;
