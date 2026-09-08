import type { DailyBrief } from './api';
import { BORTLE_DESCRIPTIONS, formatBortleScale } from './sky-quality';
import { activeShowers, localCalendarDate, selectPrimaryShower } from './meteor-showers';

/**
 * Which real event the Daily Brief headline is reporting. No longer a
 * priority order (see `selectHeadline`'s header comment) — the union is now
 * just the set of things a headline can be about.
 */
export type HeadlineKind =
  | 'aurora-chance'
  | 'cme-inbound'
  | 'iss-pass'
  | 'neo-approach'
  | 'planet-high'
  | 'moon-phase'
  | 'sky-quality'
  | 'cloud-cover'
  | 'meteor-shower'
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

/** One hour, in milliseconds — every hour-scale threshold/bucket below is a multiple of this. */
const MS_PER_HOUR = 3_600_000;

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

/**
 * A CME earns the headline only when it is genuinely imminent — arriving
 * within a few hours — not merely "tracked, ETA some days out." A slow,
 * far-off CME is real, but it is not *news* for the next several days it
 * takes to arrive; surfacing it as urgent for that whole stretch is what
 * made the old headline go stale. `aurora.leadHours` must be known (a CME
 * with no computed ETA yet is not confirmed imminent either) and within this
 * window for `cme-inbound` to become a candidate at all.
 */
export const CME_URGENT_LEAD_HOURS = 6;

/**
 * Minimum percentage-point swing between the current hour's cloud cover and
 * the forecast's furthest-out hour for a trend to count as "significant" —
 * worth a headline, not just ordinary hour-to-hour forecast noise.
 */
export const CLOUD_COVER_SIGNIFICANT_SWING_PCT = 40;

/**
 * Above this illuminated fraction, `MeteorShowerCard`'s own gauge calls it a
 * "FULL WASHOUT" — moonlight strong enough that recommending the shower
 * would be misleading even though it is genuinely active and at its peak.
 */
const METEOR_SHOWER_MOON_WASHOUT_FRACTION = 0.75;

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

/** "PERSEIDS" -> "Perseids"; "PI PUPPIDS" -> "Pi Puppids" — for a plain-English sentence, not a diegetic marker label. */
function titleCaseShowerName(name: string): string {
  return name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
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
 * Every real, currently-true candidate the brief supports, and — when more
 * than one is true at once (the common case) — a deterministic hourly
 * rotation among them, so the same visitor genuinely sees different real
 * facts across a night rather than the same highest-priority one for days.
 *
 * This replaced a fixed priority order that always returned the first match
 * (aurora, then CME, then ISS pass, then NEO, then planet, then Moon). That
 * design had two compounding staleness problems:
 *
 *   1. `cme-inbound` had no urgency gate at all — `aurora.hasActiveCme` alone
 *      triggered it, regardless of whether the CME was arriving in 3 hours or
 *      3 days, so a single slow-resolving CME could occupy the headline for
 *      the entire multi-day transit. Fixed below: a CME is now a candidate
 *      only when `leadHours` is known and inside `CME_URGENT_LEAD_HOURS`.
 *   2. Even once a real candidate held the top slot, it stayed there for as
 *      long as it stayed true — there was no rotation, so two visitors (or
 *      the same visitor an hour apart) with the same underlying facts always
 *      saw the identical sentence.
 *
 * Every candidate below reads a value the brief already carries (or, for the
 * meteor-shower candidate, a value derivable from `brief.observer.lonDeg` via
 * the same static almanac `MeteorShowerCard` already uses) — nothing here
 * fetches anything new or fabricates a fact that isn't literally true right
 * now. When nothing is true, `quiet` is a genuine last resort, not a
 * rotation member — it never displaces a real fact, and a real fact never
 * displaces it either.
 */
export function selectHeadline(
  brief: DailyBrief | null,
  now: Date,
  formatClock: (date: Date) => string,
): HeadlineSelection {
  if (brief === null) {
    return quietHeadline();
  }

  const candidates: HeadlineSelection[] = [];

  // ── Aurora chance ──────────────────────────────────────────────────────────
  const aurora = brief.spaceWeather?.data?.aurora ?? null;
  if (aurora !== null && aurora.strengthFactor > 0) {
    // Same 1-in-N framing the card uses, floored at 1 in 2 so a near-certain
    // storm never reads as a coin flip dressed up as a bigger number.
    const ratio = Math.max(2, Math.round(1 / aurora.strengthFactor));
    candidates.push(
      compose('aurora-chance', 'A solar storm gives you a ', `1 in ${ratio}`, ' chance of aurora.'),
    );
  }

  // ── Inbound CME, only when genuinely imminent ───────────────────────────────
  if (
    aurora !== null &&
    aurora.hasActiveCme &&
    aurora.leadHours !== null &&
    aurora.leadHours > 0 &&
    aurora.leadHours <= CME_URGENT_LEAD_HOURS
  ) {
    candidates.push(
      compose(
        'cme-inbound',
        'A coronal mass ejection is inbound, arriving in about ',
        `${Math.round(aurora.leadHours)} hours`,
        ' — too far south to show aurora here.',
      ),
    );
  }

  // ── ISS pass ────────────────────────────────────────────────────────────────
  const pass = brief.iss?.data?.nextPass ?? null;
  if (pass !== null) {
    const startMs = pass.startUtc * 1000;
    const endMs = pass.endUtc * 1000;
    const withinWindow =
      endMs >= now.getTime() && startMs <= now.getTime() + ISS_PASS_WINDOW_HOURS * MS_PER_HOUR;
    if (withinWindow) {
      candidates.push(
        compose('iss-pass', 'The ISS crosses your sky at ', formatClock(new Date(startMs)), '.'),
      );
    }
  }

  // ── NEO close approach ──────────────────────────────────────────────────────
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
      candidates.push(
        compose('neo-approach', `Asteroid ${neo.name} ${when}`, distance, `.${hazard}`),
      );
    }
  }

  // ── A well-placed planet ────────────────────────────────────────────────────
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
      candidates.push(
        compose(
          'planet-high',
          `${PLANET_LABEL[best.key]} is well placed tonight, `,
          `${Math.round(best.altitudeDeg)}°`,
          ' above your horizon.',
        ),
      );
    }
  }

  // ── Moon at a peak phase ─────────────────────────────────────────────────────
  const moon = sky?.moon ?? null;
  if (moon !== null && moon !== undefined) {
    if (moon.phaseName === 'full') {
      candidates.push(
        compose(
          'moon-phase',
          'A full Moon tonight, ',
          `${Math.round(moon.illuminatedFraction * 100)}%`,
          ' lit — bright enough to wash out the faint sky.',
        ),
      );
    } else if (moon.phaseName === 'new') {
      candidates.push(
        compose(
          'moon-phase',
          'A new Moon tonight',
          null,
          ' — the darkest sky you will get this month.',
        ),
      );
    }
  }

  // ── Sky quality (Bortle) ────────────────────────────────────────────────────
  const bortle = sky?.skyQualityBortle ?? null;
  if (bortle !== null && formatBortleScale(bortle) !== null) {
    const rounded = Math.round(bortle);
    candidates.push(
      compose(
        'sky-quality',
        'Sky quality here is Bortle ',
        `${rounded}`,
        ` — ${BORTLE_DESCRIPTIONS[rounded]}.`,
      ),
    );
  }

  // ── Cloud cover clearing or worsening significantly ─────────────────────────
  const cloudCover = sky?.cloudCover ?? null;
  if (cloudCover !== null && cloudCover.length >= 2) {
    const first = cloudCover[0]!;
    const last = cloudCover[cloudCover.length - 1]!;
    const delta = last.cloudCoverPercent - first.cloudCoverPercent;
    if (delta <= -CLOUD_COVER_SIGNIFICANT_SWING_PCT) {
      candidates.push(
        compose(
          'cloud-cover',
          'Clouds are clearing, expected clear by ',
          formatClock(new Date(last.timeUtc)),
          '.',
        ),
      );
    } else if (delta >= CLOUD_COVER_SIGNIFICANT_SWING_PCT) {
      candidates.push(
        compose(
          'cloud-cover',
          'Clouds are moving in, expected overcast by ',
          formatClock(new Date(last.timeUtc)),
          '.',
        ),
      );
    }
  }

  // ── An active shower peaking tonight or tomorrow, moon permitting ───────────
  const shower = selectPrimaryShower(activeShowers(now, brief.observer.lonDeg));
  if (shower !== null) {
    const todayLocal = localCalendarDate(now, brief.observer.lonDeg);
    const tomorrowLocal = localCalendarDate(
      new Date(now.getTime() + 24 * MS_PER_HOUR),
      brief.observer.lonDeg,
    );
    const isPeakToday =
      todayLocal.month === shower.peak.month && todayLocal.day === shower.peak.day;
    const isPeakTomorrow =
      tomorrowLocal.month === shower.peak.month && tomorrowLocal.day === shower.peak.day;
    const moonWashedOut =
      moon != null && moon.illuminatedFraction > METEOR_SHOWER_MOON_WASHOUT_FRACTION;

    if ((isPeakToday || isPeakTomorrow) && !moonWashedOut) {
      const name = titleCaseShowerName(shower.name);
      const when = isPeakToday ? 'peaks tonight' : 'peaks tomorrow night';
      candidates.push(
        typeof shower.zhr === 'number'
          ? compose(
              'meteor-shower',
              `The ${name} ${when} — up to `,
              `${shower.zhr} meteors`,
              ' an hour in a dark sky.',
            )
          : compose(
              'meteor-shower',
              `The ${name} ${when}`,
              null,
              ', at a variable, sometimes unpredictable rate.',
            ),
      );
    }
  }

  if (candidates.length === 0) {
    return quietHeadline();
  }

  // Deterministic hourly rotation: same real facts, different order across
  // the day and across visitors — never a fabricated candidate, only a
  // different pick among the ones already confirmed true above.
  const hourBucket = Math.floor(now.getTime() / MS_PER_HOUR);
  return candidates[hourBucket % candidates.length]!;
}

function quietHeadline(): HeadlineSelection {
  return compose(
    'quiet',
    'No storm, station pass, or close approach on the board',
    null,
    ' — a quiet sky to just look at.',
  );
}
