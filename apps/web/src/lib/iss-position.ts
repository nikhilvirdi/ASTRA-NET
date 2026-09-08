import * as satellite from 'satellite.js';

export interface IssTopocentricPosition {
  /** Degrees above (+) or below (-) the observer's horizon. */
  altitudeDeg: number;
  /** Degrees clockwise from true north. */
  azimuthDeg: number;
}

/**
 * Converts the ISS's real geodetic position — latitude/longitude/altitude,
 * as reported by N2YO's positions endpoint, independent of any observer —
 * into a real topocentric altitude/azimuth for one specific observer.
 *
 * Reuses the exact satellite.js pipeline `useSatellites.ts` already uses for
 * every other satellite (`ecfToLookAngles`, `radiansToDegrees`); the only
 * difference is the position source. Every other satellite starts from a TLE
 * and has to propagate (SGP4) to an ECI position, then `eciToEcf`, before
 * look angles are meaningful. The ISS's live position is already a real
 * geodetic fix — no propagation needed, so `geodeticToEcf` goes straight to
 * ECF. No new orbital math, just the other on-ramp into the same transform.
 */
export function computeIssTopocentricPosition(
  issLatitudeDeg: number,
  issLongitudeDeg: number,
  issAltitudeKm: number,
  observerLatDeg: number,
  observerLonDeg: number,
): IssTopocentricPosition {
  const issEcf = satellite.geodeticToEcf({
    longitude: satellite.degreesToRadians(issLongitudeDeg),
    latitude: satellite.degreesToRadians(issLatitudeDeg),
    height: issAltitudeKm,
  });

  const observerGd = {
    longitude: satellite.degreesToRadians(observerLonDeg),
    latitude: satellite.degreesToRadians(observerLatDeg),
    height: 0,
  };

  const lookAngles = satellite.ecfToLookAngles(observerGd, issEcf);

  return {
    altitudeDeg: satellite.radiansToDegrees(lookAngles.elevation),
    azimuthDeg: satellite.radiansToDegrees(lookAngles.azimuth),
  };
}
