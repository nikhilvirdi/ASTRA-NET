/**
 * `buildLog` — the pure core of `/api/log` (WORKPLAN.md Phase 10,
 * DESIGN_SPEC.md §13).
 *
 * Same shape as `build-brief.ts`/`build-best-spot.ts`: takes rows already
 * fetched by the HTTP layer plus `now`, does no I/O and reads no clock, so
 * every statistic is unit-testable without a database.
 *
 * Reads the existing Phase 6 `SkyLogEntry` rows — nothing here writes, and
 * no statistic is invented. `/api/sky-log` remains the CRUD resource for
 * creating and deleting individual entries; this module only composes the
 * read-only page view over the same rows.
 *
 * ## The "observing night" boundary
 *
 * DESIGN_SPEC.md §13's headline stat is *nights* observed, not calendar
 * days, so an entry at 01:00 belongs to the night that began the previous
 * evening. The boundary is placed at 12:00 UTC, which is not an invention:
 * it is the same convention FORMULAS.md §3's Julian Date already uses
 * (JD increments at noon precisely so a night carries one integer day
 * number). A true per-observer boundary would need the observer's
 * timezone, which `SCHEMA.md` does not store — so this is UTC-anchored and
 * exact only near the prime meridian. Logged in DECISIONS.md.
 */

import type { SkyLogEntry } from '@prisma/client';

const NIGHT_BOUNDARY_OFFSET_MS = 12 * 3_600_000;

/** The `iss_pass` event type as written by `/api/sky-log`'s closed enum. */
const ISS_PASS_EVENT = 'iss_pass';
/** The `aurora` event type as written by `/api/sky-log`'s closed enum. */
const AURORA_EVENT = 'aurora';

export interface LogEntry {
  id: string;
  eventType: string;
  /** UTC ISO. */
  timestamp: string;
  /**
   * `'manual'` or `'auto'` — DESIGN_SPEC.md §13 renders these with a
   * filled versus hollow marker, "a small honest distinction between what
   * the system observed and what the user claimed".
   */
  source: string;
  details: unknown;
  /** The observing night this entry belongs to, as a `YYYY-MM-DD` UTC date. */
  night: string;
}

export interface LogStats {
  /** ARCHITECTURE.md §8 / WORKPLAN.md Phase 10's "total". */
  totalSightings: number;
  /** DESIGN_SPEC.md §13's first headline figure. */
  nightsObserved: number;
  /** DESIGN_SPEC.md §13's second headline figure. */
  issPassesCaught: number;
  /** UTC ISO of the most recent aurora entry, or null if never. */
  lastAuroraSighting: string | null;
  /** Consecutive observing nights ending tonight or last night; 0 if the run is broken. */
  currentStreakNights: number;
}

export interface LogPayload {
  generatedAt: string;
  stats: LogStats;
  /** Newest first. Month grouping is DESIGN_SPEC.md §13's presentation concern, not this API's. */
  entries: LogEntry[];
}

/** `YYYY-MM-DD` of the observing night a timestamp falls in — see the header note. */
export function observingNight(timestamp: Date): string {
  return new Date(timestamp.getTime() - NIGHT_BOUNDARY_OFFSET_MS).toISOString().slice(0, 10);
}

/** Steps one observing night backwards from a `YYYY-MM-DD` key. */
function previousNight(night: string): string {
  const asDate = new Date(`${night}T00:00:00.000Z`);
  return new Date(asDate.getTime() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Consecutive observing nights with at least one entry, counted back from
 * the current night.
 *
 * A run that ended last night still counts as current — the night is not
 * over until it is over, so a user who logged something last night but
 * hasn't yet tonight has not "broken" anything. A run whose most recent
 * night is older than that is finished, and reports 0 rather than
 * silently reporting a stale historical streak as if it were live.
 */
export function currentStreak(nights: Set<string>, now: Date): number {
  const tonight = observingNight(now);
  const lastNight = previousNight(tonight);

  let cursor: string;
  if (nights.has(tonight)) {
    cursor = tonight;
  } else if (nights.has(lastNight)) {
    cursor = lastNight;
  } else {
    return 0;
  }

  let streak = 0;
  while (nights.has(cursor)) {
    streak += 1;
    cursor = previousNight(cursor);
  }
  return streak;
}

export function buildLog(entries: SkyLogEntry[], now: Date): LogPayload {
  const sorted = [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const nights = new Set<string>();
  let issPassesCaught = 0;
  let lastAuroraSighting: string | null = null;

  for (const entry of sorted) {
    nights.add(observingNight(entry.timestamp));
    if (entry.eventType === ISS_PASS_EVENT) issPassesCaught += 1;
    // `sorted` is newest-first, so the first aurora seen is the latest one.
    if (entry.eventType === AURORA_EVENT && lastAuroraSighting === null) {
      lastAuroraSighting = entry.timestamp.toISOString();
    }
  }

  return {
    generatedAt: now.toISOString(),
    stats: {
      totalSightings: sorted.length,
      nightsObserved: nights.size,
      issPassesCaught,
      lastAuroraSighting,
      currentStreakNights: currentStreak(nights, now),
    },
    entries: sorted.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      timestamp: entry.timestamp.toISOString(),
      source: entry.source,
      details: entry.details,
      night: observingNight(entry.timestamp),
    })),
  };
}
