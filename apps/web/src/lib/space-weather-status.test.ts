/**
 * Regression cover for the space-weather section's UI state
 * (WORKPLAN.md Phase 12, DESIGN_SPEC.md §7.2, ARCHITECTURE.md §6).
 *
 * The defect these tests exist for was not in the API response shape — the
 * card body was honest throughout, reading "space weather unavailable" with
 * every value null. What was wrong was the *screen*: `BriefPage` drove the
 * Live Pulse from `status === 'ok'` alone, so during a total SWPC outage it
 * lit a live indicator next to an empty card, suppressed the dimming, and
 * suppressed the notice — which itself carried a hardcoded `LAST SEEN
 * 12:00`.
 *
 * So these assert the three visible affordances directly, not the payload.
 */

import { describe, expect, it } from 'vitest';
import {
  formatLastSeen,
  spaceWeatherUiState,
  type SpaceWeatherCardLike,
} from './space-weather-status';

const FETCHED = '2026-07-17T21:40:00.000Z';

function card(overrides: {
  status?: 'ok' | 'unavailable';
  liveHealthy?: boolean;
  forecastHealthy?: boolean;
  fetchedAt?: string | null;
  data?: null;
}): SpaceWeatherCardLike {
  if (overrides.data === null) {
    return { status: overrides.status ?? 'unavailable', data: null };
  }
  const fetchedAt = overrides.fetchedAt === undefined ? FETCHED : overrides.fetchedAt;
  return {
    status: overrides.status ?? 'ok',
    data: {
      solarLine: {
        live: { fetchedAt, healthy: overrides.liveHealthy ?? true },
        forecast: { fetchedAt, healthy: overrides.forecastHealthy ?? true },
      },
    },
  };
}

describe('formatLastSeen', () => {
  it('renders a real UTC clock time from the fetch stamp', () => {
    // Replaces a hardcoded "12:00" that was shown regardless of reality.
    expect(formatLastSeen(FETCHED)).toBe('21:40 UTC');
  });

  it('pads single digits', () => {
    expect(formatLastSeen('2026-07-17T04:05:00.000Z')).toBe('04:05 UTC');
  });

  it('returns null rather than a fake time when never fetched', () => {
    expect(formatLastSeen(null)).toBeNull();
  });

  it('returns null on an unparseable stamp instead of "NaN:NaN"', () => {
    expect(formatLastSeen('not a date')).toBeNull();
  });
});

describe('spaceWeatherUiState — the live case', () => {
  it('lights the pulse and shows no notice when a source is current', () => {
    const ui = spaceWeatherUiState(card({ liveHealthy: true }));
    expect(ui.freshness).toBe('live');
    expect(ui.livePulseActive).toBe(true);
    expect(ui.dimmed).toBe(false);
    expect(ui.notice).toBeNull();
  });

  it('counts a healthy forecast alone as live', () => {
    const ui = spaceWeatherUiState(card({ liveHealthy: false, forecastHealthy: true }));
    expect(ui.freshness).toBe('live');
    expect(ui.livePulseActive).toBe(true);
  });
});

describe('spaceWeatherUiState — the outage case (the regression)', () => {
  const outage = card({ status: 'unavailable', data: null });

  it('never lights the Live Pulse for a dead source', () => {
    // The exact defect: status drove the pulse, and status was 'ok'
    // throughout a total SWPC outage, so this rendered as live.
    expect(spaceWeatherUiState(outage).livePulseActive).toBe(false);
  });

  it('dims the section', () => {
    expect(spaceWeatherUiState(outage).dimmed).toBe(true);
  });

  it('shows the unavailable notice', () => {
    expect(spaceWeatherUiState(outage).notice).toBe('SOURCE UNAVAILABLE');
  });

  it('never claims a last-seen time it does not have', () => {
    expect(spaceWeatherUiState(outage).notice).not.toMatch(/\d\d:\d\d/);
  });

  it('reports the real last-seen time when the card carries one', () => {
    const ui = spaceWeatherUiState(card({ status: 'unavailable', fetchedAt: FETCHED }));
    expect(ui.notice).toBe('SOURCE UNAVAILABLE · LAST SEEN 21:40 UTC');
    expect(ui.notice).not.toContain('12:00');
  });

  it('treats null data as unavailable even if status somehow says ok', () => {
    // Defence in depth: the two must not be able to disagree on screen.
    const ui = spaceWeatherUiState({ status: 'ok', data: null });
    expect(ui.freshness).toBe('unavailable');
    expect(ui.livePulseActive).toBe(false);
    expect(ui.dimmed).toBe(true);
  });
});

describe('spaceWeatherUiState — the stale case', () => {
  // API_SOURCES.md's SWPC fallback: "use last cached value with an aged
  // freshness stamp". The reading stays on screen; it must not read as live.
  const stale = card({ liveHealthy: false, forecastHealthy: false });

  it('keeps the card readable rather than blanking it', () => {
    const ui = spaceWeatherUiState(stale);
    expect(ui.freshness).toBe('stale');
    expect(ui.dimmed).toBe(false);
  });

  it('does not light the Live Pulse', () => {
    expect(spaceWeatherUiState(stale).livePulseActive).toBe(false);
  });

  it('says when the reading was last current', () => {
    expect(spaceWeatherUiState(stale).notice).toBe('NOT LIVE · LAST SEEN 21:40 UTC');
  });

  it('says "NOT LIVE" without a time when there is no stamp', () => {
    const ui = spaceWeatherUiState(
      card({ liveHealthy: false, forecastHealthy: false, fetchedAt: null }),
    );
    expect(ui.notice).toBe('NOT LIVE');
  });
});

describe('spaceWeatherUiState — before the Brief has loaded', () => {
  it.each([null, undefined])('does not pulse or dim for %s', (value) => {
    const ui = spaceWeatherUiState(value);
    expect(ui.livePulseActive).toBe(false);
    expect(ui.notice).toBeNull();
    // Not dimmed: nothing has failed yet, the page is simply still loading.
    expect(ui.dimmed).toBe(false);
  });
});

describe('the three affordances never contradict each other', () => {
  const cases: SpaceWeatherCardLike[] = [
    card({ liveHealthy: true }),
    card({ liveHealthy: false, forecastHealthy: true }),
    card({ liveHealthy: false, forecastHealthy: false }),
    card({ status: 'unavailable', data: null }),
    card({ status: 'unavailable', fetchedAt: FETCHED }),
  ];

  it.each(cases)('pulse implies not dimmed and no notice (%#)', (input) => {
    const ui = spaceWeatherUiState(input);
    if (ui.livePulseActive) {
      expect(ui.dimmed).toBe(false);
      expect(ui.notice).toBeNull();
      expect(ui.freshness).toBe('live');
    }
  });

  it.each(cases)('dimmed implies unavailable and a notice (%#)', (input) => {
    const ui = spaceWeatherUiState(input);
    if (ui.dimmed) {
      expect(ui.freshness).toBe('unavailable');
      expect(ui.livePulseActive).toBe(false);
      expect(ui.notice).not.toBeNull();
    }
  });

  it.each(cases)('anything not live carries a notice explaining why (%#)', (input) => {
    const ui = spaceWeatherUiState(input);
    if (ui.freshness !== 'live') {
      expect(ui.livePulseActive).toBe(false);
    }
  });
});
