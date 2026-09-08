import { API_BASE } from '@/lib/config';
import { useEffect, useState } from 'react';
import type { FastTierStreamPayload } from '@/lib/api';

/**
 * Live fast-tier data over the SSE `/stream` endpoint — the same connection
 * carries two independent feeds (see `apps/api/src/routes/stream.ts`): SWPC
 * space weather (the data behind the Auroral Ring and Heliosphere Pulse) and
 * the ISS's real live geodetic position. One hook, one `EventSource`, so a
 * second consumer needing the ISS position doesn't open a duplicate
 * connection to the same endpoint.
 *
 * Honesty contract (DESIGN_SPEC.md §7.3, ARCHITECTURE.md §4): `fetchedAt` and
 * `healthy` are passed through from the source's own envelope untouched —
 * consumers must degrade (dim, hide, or mark unavailable) on `healthy: false`
 * or null fields, never substitute a made-up value. `streamedAt` (push time)
 * is deliberately not exposed; it says nothing about data freshness.
 *
 * EventSource reconnects automatically after connection loss; `connected`
 * tracks the transport so consumers can distinguish "no aurora because Kp is
 * low" from "no data at all."
 */

export interface IssLivePosition {
  /** Real geodetic latitude, degrees — independent of any observer. */
  latitudeDeg: number;
  /** Real geodetic longitude, degrees. */
  longitudeDeg: number;
  /** Real altitude above the geoid, km. */
  altitudeKm: number;
  /** Unix timestamp (seconds) of this fix. */
  timestampUtc: number;
}

export interface SpaceWeatherLive {
  /** Continuous estimated Kp (FORMULAS.md §7's primary Kp), or null if unavailable. */
  kp: number | null;
  /** RTSW proton bulk speed, km/s, or null if unavailable. */
  solarWindSpeedKmS: number | null;
  /** The SWPC fast-tier source's own health flag. */
  healthy: boolean;
  /** ISO-8601 timestamp of the last successful SWPC fetch, or null. */
  fetchedAt: string | null;
  /**
   * The ISS's real live position (N2YO's positions endpoint), or null when
   * unavailable. Deliberately does NOT carry N2YO's azimuth/elevation —
   * those are computed against the poller's own fixed reference point
   * (0°, 0°), not any real observer, and would be meaningless for whoever is
   * actually viewing Explore. Consumers convert lat/lon/altitude to a real
   * observer-relative topocentric position themselves (see
   * `lib/iss-position.ts`'s `computeIssTopocentricPosition`).
   */
  issPosition: IssLivePosition | null;
  /** Whether the SSE transport is currently open. */
  connected: boolean;
}

const INITIAL_STATE: SpaceWeatherLive = {
  kp: null,
  solarWindSpeedKmS: null,
  healthy: false,
  fetchedAt: null,
  issPosition: null,
  connected: false,
};

export function useSpaceWeather(): SpaceWeatherLive {
  const [state, setState] = useState<SpaceWeatherLive>(INITIAL_STATE);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/stream`);

    source.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
    };

    source.onmessage = (event: MessageEvent<string>) => {
      let payload: FastTierStreamPayload;
      try {
        payload = JSON.parse(event.data) as FastTierStreamPayload;
      } catch {
        // A malformed frame is dropped, not rendered — the previous good
        // state (with its old fetchedAt) remains, which is honest aging.
        return;
      }
      const sw = payload.solarWind;
      // Same "first position" convention as apps/api's buildIssCard —
      // ISS_POSITION_PARAMS.seconds is 1, so there is only ever one.
      const firstPosition = payload.iss.data?.positions?.[0] ?? null;
      setState({
        kp: sw.data?.kpCurrent?.estimatedKp ?? null,
        solarWindSpeedKmS: sw.data?.rtswPlasma?.protonSpeed ?? null,
        healthy: sw.healthy,
        fetchedAt: sw.fetchedAt,
        issPosition: firstPosition
          ? {
              latitudeDeg: firstPosition.latitude,
              longitudeDeg: firstPosition.longitude,
              altitudeKm: firstPosition.altitude,
              timestampUtc: firstPosition.timestamp,
            }
          : null,
        connected: true,
      });
    };

    source.onerror = () => {
      // EventSource retries on its own; flag the transport as down so
      // consumers can degrade while it does. Data fields keep their last
      // value + fetchedAt — visibly aging, never silently refreshed.
      setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      source.close();
    };
  }, []);

  return state;
}
