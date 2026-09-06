import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MeteorShowerCard, computeActivityProgress, selectPrimaryShower } from './MeteorShowerCard';
import { METEOR_SHOWERS } from '../../lib/meteor-showers';

describe('computeActivityProgress', () => {
  it('calculates progress for standard shower inside same calendar year (Perseids)', () => {
    // Perseids: Jul 17 – Aug 24, peak Aug 13
    const start = { month: 7, day: 17 };
    const end = { month: 8, day: 24 };
    const peak = { month: 8, day: 13 };

    // Total days: (Jul 17 to Aug 24):
    // Jul 17 is day 197, Aug 24 is day 235 => 38 days
    // Peak Aug 13 is day 224 => offset 27 days => 27/38 ≈ 71.05%
    const onStart = computeActivityProgress(start, end, peak, { month: 7, day: 17 });
    expect(onStart.todayPct).toBe(0);
    expect(onStart.peakPct).toBeCloseTo(71.05, 1);

    const onPeak = computeActivityProgress(start, end, peak, { month: 8, day: 13 });
    expect(onPeak.todayPct).toBeCloseTo(71.05, 1);
    expect(onPeak.todayPct).toEqual(onPeak.peakPct);

    const onEnd = computeActivityProgress(start, end, peak, { month: 8, day: 24 });
    expect(onEnd.todayPct).toBe(100);
  });

  it('calculates progress for year-wrapping shower (Quadrantids Dec 28 – Jan 12)', () => {
    const start = { month: 12, day: 28 };
    const end = { month: 1, day: 12 };
    const peak = { month: 1, day: 3 };

    // Dec 28 is day 361, Jan 12 is day 11 => total 15 days
    // Peak Jan 3 is day 2 => offset 6 days => 6/15 = 40%
    const onStart = computeActivityProgress(start, end, peak, { month: 12, day: 28 });
    expect(onStart.todayPct).toBe(0);
    expect(onStart.peakPct).toBeCloseTo(40, 1);

    const onNewYear = computeActivityProgress(start, end, peak, { month: 1, day: 1 });
    // 4 days from Dec 28 => 4/15 ≈ 26.67%
    expect(onNewYear.todayPct).toBeCloseTo(26.67, 1);

    const onPeak = computeActivityProgress(start, end, peak, { month: 1, day: 3 });
    expect(onPeak.todayPct).toBeCloseTo(40, 1);

    const onEnd = computeActivityProgress(start, end, peak, { month: 1, day: 12 });
    expect(onEnd.todayPct).toBe(100);
  });
});

describe('selectPrimaryShower', () => {
  it('returns null for empty list', () => {
    expect(selectPrimaryShower([])).toBeNull();
  });

  it('selects the single active shower', () => {
    const per = METEOR_SHOWERS.find((s) => s.code === 'PER')!;
    expect(selectPrimaryShower([per])).toEqual(per);
  });

  it('selects highest rate shower when multiple are active', () => {
    const per = METEOR_SHOWERS.find((s) => s.code === 'PER')!; // ZHR 100
    const sda = METEOR_SHOWERS.find((s) => s.code === 'SDA')!; // ZHR 25
    const cap = METEOR_SHOWERS.find((s) => s.code === 'CAP')!; // ZHR 5
    expect(selectPrimaryShower([cap, sda, per])?.code).toBe('PER');
  });
});

describe('MeteorShowerCard rendering logic', () => {
  it('renders null when no shower is active (e.g. March 15)', () => {
    const quietDate = new Date(Date.UTC(2026, 2, 15, 20, 0, 0)); // Mar 15
    const result = MeteorShowerCard({
      date: quietDate,
      observerLonEastDeg: 0,
      moonIlluminatedFraction: 0.1,
    });
    expect(result).toBeNull();
  });

  it('renders the card with Activity Window and Moonlight Interference when a shower is active', () => {
    // Aug 12 2026: Perseids active
    const activeDate = new Date(Date.UTC(2026, 7, 12, 22, 0, 0));
    const result = MeteorShowerCard({
      date: activeDate,
      observerLonEastDeg: 0,
      moonIlluminatedFraction: 0.15,
    });
    expect(result).not.toBeNull();

    const html = renderToStaticMarkup(
      React.createElement(MeteorShowerCard, {
        date: activeDate,
        observerLonEastDeg: 0,
        moonIlluminatedFraction: 0.15,
      }),
    );

    // Card heading and LIVE badge
    expect(html).toContain('Meteor Shower');
    expect(html).toContain('LIVE');

    // Element a: Activity Window bar
    expect(html).toContain('ACTIVITY WINDOW');
    expect(html).toContain('PERSEIDS');
    expect(html).toContain('ZHR 100');
    expect(html).toContain('START (JUL 17)');
    expect(html).toContain('PEAK (AUG 13)');
    expect(html).toContain('END (AUG 24)');
    expect(html).toContain('TODAY');

    // Element b: Moonlight Interference gauge
    expect(html).toContain('MOONLIGHT INTERFERENCE');
    expect(html).toContain('15% (DARK SKY)');
    expect(html).toContain('0% (DARK SKY)');
    expect(html).toContain('50% (MODERATE)');
    expect(html).toContain('100% (FULL WASHOUT)');
    expect(html).toContain('left:15%');
  });

  it('renders correct moon washout category and needle when moon is near full', () => {
    const activeDate = new Date(Date.UTC(2026, 7, 12, 22, 0, 0));
    const html = renderToStaticMarkup(
      React.createElement(MeteorShowerCard, {
        date: activeDate,
        observerLonEastDeg: 0,
        moonIlluminatedFraction: 0.88,
      }),
    );

    expect(html).toContain('88% (FULL WASHOUT)');
    expect(html).toContain('left:88%');
  });

  it('renders moderate moon category between 25% and 75%', () => {
    const activeDate = new Date(Date.UTC(2026, 7, 12, 22, 0, 0));
    const html = renderToStaticMarkup(
      React.createElement(MeteorShowerCard, {
        date: activeDate,
        observerLonEastDeg: 0,
        moonIlluminatedFraction: 0.55,
      }),
    );

    expect(html).toContain('55% (MODERATE)');
    expect(html).toContain('data-testid="moon-interference-needle"');
    expect(html).toContain('left:55%');
  });

  it('renders gracefully with dash when moon illumination is null', () => {
    const activeDate = new Date(Date.UTC(2026, 7, 12, 22, 0, 0));
    const html = renderToStaticMarkup(
      React.createElement(MeteorShowerCard, {
        date: activeDate,
        observerLonEastDeg: 0,
        moonIlluminatedFraction: null,
      }),
    );

    expect(html).toContain('MOONLIGHT INTERFERENCE');
    expect(html).toContain('—');
    // Needle should not be rendered
    expect(html).not.toContain('data-testid="moon-interference-needle"');
  });

  it('renders for currently active September shower (SPE on Sep 7)', () => {
    const sep7 = new Date(Date.UTC(2026, 8, 7, 22, 0, 0)); // Sep 7
    const result = MeteorShowerCard({
      date: sep7,
      observerLonEastDeg: 0,
      moonIlluminatedFraction: 0.2,
    });
    expect(result).not.toBeNull();

    const html = renderToStaticMarkup(
      React.createElement(MeteorShowerCard, {
        date: sep7,
        observerLonEastDeg: 0,
        moonIlluminatedFraction: 0.2,
      }),
    );
    expect(html).toContain('SEPTEMBER EPSILON PERSEIDS');
    expect(html).toContain('START (SEP 5)');
    expect(html).toContain('PEAK (SEP 9)');
    expect(html).toContain('END (SEP 21)');
  });
});
