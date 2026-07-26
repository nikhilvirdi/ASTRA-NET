import { useState, useEffect, useRef } from 'react';
import * as satellite from 'satellite.js';
import { isVisiblePass, julianDay, sunAltitudeDeg, sunEquatorialPosition } from '@astranet/shared';
import type { SkyObjectInput } from '@/lib/semantic-zoom';
import { useAppStore } from '@/store';

export interface SatelliteElementSet {
  id: string;
  name: string;
  line1: string;
  line2: string;
}

export interface SatellitesPayload {
  satellites: SatelliteElementSet[];
  fetchedAt: string | null;
  healthy: boolean;
}

export interface PropagatedSatellite extends SkyObjectInput {
  name: string;
}

const PROPAGATE_INTERVAL_MS = 2000;

/**
 * Client-side satellite propagator (Phase 8).
 * Fetches real TLEs from the backend and propagates them to the observer's
 * current topocentric alt/az every 2 seconds using SGP4 (satellite.js).
 */
export function useSatellites(): PropagatedSatellite[] {
  const loc = useAppStore((state) => state.location);
  const [tleData, setTleData] = useState<SatelliteElementSet[]>([]);
  const [propagated, setPropagated] = useState<PropagatedSatellite[]>([]);

  // Cache compiled SatRecs so we don't re-parse the strings every 2 seconds.
  const satrecsRef = useRef<{ id: string; name: string; satrec: satellite.SatRec }[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/satellites')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch satellites');
        return res.json();
      })
      .then((data: SatellitesPayload) => {
        if (mounted && data.satellites) {
          setTleData(data.satellites);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch satellites:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    satrecsRef.current = tleData
      .map((s) => {
        try {
          return { id: s.id, name: s.name, satrec: satellite.twoline2satrec(s.line1, s.line2) };
        } catch (e) {
          return null;
        }
      })
      .filter((s): s is { id: string; name: string; satrec: satellite.SatRec } => s !== null);
  }, [tleData]);

  useEffect(() => {
    // No observer location yet — `state.location` is null until something
    // calls the store's `setLocation` (geolocation, a location switcher),
    // and nothing in the app does that yet (see DECISIONS.md). Don't guess
    // a position: show nothing until a real one exists. Once `loc` becomes
    // non-null this effect re-runs (it's in the dep array below) and
    // propagation starts normally.
    if (loc === null) {
      setPropagated([]);
      return;
    }
    if (satrecsRef.current.length === 0) return;

    const propagate = () => {
      const now = new Date();
      const gmst = satellite.gstime(now);
      const observerGd = {
        longitude: satellite.degreesToRadians(loc.lon),
        latitude: satellite.degreesToRadians(loc.lat),
        height: 0,
      };

      // Same FORMULAS.md §5 visible-pass test the ISS card already applies
      // (packages/shared's isVisiblePass: elevation >= 10deg AND observer in
      // darkness AND satellite outside Earth's shadow) — reused, not
      // reimplemented, so both surfaces agree on what "visible" means.
      // Observer darkness and the Sun's direction are the same for every
      // satellite this tick, so computed once here rather than per-satellite.
      const sunAltObserverDeg = sunAltitudeDeg(now, loc.lat, loc.lon);
      const jd = julianDay(now);
      const { raDeg, decDeg } = sunEquatorialPosition(jd);
      const raRad = satellite.degreesToRadians(raDeg);
      const decRad = satellite.degreesToRadians(decDeg);
      const sunUnitVector = {
        x: Math.cos(decRad) * Math.cos(raRad),
        y: Math.cos(decRad) * Math.sin(raRad),
        z: Math.sin(decRad),
      };

      const results: PropagatedSatellite[] = [];
      for (const { id, name, satrec } of satrecsRef.current) {
        const positionAndVelocity = satellite.propagate(satrec, now);
        const positionEci = positionAndVelocity.position;

        if (!positionEci || typeof positionEci === 'boolean') continue;

        const positionEcf = satellite.eciToEcf(positionEci, gmst);
        const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
        const altitudeDeg = satellite.radiansToDegrees(lookAngles.elevation);

        // Below the visible-pass bar (too low, observer not dark enough, or
        // the satellite itself is in Earth's shadow): not actually seeable,
        // so it isn't shown — same standard the ISS pass already applies.
        if (!isVisiblePass(altitudeDeg, sunAltObserverDeg, positionEci, sunUnitVector)) continue;

        results.push({
          id,
          name,
          kind: 'satellite',
          azimuthDeg: satellite.radiansToDegrees(lookAngles.azimuth),
          altitudeDeg,
          pinned: false,
        });
      }
      setPropagated(results);
    };

    propagate(); // immediate first tick
    const intervalId = setInterval(propagate, PROPAGATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [tleData, loc]);

  return propagated;
}
