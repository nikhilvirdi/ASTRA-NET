/**
 * Maps the Brief's space-weather card onto the three things the UI shows
 * about it: whether the section is dimmed, whether the live pulse is lit,
 * and what the status notice reads.
 *
 * Extracted from `BriefPage.tsx` for the same reason `horizon-band.ts` was:
 * this project's vitest config only collects `src/**\/*.test.ts`, so logic
 * living inside a `.tsx` component cannot be asserted — and this particular
 * logic shipped wrong. `BriefPage` drove the live pulse from
 * `status === 'ok'` alone, which lit it during a total SWPC outage, and the
 * unavailable notice carried a hardcoded `LAST SEEN 12:00`.
 *
 * The distinction the UI has to make is three-way, not two-way:
 *
 * - **live** — a current reading. Pulse lit.
 * - **stale** — a real but aged reading, which `API_SOURCES.md`'s SWPC
 *   fallback explicitly says to keep showing "with an aged freshness
 *   stamp". Card readable, pulse dark, notice says when it was last seen.
 * - **unavailable** — no reading at all. Dimmed, pulse dark, notice says so.
 *
 * Collapsing stale into either neighbour is what produced the bug: folding
 * it into "live" lights a pulse for a dead source, and folding it into
 * "unavailable" throws away a value the poller deliberately preserved.
 */

/** The subset of the API's space-weather card this mapping depends on. */
export interface SpaceWeatherCardLike {
  status: 'ok' | 'unavailable';
  data: {
    solarLine: {
      live: { fetchedAt: string | null; healthy: boolean };
      forecast: { fetchedAt: string | null; healthy: boolean };
    };
  } | null;
}

export type SpaceWeatherFreshness = 'live' | 'stale' | 'unavailable';

export interface SpaceWeatherUiState {
  freshness: SpaceWeatherFreshness;
  /** §17-style de-emphasis for a section with nothing real in it. */
  dimmed: boolean;
  /** DESIGN_SPEC.md §7.2 — the Live Pulse means *live*, not merely "resolved". */
  livePulseActive: boolean;
  /** Null when there is nothing to say, i.e. the reading is current. */
  notice: string | null;
}

/** `2026-07-17T21:40:00Z` -> `21:40 UTC`; null when never fetched. */
export function formatLastSeen(fetchedAt: string | null): string | null {
  if (fetchedAt === null) return null;
  const at = new Date(fetchedAt);
  if (Number.isNaN(at.getTime())) return null;
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

export function spaceWeatherUiState(
  card: SpaceWeatherCardLike | null | undefined,
): SpaceWeatherUiState {
  // A Brief that has not loaded yet is not the same as one that loaded and
  // reported an outage, but neither should pulse.
  if (card === null || card === undefined) {
    return { freshness: 'unavailable', dimmed: false, livePulseActive: false, notice: null };
  }

  if (card.status === 'unavailable' || card.data === null) {
    const lastSeen = formatLastSeen(card.data?.solarLine.live.fetchedAt ?? null);
    return {
      freshness: 'unavailable',
      dimmed: true,
      livePulseActive: false,
      notice:
        lastSeen === null ? 'SOURCE UNAVAILABLE' : `SOURCE UNAVAILABLE · LAST SEEN ${lastSeen}`,
    };
  }

  const { live, forecast } = card.data.solarLine;
  // Either half being current is enough to call the section live; the halves
  // carry their own flags for anything finer-grained.
  if (live.healthy || forecast.healthy) {
    return { freshness: 'live', dimmed: false, livePulseActive: true, notice: null };
  }

  const lastSeen = formatLastSeen(live.fetchedAt ?? forecast.fetchedAt);
  return {
    freshness: 'stale',
    dimmed: false,
    livePulseActive: false,
    notice: lastSeen === null ? 'NOT LIVE' : `NOT LIVE · LAST SEEN ${lastSeen}`,
  };
}
