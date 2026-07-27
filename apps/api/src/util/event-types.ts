/**
 * The single event-type vocabulary shared by the Sky Log and the alert
 * preferences.
 *
 * `/api/sky-log` already had this closed set inline; Phase 10's alert
 * toggles cover the same four real events (WORKPLAN.md Phase 10:
 * "Personalized alerts wiring (ISS/aurora/meteor/NEO)"). Defining a
 * second, parallel set of names for the same things would mean the
 * frontend learning two vocabularies for one concept and the two drifting
 * the first time either changed.
 */

/** Events a user can be alerted about. */
export const ALERTABLE_EVENT_TYPES = [
  'iss_pass',
  'aurora',
  'meteor_shower',
  'neo_approach',
] as const;

/**
 * Everything the Sky Log accepts: the alertable events plus `other`, for
 * anything a user wants to record manually that doesn't fit a category.
 * `other` is deliberately not alertable — nothing can detect it.
 */
export const SKY_LOG_EVENT_TYPES = [...ALERTABLE_EVENT_TYPES, 'other'] as const;

export type AlertableEventType = (typeof ALERTABLE_EVENT_TYPES)[number];
export type SkyLogEventType = (typeof SKY_LOG_EVENT_TYPES)[number];
