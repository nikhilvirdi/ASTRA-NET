/**
 * Zod schemas for `/api/settings` (DESIGN_SPEC.md §15).
 *
 * The response bundles the two things §15's page needs that aren't already
 * their own resource: the alert toggles, and which saved location is the
 * default. Saved locations themselves stay at `/api/locations` — Phase 6
 * already built full CRUD there, and duplicating it under a second path
 * would give the same rows two contracts to drift between.
 */

import { z } from 'zod';
import { ALERTABLE_EVENT_TYPES } from '../util/event-types.js';

/** `{ iss_pass: boolean, aurora: boolean, ... }` — every alertable event, all required. */
export const AlertPreferencesSchema = z.object(
  Object.fromEntries(ALERTABLE_EVENT_TYPES.map((type) => [type, z.boolean()])) as Record<
    (typeof ALERTABLE_EVENT_TYPES)[number],
    z.ZodBoolean
  >,
);

/**
 * The update body. Every key optional so a client can flip one toggle
 * without resending the rest, but at least one required so an empty PUT is
 * a clear 400 rather than a silent no-op the user reads as "saved".
 */
export const UpdateAlertsBodySchema = z
  .object({
    alerts: AlertPreferencesSchema.partial().refine(
      (alerts) => Object.keys(alerts).length > 0,
      'at least one alert preference is required',
    ),
  })
  .strict();

export const SettingsDefaultLocationSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .nullable();

export const SettingsPayloadSchema = z.object({
  alerts: AlertPreferencesSchema,
  /**
   * The user's default saved location, or null if they have none — this is
   * the per-user override that replaces the app's hardcoded default
   * observer position for a logged-in user (ARCHITECTURE.md §8: "logged-out
   * = generic location; logged-in = saved location").
   */
  defaultLocation: SettingsDefaultLocationSchema,
  /**
   * True when no alert can actually be delivered yet — no delivery
   * mechanism exists in ARCHITECTURE.md. Surfaced so DESIGN_SPEC.md §15's
   * ALERTS section can say so plainly instead of implying a toggle does
   * something it currently cannot.
   */
  alertsDeliverable: z.boolean(),
});

export type SettingsPayloadParsed = z.infer<typeof SettingsPayloadSchema>;
