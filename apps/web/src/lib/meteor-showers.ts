import { equatorialToHorizontal, julianDay } from '@astranet/shared';
import { isAboveHorizon } from './semantic-zoom';

/**
 * Major annual meteor showers, transcribed from Table 5 ("Working List of
 * Visual Meteor Showers") of the International Meteor Organization's 2026
 * Meteor Shower Calendar, IMO INFO(3-25), compiled by Jürgen Rendtel:
 * https://www.imo.net/files/meteor-shower/cal2026.pdf
 *
 * Radiant coordinates are the J2000 positions the IMO lists for each shower's
 * maximum, in degrees; activity windows and maximum dates are the IMO's own,
 * and the calendar notes the maximum dates are accurate for 2026 specifically
 * (they drift by up to a day between years, since they track solar longitude
 * rather than the civil calendar). ZHR is the IMO's figure for recent
 * observed returns — `'variable'` where the shower's rate is genuinely
 * unpredictable, not where a value was unavailable.
 *
 * Two entries from the IMO list are deliberately absent: the Daytime Arietids
 * and Daytime Sextantids are radio showers whose radiants are near the Sun,
 * so a visual sky view has nothing honest to draw for them. The Antihelion
 * Source is also absent: it is a diffuse region whose radiant sweeps ~1°/day
 * along the ecliptic rather than a fixed point, so a single coordinate pair
 * would misrepresent it.
 *
 * Showers below ZHR 5 with no variable-outburst history are omitted — at
 * those rates there is nothing for an observer to look for.
 */
export interface MeteorShower {
  /** IAU three-letter code. */
  code: string;
  /** Display name, uppercase to match the other diegetic marker labels. */
  name: string;
  /** J2000 radiant right ascension at maximum, degrees. */
  radiantRaDeg: number;
  /** J2000 radiant declination at maximum, degrees. */
  radiantDecDeg: number;
  /** First day of the activity window (1-indexed month). */
  activeStart: { month: number; day: number };
  /** Last day of the activity window, inclusive. Wraps the year end when before the start. */
  activeEnd: { month: number; day: number };
  /** Date of maximum for 2026. */
  peak: { month: number; day: number };
  /** Geocentric velocity, km/s. */
  velocityKmS: number;
  /** Zenithal hourly rate at maximum, or 'variable' for outburst-prone showers. */
  zhr: number | 'variable';
}

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  {
    code: 'QUA',
    name: 'QUADRANTIDS',
    radiantRaDeg: 230,
    radiantDecDeg: 49,
    activeStart: { month: 12, day: 28 },
    activeEnd: { month: 1, day: 12 },
    peak: { month: 1, day: 3 },
    velocityKmS: 41,
    zhr: 80,
  },
  {
    code: 'ACE',
    name: 'ALPHA CENTAURIDS',
    radiantRaDeg: 211,
    radiantDecDeg: -58,
    activeStart: { month: 1, day: 31 },
    activeEnd: { month: 2, day: 20 },
    peak: { month: 2, day: 8 },
    velocityKmS: 58,
    zhr: 6,
  },
  {
    code: 'LYR',
    name: 'APRIL LYRIDS',
    radiantRaDeg: 271,
    radiantDecDeg: 34,
    activeStart: { month: 4, day: 14 },
    activeEnd: { month: 4, day: 30 },
    peak: { month: 4, day: 22 },
    velocityKmS: 49,
    zhr: 18,
  },
  {
    code: 'PPU',
    name: 'PI PUPPIDS',
    radiantRaDeg: 110,
    radiantDecDeg: -45,
    activeStart: { month: 4, day: 15 },
    activeEnd: { month: 4, day: 28 },
    peak: { month: 4, day: 24 },
    velocityKmS: 18,
    zhr: 'variable',
  },
  {
    code: 'ETA',
    name: 'ETA AQUARIIDS',
    radiantRaDeg: 338,
    radiantDecDeg: -1,
    activeStart: { month: 4, day: 19 },
    activeEnd: { month: 5, day: 28 },
    peak: { month: 5, day: 6 },
    velocityKmS: 66,
    zhr: 50,
  },
  {
    code: 'JBO',
    name: 'JUNE BOOTIDS',
    radiantRaDeg: 221,
    radiantDecDeg: 48,
    activeStart: { month: 6, day: 22 },
    activeEnd: { month: 7, day: 2 },
    peak: { month: 6, day: 22 },
    velocityKmS: 18,
    zhr: 'variable',
  },
  {
    code: 'GDR',
    name: 'JULY GAMMA DRACONIDS',
    radiantRaDeg: 280,
    radiantDecDeg: 51,
    activeStart: { month: 7, day: 25 },
    activeEnd: { month: 7, day: 31 },
    peak: { month: 7, day: 28 },
    velocityKmS: 27,
    zhr: 5,
  },
  {
    code: 'SDA',
    name: 'SOUTHERN DELTA AQUARIIDS',
    radiantRaDeg: 340,
    radiantDecDeg: -16,
    activeStart: { month: 7, day: 12 },
    activeEnd: { month: 8, day: 23 },
    peak: { month: 7, day: 31 },
    velocityKmS: 41,
    zhr: 25,
  },
  {
    code: 'CAP',
    name: 'ALPHA CAPRICORNIDS',
    radiantRaDeg: 307,
    radiantDecDeg: -10,
    activeStart: { month: 7, day: 3 },
    activeEnd: { month: 8, day: 15 },
    peak: { month: 7, day: 31 },
    velocityKmS: 23,
    zhr: 5,
  },
  {
    code: 'ERI',
    name: 'UPSILON ERIDANIDS',
    radiantRaDeg: 41,
    radiantDecDeg: -11,
    activeStart: { month: 7, day: 31 },
    activeEnd: { month: 8, day: 19 },
    peak: { month: 8, day: 7 },
    velocityKmS: 64,
    zhr: 'variable',
  },
  {
    code: 'PER',
    name: 'PERSEIDS',
    radiantRaDeg: 48,
    radiantDecDeg: 58,
    activeStart: { month: 7, day: 17 },
    activeEnd: { month: 8, day: 24 },
    peak: { month: 8, day: 13 },
    velocityKmS: 59,
    zhr: 100,
  },
  {
    code: 'AUR',
    name: 'AURIGIDS',
    radiantRaDeg: 91,
    radiantDecDeg: 39,
    activeStart: { month: 8, day: 28 },
    activeEnd: { month: 9, day: 5 },
    peak: { month: 9, day: 1 },
    velocityKmS: 66,
    zhr: 6,
  },
  {
    code: 'SPE',
    name: 'SEPTEMBER EPSILON PERSEIDS',
    radiantRaDeg: 48,
    radiantDecDeg: 40,
    activeStart: { month: 9, day: 5 },
    activeEnd: { month: 9, day: 21 },
    peak: { month: 9, day: 9 },
    velocityKmS: 64,
    zhr: 8,
  },
  {
    code: 'SLY',
    name: 'SEPTEMBER LYNCIDS',
    radiantRaDeg: 113,
    radiantDecDeg: 56,
    activeStart: { month: 9, day: 10 },
    activeEnd: { month: 10, day: 8 },
    peak: { month: 9, day: 13 },
    velocityKmS: 60,
    zhr: 5,
  },
  {
    code: 'OCT',
    name: 'OCTOBER CAMELOPARDALIDS',
    radiantRaDeg: 164,
    radiantDecDeg: 79,
    activeStart: { month: 10, day: 5 },
    activeEnd: { month: 10, day: 6 },
    peak: { month: 10, day: 6 },
    velocityKmS: 47,
    zhr: 5,
  },
  {
    code: 'DRA',
    name: 'DRACONIDS',
    radiantRaDeg: 262,
    radiantDecDeg: 54,
    activeStart: { month: 10, day: 6 },
    activeEnd: { month: 10, day: 10 },
    peak: { month: 10, day: 9 },
    velocityKmS: 20,
    zhr: 5,
  },
  {
    code: 'ORI',
    name: 'ORIONIDS',
    radiantRaDeg: 95,
    radiantDecDeg: 16,
    activeStart: { month: 10, day: 2 },
    activeEnd: { month: 11, day: 7 },
    peak: { month: 10, day: 21 },
    velocityKmS: 66,
    zhr: 20,
  },
  {
    code: 'STA',
    name: 'SOUTHERN TAURIDS',
    radiantRaDeg: 52,
    radiantDecDeg: 15,
    activeStart: { month: 9, day: 20 },
    activeEnd: { month: 11, day: 20 },
    peak: { month: 11, day: 5 },
    velocityKmS: 27,
    zhr: 7,
  },
  {
    code: 'NTA',
    name: 'NORTHERN TAURIDS',
    radiantRaDeg: 58,
    radiantDecDeg: 22,
    activeStart: { month: 10, day: 20 },
    activeEnd: { month: 12, day: 10 },
    peak: { month: 11, day: 12 },
    velocityKmS: 29,
    zhr: 5,
  },
  {
    code: 'LEO',
    name: 'LEONIDS',
    radiantRaDeg: 152,
    radiantDecDeg: 22,
    activeStart: { month: 11, day: 6 },
    activeEnd: { month: 11, day: 30 },
    peak: { month: 11, day: 17 },
    velocityKmS: 71,
    zhr: 15,
  },
  {
    code: 'AMO',
    name: 'ALPHA MONOCEROTIDS',
    radiantRaDeg: 117,
    radiantDecDeg: 1,
    activeStart: { month: 11, day: 15 },
    activeEnd: { month: 11, day: 25 },
    peak: { month: 11, day: 22 },
    velocityKmS: 65,
    zhr: 'variable',
  },
  {
    code: 'PHO',
    name: 'PHOENICIDS',
    radiantRaDeg: 8,
    radiantDecDeg: -27,
    activeStart: { month: 12, day: 1 },
    activeEnd: { month: 12, day: 5 },
    peak: { month: 12, day: 2 },
    velocityKmS: 15,
    zhr: 'variable',
  },
  {
    code: 'PUP',
    name: 'PUPPID-VELIDS',
    radiantRaDeg: 123,
    radiantDecDeg: -45,
    activeStart: { month: 12, day: 1 },
    activeEnd: { month: 12, day: 15 },
    peak: { month: 12, day: 7 },
    velocityKmS: 44,
    zhr: 10,
  },
  {
    code: 'HYD',
    name: 'SIGMA HYDRIDS',
    radiantRaDeg: 125,
    radiantDecDeg: 2,
    activeStart: { month: 12, day: 3 },
    activeEnd: { month: 12, day: 20 },
    peak: { month: 12, day: 9 },
    velocityKmS: 58,
    zhr: 7,
  },
  {
    code: 'GEM',
    name: 'GEMINIDS',
    radiantRaDeg: 112,
    radiantDecDeg: 33,
    activeStart: { month: 12, day: 4 },
    activeEnd: { month: 12, day: 20 },
    peak: { month: 12, day: 14 },
    velocityKmS: 35,
    zhr: 150,
  },
  {
    code: 'URS',
    name: 'URSIDS',
    radiantRaDeg: 217,
    radiantDecDeg: 76,
    activeStart: { month: 12, day: 17 },
    activeEnd: { month: 12, day: 26 },
    peak: { month: 12, day: 22 },
    velocityKmS: 33,
    zhr: 10,
  },
];

/** A shower's radiant resolved to the observer's horizon frame, at one instant. */
export interface ShowerRadiant {
  shower: MeteorShower;
  altitudeDeg: number;
  azimuthDeg: number;
}

/** Month/day as a comparable MMDD integer. */
function monthDayKey(month: number, day: number): number {
  return month * 100 + day;
}

/**
 * The observer's local calendar (month, day) at `utcDate`, derived from
 * longitude via mean solar time (UTC + observerLonEastDeg/15 hours) —
 * deliberately not `Date.prototype.getMonth`/`getDate`, which read the
 * *executing browser's* own timezone, not the observer's chosen location.
 * This app has no timezone/political-boundary database, only lat/lon, so
 * mean solar time — the same "15deg of longitude = 1 hour" relationship
 * FORMULAS.md's Local Sidereal Time already uses for star positions — is
 * the honest, computable-from-what-we-have local-date approximation. It
 * can disagree with a real civil clock by up to ~30min within one
 * standard timezone, but that's far inside a single calendar day.
 */
function localCalendarDate(
  utcDate: Date,
  observerLonEastDeg: number,
): { month: number; day: number } {
  const localMs = utcDate.getTime() + (observerLonEastDeg / 15) * 3_600_000;
  const local = new Date(localMs);
  return { month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

/**
 * Is `date` inside the shower's activity window, for an observer at
 * `observerLonEastDeg`? Both ends are inclusive — the IMO quotes windows
 * as whole days ("Jul 17-Aug 24"), so a date landing exactly on either
 * boundary is an active night.
 *
 * Windows that wrap the year end (the Quadrantids run Dec 28 - Jan 12) are
 * matched as "on or after the start, OR on or before the end". Comparison is
 * on month/day only: the windows repeat annually, and using day-of-year
 * instead would shift every window by one day across a leap boundary.
 *
 * The observer's *local* calendar date is what counts — a shower is a
 * property of tonight where you are standing, not of UTC, and not of
 * wherever the browser rendering this happens to physically be.
 */
export function isShowerActive(
  shower: MeteorShower,
  date: Date,
  observerLonEastDeg: number,
): boolean {
  const { month, day } = localCalendarDate(date, observerLonEastDeg);
  const today = monthDayKey(month, day);
  const start = monthDayKey(shower.activeStart.month, shower.activeStart.day);
  const end = monthDayKey(shower.activeEnd.month, shower.activeEnd.day);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

/** Every shower whose activity window contains `date` at the observer's location, in table order. */
export function activeShowers(date: Date, observerLonEastDeg: number): MeteorShower[] {
  return METEOR_SHOWERS.filter((s) => isShowerActive(s, date, observerLonEastDeg));
}

/** ZHR as a sortable number; 'variable' sorts as a modest but non-zero rate. */
function rateRank(zhr: number | 'variable'): number {
  return zhr === 'variable' ? 5 : zhr;
}

/**
 * The one shower worth drawing right now: active, radiant above the horizon,
 * and — when several qualify, as in late July when the Perseids, Southern
 * delta Aquariids and alpha Capricornids all overlap — the one with the
 * highest rate. Returns null when nothing qualifies, which is the normal
 * case for most of the year; the caller draws no marker rather than
 * inventing one.
 *
 * Horizon test and coordinate transform are the shared engines StarField and
 * the planet markers already use, so a radiant sitting on the horizon is
 * judged by exactly the same refraction allowance as everything else.
 */
export function visibleShowerRadiant(
  date: Date,
  observerLatDeg: number,
  observerLonEastDeg: number,
): ShowerRadiant | null {
  const jd = julianDay(date);
  let best: ShowerRadiant | null = null;

  for (const shower of activeShowers(date, observerLonEastDeg)) {
    const horiz = equatorialToHorizontal(
      shower.radiantRaDeg,
      shower.radiantDecDeg,
      observerLatDeg,
      observerLonEastDeg,
      jd,
    );
    if (!isAboveHorizon(horiz.altitudeDeg)) continue;
    if (best === null || rateRank(shower.zhr) > rateRank(best.shower.zhr)) {
      best = { shower, altitudeDeg: horiz.altitudeDeg, azimuthDeg: horiz.azimuthDeg };
    }
  }

  return best;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "Aug 13" — for the marker's measurement line. */
export function formatShowerDate(md: { month: number; day: number }): string {
  return `${MONTH_NAMES[md.month - 1]} ${md.day}`;
}
