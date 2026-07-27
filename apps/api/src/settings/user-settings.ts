/**
 * User preference blob handling for `/api/settings` (WORKPLAN.md Phase 10,
 * DESIGN_SPEC.md §15).
 *
 * `SCHEMA.md` puts preferences in a JSONB `settings` column on `User`
 * rather than in columns, precisely so new toggles need no migration —
 * which means the blob's contents are *untrusted at read time*: a row
 * written by an older or newer build can hold anything. Everything here is
 * therefore parse-don't-assume, with a total function from "whatever is in
 * the column" to a fully-populated, valid preference object.
 *
 * ## Why every alert defaults to off
 *
 * No doc states a default, and there is no alert *delivery* mechanism in
 * ARCHITECTURE.md at all — no push service, no mail transport, nothing
 * that could act on these flags today. Defaulting them to on would record
 * a consent the user never gave, for notifications nothing can yet send.
 * Off is the honest starting state; flipping the default when delivery is
 * actually built is a product decision for the human, logged in
 * DECISIONS.md rather than quietly assumed here.
 */

import { z } from 'zod';
import { ALERTABLE_EVENT_TYPES, type AlertableEventType } from '../util/event-types.js';

export type AlertPreferences = Record<AlertableEventType, boolean>;

export interface UserSettings {
  alerts: AlertPreferences;
}

/** Every alertable event, off. See the header note on why off. */
export function defaultAlertPreferences(): AlertPreferences {
  return Object.fromEntries(ALERTABLE_EVENT_TYPES.map((type) => [type, false])) as AlertPreferences;
}

export function defaultUserSettings(): UserSettings {
  return { alerts: defaultAlertPreferences() };
}

/**
 * Lenient on the way in: unknown keys are ignored and malformed values
 * fall back to the default rather than failing the request. A user must
 * always be able to load their settings page, even if a previous build
 * wrote a shape this one doesn't recognise.
 */
const StoredAlertsSchema = z.record(z.string(), z.unknown()).optional();
const StoredSettingsSchema = z
  .object({ alerts: StoredAlertsSchema })
  .passthrough()
  .nullable()
  .optional();

/**
 * Reads the stored blob into a fully-populated preference object. Total:
 * any input, including `null`, a string, or a shape from a future build,
 * yields valid settings.
 */
export function parseUserSettings(stored: unknown): UserSettings {
  const parsed = StoredSettingsSchema.safeParse(stored);
  const alerts = defaultAlertPreferences();
  if (!parsed.success || parsed.data === null || parsed.data === undefined) {
    return { alerts };
  }

  const storedAlerts = parsed.data.alerts;
  if (storedAlerts !== undefined) {
    for (const type of ALERTABLE_EVENT_TYPES) {
      const value = storedAlerts[type];
      // Only a real boolean counts; a truthy string from a bad write must
      // not silently read as an enabled alert.
      if (typeof value === 'boolean') alerts[type] = value;
    }
  }

  return { alerts };
}

/**
 * Applies a partial alert update onto current settings. Absent keys are
 * left alone, so a client can toggle one alert without having to send —
 * and risk clobbering — the others.
 *
 * Unrecognised keys in the stored blob are preserved by the caller writing
 * back through `mergeIntoStored`, not dropped here.
 */
export function applyAlertUpdate(
  current: UserSettings,
  update: Partial<AlertPreferences>,
): UserSettings {
  const alerts = { ...current.alerts };
  for (const type of ALERTABLE_EVENT_TYPES) {
    const value = update[type];
    if (typeof value === 'boolean') alerts[type] = value;
  }
  return { alerts };
}

/**
 * Produces the JSON to write back, preserving any unrelated keys the blob
 * already held. `SCHEMA.md` expects this column to accumulate preferences
 * over time; a write that dropped a key another feature owns would be a
 * silent data loss across features.
 */
export function mergeIntoStored(stored: unknown, settings: UserSettings): Record<string, unknown> {
  const base =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? { ...(stored as Record<string, unknown>) }
      : {};
  return { ...base, alerts: settings.alerts };
}
