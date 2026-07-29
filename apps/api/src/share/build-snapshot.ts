/**
 * `buildShareSnapshot` — the pure core of `POST /api/share` (WORKPLAN.md
 * Phase 11, DESIGN_SPEC.md §17). Freezes one `DailyBrief` moment into the
 * self-contained blob that `/share/:id` and the OG image both render from.
 *
 * Same "pure core, impure route" layering as `build-brief.ts` and
 * `build-best-spot.ts`: no I/O, no clock read, everything injected. The
 * point of the phase is a *stable* moment, so every value the card will
 * ever show is resolved here, once — including the surface color, which is
 * stored rather than recomputed on read so a card viewed next year cannot
 * disagree with the one that was shared.
 *
 * Nothing is invented. Every string below is composed from a field the
 * Brief already computed; where a datum is missing, the card says less
 * rather than filling the gap.
 */

import { surfaceColorForTwilight, twilightStateForSunAltitude } from '@astranet/shared';
import type { DailyBrief } from '../brief/build-brief.js';
import {
  SHARE_SNAPSHOT_SCHEMA_VERSION,
  type ShareFact,
  type ShareMarker,
  type ShareSnapshot,
} from './share.schemas.js';

/** DESIGN_SPEC.md §5.4 — "Negative signs use a true minus glyph, not a hyphen." */
const TRUE_MINUS = '−';

/**
 * Times render as UTC and say so. The observer's civil timezone is not
 * knowable from `SCHEMA.md` (no timezone is stored, and ARCHITECTURE.md
 * names no timezone service), and Phase 10 already accepted the same
 * UTC-anchored limitation for the Sky Log's night boundary. Labelling the
 * zone is the honest form of that limit; deriving a local clock time from
 * longitude would be a fabricated measurement wearing a real unit.
 */
function formatUtcHm(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}

const MONTHS_SHORT = [
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

function formatUtcDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()] ?? ''}`;
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Signed degrees with a true minus, e.g. `−18.4°` / `+12.4°`. */
export function formatSignedDeg(value: number, decimals = 1): string {
  const fixed = Math.abs(value).toFixed(decimals);
  return `${value < 0 ? TRUE_MINUS : '+'}${fixed}°`;
}

/**
 * An honest coordinate label — never a place name. ARCHITECTURE.md names
 * no geocoder, and Phase 9 already established (DECISIONS.md) that
 * inventing plausible place names is fabricated data.
 */
export function formatObserverLabel(latDeg: number, lonDeg: number): string {
  const lat = `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}

/**
 * Where to look, in words, from the pass's own peak elevation. The
 * thresholds are DESIGN_SPEC.md Part VII's voice applied to a real
 * measurement ("high and bright"), not a physical claim — the exact
 * degrees stay in the mono fact row where a number belongs.
 */
function elevationPhrase(maxElevationDeg: number, maxAzimuthCompass: string): string {
  if (maxElevationDeg >= 60) return 'almost directly overhead';
  if (maxElevationDeg >= 30) return 'high above the horizon';
  return `low on the ${maxAzimuthCompass} horizon`;
}

/**
 * DESIGN_SPEC.md §17's headline — "the answer", one subject, in Part VII's
 * voice. Priority is by how much the event asks of the reader tonight:
 * aurora (rare, actionable, and rated) beats a scheduled ISS pass, which
 * beats an unrated aurora forecast, which beats the Moon.
 *
 * Part VII's "never state a forecast without its confidence" is enforced
 * structurally rather than by wording: an aurora forecast the Causal
 * Engine could not rate (no active CME, so `confidence` is null) cannot
 * take the confident phrasing — it falls to the third form, which says
 * plainly that it is unrated.
 */
export function composeHeadline(brief: DailyBrief, capturedAt: Date): string {
  const aurora = brief.spaceWeather.data?.aurora ?? null;
  const pass = brief.iss.data?.nextPass ?? null;

  if (aurora !== null && aurora.visible && aurora.confidence !== null) {
    const confidencePercent = Math.round(aurora.confidence * 100);
    return `Aurora may reach your sky tonight, at Kp ${aurora.kpPredicted.toFixed(1)} — ${confidencePercent}% confidence.`;
  }

  if (pass !== null) {
    const start = new Date(pass.startUtc * 1000);
    const when = sameUtcDay(start, capturedAt)
      ? formatUtcHm(start)
      : `${formatUtcHm(start)} on ${formatUtcDay(start)}`;
    return `The ISS crosses your sky at ${when}, ${elevationPhrase(pass.maxElevationDeg, pass.maxAzimuthCompass)}.`;
  }

  if (aurora !== null && aurora.visible) {
    return `Aurora may reach your sky tonight, on a forecast Kp of ${aurora.kpPredicted.toFixed(1)} — no active CME to rate it against.`;
  }

  const moon = brief.skyAnchor.data?.moon ?? null;
  if (moon !== null) {
    const litPercent = Math.round(moon.illuminatedFraction * 100);
    return `Tonight, a ${moon.phaseName.toLowerCase()} moon, ${litPercent}% lit.`;
  }

  return `A snapshot of the sky over ${formatObserverLabel(brief.observer.latDeg, brief.observer.lonDeg)}.`;
}

/**
 * DESIGN_SPEC.md §17's "three key measurements as a mono row". No doc
 * says *which* three, so the policy is stated here and logged in
 * DECISIONS.md rather than improvised per render: candidates in descending
 * order of how much they tell you about tonight, first three available.
 *
 * The last three candidates are pure math over observer+time (the Sky
 * Anchor card cannot fail, `build-brief.ts`), so a card always has three
 * real measurements even under a total upstream outage — the row is never
 * padded and never faked.
 */
export function selectFacts(brief: DailyBrief): ShareFact[] {
  const aurora = brief.spaceWeather.data?.aurora ?? null;
  const pass = brief.iss.data?.nextPass ?? null;
  const solarLine = brief.spaceWeather.data?.solarLine ?? null;
  const neo = brief.neoImagery.data?.neo ?? null;
  const skyAnchor = brief.skyAnchor.data ?? null;

  const candidates: (ShareFact | null)[] = [
    pass === null
      ? null
      : { label: 'NEXT ISS PASS', value: formatUtcHm(new Date(pass.startUtc * 1000)) },
    aurora === null ? null : { label: 'KP FORECAST', value: aurora.kpPredicted.toFixed(1) },
    aurora?.confidence == null
      ? null
      : { label: 'CONFIDENCE', value: `${Math.round(aurora.confidence * 100)}%` },
    solarLine?.live.speedKmS == null
      ? null
      : { label: 'SOLAR WIND', value: `${Math.round(solarLine.live.speedKmS)} km/s` },
    neo === null
      ? null
      : {
          label: 'CLOSEST NEO',
          value: `${neo.missDistanceLunarDistances.toFixed(1)} LD`,
        },
    skyAnchor === null
      ? null
      : {
          label: 'MOON',
          value: `${Math.round(skyAnchor.moon.illuminatedFraction * 100)}% LIT`,
        },
    skyAnchor === null
      ? null
      : { label: 'SUN ALTITUDE', value: formatSignedDeg(skyAnchor.sunAltitudeDeg) },
    skyAnchor === null
      ? null
      : { label: 'MOON ALTITUDE', value: formatSignedDeg(skyAnchor.moon.altitudeDeg) },
  ];

  return candidates.filter((fact): fact is ShareFact => fact !== null).slice(0, 3);
}

/**
 * DESIGN_SPEC.md §17's simplified Horizon Band — "markers and horizon
 * only, no scrubber" — so each marker is a fixed azimuth/altitude at the
 * captured moment, with no interpolation timeline to scrub along.
 *
 * The ISS marker is the *peak* of its next visible pass rather than a live
 * position: the band answers "where do I look?" (DESIGN_SPEC.md's own
 * rationale for the element), and for a pass that has not happened yet the
 * honest answer is where it will culminate. Its sublabel carries the time,
 * so the marker never reads as a current position.
 *
 * Planets below the horizon are omitted rather than drawn under the rule —
 * a marker you cannot see is not an answer to "where do I look?".
 */
export function buildMarkers(brief: DailyBrief): ShareMarker[] {
  const markers: ShareMarker[] = [];
  const skyAnchor = brief.skyAnchor.data ?? null;

  if (skyAnchor !== null) {
    markers.push({
      id: 'sun',
      label: 'SUN',
      sublabel: `ALT ${formatSignedDeg(skyAnchor.sunAltitudeDeg)}`,
      type: 'sun',
      azimuthDeg: skyAnchor.sunAzimuthDeg,
      altitudeDeg: skyAnchor.sunAltitudeDeg,
    });
    markers.push({
      id: 'moon',
      label: 'MOON',
      sublabel: `${Math.round(skyAnchor.moon.illuminatedFraction * 100)}% LIT`,
      type: 'moon',
      azimuthDeg: skyAnchor.moon.azimuthDeg,
      altitudeDeg: skyAnchor.moon.altitudeDeg,
    });

    const planets = [
      { id: 'venus', label: 'VENUS', position: skyAnchor.venus },
      { id: 'mars', label: 'MARS', position: skyAnchor.mars },
      { id: 'jupiter', label: 'JUPITER', position: skyAnchor.jupiter },
      { id: 'saturn', label: 'SATURN', position: skyAnchor.saturn },
      { id: 'mercury', label: 'MERCURY', position: skyAnchor.mercury },
    ];
    for (const planet of planets) {
      if (planet.position === null || planet.position.altitudeDeg <= 0) continue;
      markers.push({
        id: planet.id,
        label: planet.label,
        sublabel: `ALT ${formatSignedDeg(planet.position.altitudeDeg, 0)}`,
        type: 'planet',
        azimuthDeg: planet.position.azimuthDeg,
        altitudeDeg: planet.position.altitudeDeg,
      });
    }
  }

  const pass = brief.iss.data?.nextPass ?? null;
  if (pass !== null) {
    markers.push({
      id: 'iss',
      label: 'ISS',
      sublabel: `PASS ${formatUtcHm(new Date(pass.startUtc * 1000))}`,
      type: 'iss',
      azimuthDeg: pass.maxAzimuthDeg,
      altitudeDeg: pass.maxElevationDeg,
    });
  }

  return markers;
}

export interface BuildShareSnapshotParams {
  id: string;
  brief: DailyBrief;
  /** When the share was generated — distinct from the Brief moment it freezes. */
  createdAt: Date;
}

export function buildShareSnapshot({
  id,
  brief,
  createdAt,
}: BuildShareSnapshotParams): ShareSnapshot {
  const capturedAt = new Date(brief.generatedAt);
  const skyAnchor = brief.skyAnchor.data ?? null;
  // A total Sky Anchor outage cannot happen in practice (the card is pure
  // math with no source to fail) but the snapshot must still be a valid,
  // renderable document if it ever did: fall back to the darkest end of
  // the ramp, the same safe default `surfaceColorForTwilight` uses.
  const sunAltitudeDeg = skyAnchor?.sunAltitudeDeg ?? -90;
  const twilight = twilightStateForSunAltitude(sunAltitudeDeg);

  return {
    schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
    id,
    createdAt: createdAt.toISOString(),
    capturedAt: capturedAt.toISOString(),
    observer: {
      latDeg: brief.observer.latDeg,
      lonDeg: brief.observer.lonDeg,
      label: formatObserverLabel(brief.observer.latDeg, brief.observer.lonDeg),
    },
    sky: {
      sunAltitudeDeg,
      sunAzimuthDeg: skyAnchor?.sunAzimuthDeg ?? 0,
      twilightPhase: skyAnchor?.twilightPhase ?? 'night',
      twilightBand: twilight.phase,
      twilightValue: twilight.value,
      surfaceHex: surfaceColorForTwilight(twilight.value),
    },
    headline: composeHeadline(brief, capturedAt),
    facts: selectFacts(brief),
    horizon: { markers: buildMarkers(brief) },
    availability: {
      brief: brief.status,
      skyAnchor: brief.skyAnchor.status,
      iss: brief.iss.status,
      spaceWeather: brief.spaceWeather.status,
      neoImagery: brief.neoImagery.status,
    },
  };
}
