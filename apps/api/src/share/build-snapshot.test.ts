/**
 * `buildShareSnapshot` and its exported helpers (WORKPLAN.md Phase 11,
 * DESIGN_SPEC.md §17).
 *
 * The emphasis is on the two properties the phase actually rests on: that
 * the card is *self-contained* (every field resolved at capture time, and
 * the result satisfies its own schema), and that nothing is *invented* — a
 * missing source makes the card say less, never fill the gap.
 */

import { describe, expect, it } from 'vitest';
import {
  buildShareSnapshot,
  buildMarkers,
  composeHeadline,
  formatObserverLabel,
  formatSignedDeg,
  selectFacts,
} from './build-snapshot.js';
import { ShareSnapshotSchema } from './share.schemas.js';
import {
  CAPTURED_AT,
  CREATED_AT,
  FIXTURE_SHARE_ID,
  makeDailyBrief,
  makeShareSnapshot,
  PASS_START_UTC,
} from './__fixtures__/snapshot.js';
import type { DailyBrief } from '../brief/build-brief.js';

const CAPTURED_DATE = new Date(CAPTURED_AT);

/** Blanks one card the way `build-brief.ts` does when its source is down. */
function without(
  brief: DailyBrief,
  card: 'skyAnchor' | 'iss' | 'spaceWeather' | 'neoImagery',
): DailyBrief {
  return { ...brief, [card]: { status: 'unavailable', data: null } };
}

describe('formatSignedDeg', () => {
  it('uses a true minus glyph, not a hyphen (DESIGN_SPEC.md §5.4)', () => {
    const formatted = formatSignedDeg(-14.2);
    expect(formatted).toBe('−14.2°');
    expect(formatted).not.toContain('-');
  });

  it('renders an explicit plus for non-negative values', () => {
    expect(formatSignedDeg(12.36)).toBe('+12.4°');
    expect(formatSignedDeg(0)).toBe('+0.0°');
  });

  it('honours the decimals argument', () => {
    expect(formatSignedDeg(41.8, 0)).toBe('+42°');
  });
});

describe('formatObserverLabel', () => {
  it('renders a derived coordinate label, never a place name', () => {
    expect(formatObserverLabel(51.5072, -0.1276)).toBe('51.51°N 0.13°W');
  });

  it('picks the hemisphere suffix from each sign independently', () => {
    expect(formatObserverLabel(-33.8688, 151.2093)).toBe('33.87°S 151.21°E');
  });

  it('treats the equator and prime meridian as N/E rather than emitting a signed zero', () => {
    expect(formatObserverLabel(0, 0)).toBe('0.00°N 0.00°E');
  });
});

describe('composeHeadline', () => {
  it('leads with a rated aurora forecast, carrying its confidence', () => {
    const brief = makeDailyBrief();
    const aurora = brief.spaceWeather.data!.aurora!;
    aurora.visible = true;
    aurora.confidence = 0.62;

    expect(composeHeadline(brief, CAPTURED_DATE)).toBe(
      'Aurora may reach your sky tonight, at Kp 4.0 — 62% confidence.',
    );
  });

  it('never gives an unrated aurora the confident phrasing', () => {
    const brief = makeDailyBrief();
    const aurora = brief.spaceWeather.data!.aurora!;
    aurora.visible = true;
    aurora.confidence = null;
    // Drop the ISS pass so the unrated-aurora branch is what is reached.
    const headline = composeHeadline(without(brief, 'iss'), CAPTURED_DATE);

    expect(headline).toBe(
      'Aurora may reach your sky tonight, on a forecast Kp of 4.0 — no active CME to rate it against.',
    );
    expect(headline).not.toMatch(/confidence/);
  });

  it('falls to the ISS pass when the aurora is not visible', () => {
    expect(composeHeadline(makeDailyBrief(), CAPTURED_DATE)).toBe(
      'The ISS crosses your sky at 22:14 UTC, almost directly overhead.',
    );
  });

  it('names the day when the pass is not on the captured UTC day', () => {
    const brief = makeDailyBrief();
    // 04:30 the following morning — same "tonight" to a human, different UTC day.
    brief.iss.data!.nextPass!.startUtc = Date.parse('2026-07-18T04:30:00.000Z') / 1000;

    expect(composeHeadline(brief, CAPTURED_DATE)).toBe(
      'The ISS crosses your sky at 04:30 UTC on 18 Jul, almost directly overhead.',
    );
  });

  it('describes where to look from the pass elevation', () => {
    const brief = makeDailyBrief();
    const pass = brief.iss.data!.nextPass!;

    pass.maxElevationDeg = 45;
    expect(composeHeadline(brief, CAPTURED_DATE)).toContain('high above the horizon');

    pass.maxElevationDeg = 14;
    expect(composeHeadline(brief, CAPTURED_DATE)).toContain('low on the SE horizon');
  });

  it('falls to the Moon when neither aurora nor a pass is available', () => {
    const brief = without(without(makeDailyBrief(), 'iss'), 'spaceWeather');
    expect(composeHeadline(brief, CAPTURED_DATE)).toBe('Tonight, a waxinggibbous moon, 73% lit.');
  });

  it('falls to a bare coordinate statement when every source is down', () => {
    let brief = makeDailyBrief();
    for (const card of ['skyAnchor', 'iss', 'spaceWeather', 'neoImagery'] as const) {
      brief = without(brief, card);
    }
    expect(composeHeadline(brief, CAPTURED_DATE)).toBe(
      'A snapshot of the sky over 51.51°N 0.13°W.',
    );
  });
});

describe('selectFacts', () => {
  it('returns exactly three measurements in descending priority', () => {
    expect(selectFacts(makeDailyBrief())).toEqual([
      { label: 'NEXT ISS PASS', value: '22:14 UTC' },
      { label: 'KP FORECAST', value: '4.0' },
      { label: 'SOLAR WIND', value: '429 km/s' },
    ]);
  });

  it('includes confidence when the forecast is rated, displacing lower-priority facts', () => {
    const brief = makeDailyBrief();
    brief.spaceWeather.data!.aurora!.confidence = 0.62;

    expect(selectFacts(brief)).toEqual([
      { label: 'NEXT ISS PASS', value: '22:14 UTC' },
      { label: 'KP FORECAST', value: '4.0' },
      { label: 'CONFIDENCE', value: '62%' },
    ]);
  });

  it('never exceeds three even when every source is up', () => {
    const brief = makeDailyBrief();
    brief.spaceWeather.data!.aurora!.confidence = 0.62;
    expect(selectFacts(brief).length).toBe(3);
  });

  it('still yields three pure-math facts under a total upstream outage', () => {
    const brief = without(without(makeDailyBrief(), 'iss'), 'spaceWeather');

    // Sky Anchor is pure math and cannot fail, so the row is never padded.
    expect(selectFacts(without(brief, 'neoImagery'))).toEqual([
      { label: 'MOON', value: '73% LIT' },
      { label: 'SUN ALTITUDE', value: '−14.2°' },
      { label: 'MOON ALTITUDE', value: '+12.7°' },
    ]);
  });

  it('returns nothing rather than inventing a fact when even Sky Anchor is gone', () => {
    let brief = makeDailyBrief();
    for (const card of ['skyAnchor', 'iss', 'spaceWeather', 'neoImagery'] as const) {
      brief = without(brief, card);
    }
    expect(selectFacts(brief)).toEqual([]);
  });

  it('omits solar wind rather than rendering a null speed', () => {
    const brief = without(makeDailyBrief(), 'iss');
    brief.spaceWeather.data!.solarLine.live.speedKmS = null;

    const labels = selectFacts(brief).map((fact) => fact.label);
    expect(labels).not.toContain('SOLAR WIND');
    expect(labels).toEqual(['KP FORECAST', 'CLOSEST NEO', 'MOON']);
  });
});

describe('buildMarkers', () => {
  it('places the Sun, Moon, every risen planet and the ISS pass peak', () => {
    expect(buildMarkers(makeDailyBrief())).toEqual(makeShareSnapshot().horizon.markers);
  });

  it('omits planets at or below the horizon', () => {
    const ids = buildMarkers(makeDailyBrief()).map((marker) => marker.id);
    // Venus is at -8.1deg in the fixture, Mercury has no ephemeris at all.
    expect(ids).not.toContain('venus');
    expect(ids).not.toContain('mercury');
  });

  it('keeps the Sun below the horizon — it is why the card is dark', () => {
    const sun = buildMarkers(makeDailyBrief()).find((marker) => marker.id === 'sun');
    expect(sun?.altitudeDeg).toBeLessThan(0);
  });

  it('labels the ISS marker with its pass time so it never reads as a live position', () => {
    const iss = buildMarkers(makeDailyBrief()).find((marker) => marker.id === 'iss');
    expect(iss?.sublabel).toBe('PASS 22:14 UTC');
    expect(iss?.altitudeDeg).toBe(68.4);
  });

  it('returns no markers at all when Sky Anchor and ISS are both down', () => {
    expect(buildMarkers(without(without(makeDailyBrief(), 'skyAnchor'), 'iss'))).toEqual([]);
  });
});

describe('buildShareSnapshot', () => {
  const snapshot = buildShareSnapshot({
    id: FIXTURE_SHARE_ID,
    brief: makeDailyBrief(),
    createdAt: new Date(CREATED_AT),
  });

  it('produces a blob that satisfies its own schema', () => {
    expect(ShareSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('matches the fixture the downstream renderers are tested against', () => {
    expect(snapshot).toEqual(makeShareSnapshot());
  });

  it('freezes the Brief moment separately from the share moment', () => {
    expect(snapshot.capturedAt).toBe(CAPTURED_AT);
    expect(snapshot.createdAt).toBe(CREATED_AT);
    expect(snapshot.capturedAt).not.toBe(snapshot.createdAt);
  });

  it('stores the surface color rather than leaving it to be recomputed on read', () => {
    // -14.2deg sits inside DESIGN_SPEC.md §2's astronomical band, so this is
    // a genuinely interpolated color, not one of the four ramp stops.
    expect(snapshot.sky.twilightBand).toBe('astronomical');
    expect(snapshot.sky.surfaceHex).toBe('#182020');
  });

  it('carries per-source availability so a card made during an outage stays honest', () => {
    const degraded = buildShareSnapshot({
      id: FIXTURE_SHARE_ID,
      brief: without(makeDailyBrief(), 'spaceWeather'),
      createdAt: new Date(CREATED_AT),
    });

    expect(degraded.availability.spaceWeather).toBe('unavailable');
    expect(degraded.availability.skyAnchor).toBe('ok');
  });

  it('falls back to the darkest surface if Sky Anchor ever failed entirely', () => {
    const blind = buildShareSnapshot({
      id: FIXTURE_SHARE_ID,
      brief: without(makeDailyBrief(), 'skyAnchor'),
      createdAt: new Date(CREATED_AT),
    });

    expect(blind.sky.sunAltitudeDeg).toBe(-90);
    expect(blind.sky.twilightBand).toBe('night');
    expect(blind.sky.surfaceHex).toBe('#111818');
    expect(ShareSnapshotSchema.safeParse(blind).success).toBe(true);
  });

  it('stays schema-valid with every source down', () => {
    let brief = makeDailyBrief();
    for (const card of ['skyAnchor', 'iss', 'spaceWeather', 'neoImagery'] as const) {
      brief = without(brief, card);
    }
    brief = { ...brief, status: 'unavailable' };

    const parsed = ShareSnapshotSchema.safeParse(
      buildShareSnapshot({ id: FIXTURE_SHARE_ID, brief, createdAt: new Date(CREATED_AT) }),
    );
    expect(parsed.success).toBe(true);
  });

  it('is deterministic — the same brief always yields the same blob', () => {
    const again = buildShareSnapshot({
      id: FIXTURE_SHARE_ID,
      brief: makeDailyBrief(),
      createdAt: new Date(CREATED_AT),
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(snapshot));
  });

  it('derives the ISS fact from the same pass the headline names', () => {
    expect(snapshot.headline).toContain('22:14 UTC');
    expect(snapshot.facts[0]).toEqual({ label: 'NEXT ISS PASS', value: '22:14 UTC' });
    expect(new Date(PASS_START_UTC * 1000).toISOString()).toBe('2026-07-17T22:14:00.000Z');
  });
});
