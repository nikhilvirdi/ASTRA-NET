import type { DailyBrief } from './api';

/**
 * Which real event the Daily Brief headline is reporting. The order of the
 * union mirrors the priority order the selector walks.
 */
export type HeadlineKind =
  | 'aurora-chance'
  | 'cme-inbound'
  | 'iss-pass'
  | 'neo-approach'
  | 'planet-high'
  | 'moon-phase'
  | 'quiet';

/**
 * A composed headline, split around the one value worth setting in mono.
 * The caller renders `lead + <mono>emphasis</mono> + tail`; `text` is the same
 * sentence flattened, for tests and for anything that needs a plain string.
 */
export interface HeadlineSelection {
  kind: HeadlineKind;
  lead: string;
  /** null when the sentence carries no single number worth emphasising. */
  emphasis: string | null;
  tail: string;
  text: string;
}

/**
 * A pass further out than this is real but not news — it belongs to tomorrow's
 * brief, not tonight's headline, and holding the slot for it would bury a
 * close approach or a well-placed planet happening right now.
 */
export const ISS_PASS_WINDOW_HOURS = 24;

/**
 * Miss distance, in lunar distances, below which an approach is worth leading
 * with. ~10 LD is about 3.8 million km: comfortably far, but close enough that
 * the object is being actively tracked and is the nearest thing to Earth in
 * the current NEO window.
 */
export const NEO_NOTABLE_LD = 10;

/**
 * Altitude above which a planet is genuinely well placed rather than merely
 * "up" — high enough to clear most horizon murk and local obstructions.
 */
export const PLANET_HIGH_ALTITUDE_DEG = 30;

/** Naked-eye planets, ordered brightest first — the tie-break when two are equally high. */
const PLANET_ORDER = ['venus', 'jupiter', 'mars', 'saturn', 'mercury'] as const;
type PlanetKey = (typeof PLANET_ORDER)[number];

const PLANET_LABEL: Record<PlanetKey, string> = {
  venus: 'Venus',
  jupiter: 'Jupiter',
  mars: 'Mars',
  saturn: 'Saturn',
  mercury: 'Mercury',
};

/** Local calendar date as YYYY-MM-DD — the observer's day, not UTC's. */
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compose(
  kind: HeadlineKind,
  lead: string,
  emphasis: string | null,
  tail: string,
): HeadlineSelection {
  return { kind, lead, emphasis, tail, text: `${lead}${emphasis ?? ''}${tail}` };
}

/**
 * The single most notable real thing in the sky right now, in a fixed priority
 * order:
 *
 *   1. aurora-chance  — a solar storm with a non-zero chance at this latitude
 *   2. cme-inbound    — a CME is en route even though no aurora is predicted here
 *   3. iss-pass       — a visible pass inside the next ISS_PASS_WINDOW_HOURS
 *   4. neo-approach   — a close approach today, or inside NEO_NOTABLE_LD
 *   5. planet-high    — a naked-eye planet above PLANET_HIGH_ALTITUDE_DEG after dark
 *   6. moon-phase     — the Moon at full or new
 *   7. quiet          — none of the above is true
 *
 * Every branch reads values the brief already carries; nothing here re-derives
 * astronomy. The quiet branch is a genuine last resort — it only fires when
 * all six checks above have found nothing real to report.
 *
 * `formatClock` renders a pass time in the reader's clock preference, so this
 * stays deterministic: same brief, same instant, same formatter, same sentence.
 */
export function selectHeadline(
  brief: DailyBrief | null,
  now: Date,
  formatClock: (date: Date) => string,
): HeadlineSelection {
  if (brief === null) {
    return quietHeadline();
  }

  // ── 1/2. Space weather ────────────────────────────────────────────────────
  const aurora = brief.spaceWeather?.data?.aurora ?? null;
  if (aurora !== null) {
    if (aurora.strengthFactor > 0) {
      // Same 1-in-N framing the card uses, floored at 1 in 2 so a near-certain
      // storm never reads as a coin flip dressed up as a bigger number.
      const ratio = Math.max(2, Math.round(1 / aurora.strengthFactor));
      return compose(
        'aurora-chance',
        'A solar storm gives you a ',
        `1 in ${ratio}`,
        ' chance of aurora.',
      );
    }
    if (aurora.hasActiveCme) {
      // A CME is tracked and inbound even though the oval is not forecast to
      // reach this latitude. Worth leading with; worth not overselling.
      if (aurora.leadHours !== null && aurora.leadHours > 0) {
        return compose(
          'cme-inbound',
          'A coronal mass ejection is inbound, arriving in about ',
          `${Math.round(aurora.leadHours)} hours`,
          ' — too far south to show aurora here.',
        );
      }
      return compose(
        'cme-inbound',
        'A coronal mass ejection is inbound',
        null,
        ' — too far south to show aurora here.',
      );
    }
  }

  // ── 3. ISS pass ───────────────────────────────────────────────────────────
  const pass = brief.iss?.data?.nextPass ?? null;
  if (pass !== null) {
    const startMs = pass.startUtc * 1000;
    const endMs = pass.endUtc * 1000;
    const withinWindow =
      endMs >= now.getTime() && startMs <= now.getTime() + ISS_PASS_WINDOW_HOURS * 3_600_000;
    if (withinWindow) {
      return compose(
        'iss-pass',
        'The ISS crosses your sky at ',
        formatClock(new Date(startMs)),
        '.',
      );
    }
  }

  // ── 4. NEO close approach ─────────────────────────────────────────────────
  const neo = brief.neoImagery?.data?.neo ?? null;
  if (neo !== null) {
    const today = localDateKey(now);
    const isToday = neo.closeApproachDate === today;
    const isPast = neo.closeApproachDate < today;
    const isClose = neo.missDistanceLunarDistances <= NEO_NOTABLE_LD;
    if (!isPast && (isToday || isClose)) {
      const distance = `${neo.missDistanceLunarDistances.toFixed(1)} lunar distances`;
      const when = isToday ? 'passes Earth today at ' : 'passes Earth at ';
      const hazard = neo.isPotentiallyHazardous ? ' It is on the potentially-hazardous list.' : '';
      return compose('neo-approach', `Asteroid ${neo.name} ${when}`, distance, `.${hazard}`);
    }
  }

  // ── 5. A well-placed planet ───────────────────────────────────────────────
  const sky = brief.skyAnchor?.data ?? null;
  if (sky !== null && sky.twilightPhase !== 'day') {
    let best: { key: PlanetKey; altitudeDeg: number } | null = null;
    for (const key of PLANET_ORDER) {
      const planet = sky[key];
      if (planet === null || planet === undefined) continue;
      if (planet.altitudeDeg < PLANET_HIGH_ALTITUDE_DEG) continue;
      // Highest wins; PLANET_ORDER settles an exact tie in favour of the brighter.
      if (best === null || planet.altitudeDeg > best.altitudeDeg) {
        best = { key, altitudeDeg: planet.altitudeDeg };
      }
    }
    if (best !== null) {
      return compose(
        'planet-high',
        `${PLANET_LABEL[best.key]} is well placed tonight, `,
        `${Math.round(best.altitudeDeg)}°`,
        ' above your horizon.',
      );
    }
  }

  // ── 6. Moon at a peak phase ───────────────────────────────────────────────
  const moon = sky?.moon ?? null;
  if (moon !== null && moon !== undefined) {
    if (moon.phaseName === 'full') {
      return compose(
        'moon-phase',
        'A full Moon tonight, ',
        `${Math.round(moon.illuminatedFraction * 100)}%`,
        ' lit — bright enough to wash out the faint sky.',
      );
    }
    if (moon.phaseName === 'new') {
      return compose(
        'moon-phase',
        'A new Moon tonight',
        null,
        ' — the darkest sky you will get this month.',
      );
    }
  }

  // ── 7. Genuinely quiet ────────────────────────────────────────────────────
  return quietHeadline();
}

function quietHeadline(): HeadlineSelection {
  return compose(
    'quiet',
    'No storm, station pass, or close approach on the board',
    null,
    ' — a quiet sky to just look at.',
  );
}
