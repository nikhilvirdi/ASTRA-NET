/**
 * ISS visible-pass position interpolation, shared by the Horizon Band (2D
 * band) and the /explore scene's clickable markers (3D) so the two can never
 * drift apart.
 *
 * The wire payload carries NO "azimuth right now"; the only real azimuths
 * N2YO gives are three sampled points on the next visible pass
 * (start → max → end), each with its own UTC timestamp. So an ISS marker is
 * only placed while the query time falls inside that pass window, and its
 * position is interpolated along the pass's own timeline. Peak elevation is
 * the only altitude N2YO exposes; start/end are at the horizon by definition
 * (the pass's visibility threshold), so altitude is interpolated
 * 0 → maxElevation → 0 across the two segments. Outside the window the ISS is
 * not on a visible pass, so no position is returned rather than fabricating
 * one (same stance as the removed NEO marker — see DECISIONS.md).
 */

/** The subset of `IssNextPassField` the interpolation needs. */
export interface PassWindow {
  startUtc: number;
  maxUtc: number;
  endUtc: number;
  maxElevationDeg: number;
  startAzimuthDeg: number;
  maxAzimuthDeg: number;
  endAzimuthDeg: number;
}

export interface PassPosition {
  azimuthDeg: number;
  altitudeDeg: number;
}

/**
 * Shortest-path angular interpolation between two azimuths (degrees), so a
 * pass that crosses due North (e.g. 350° → 10°) sweeps the short way through
 * 0° rather than winding 340° backwards. `t` is the 0..1 fraction along the
 * segment; the result is normalized to [0, 360).
 */
export function interpolateAzimuth(fromDeg: number, toDeg: number, t: number): number {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180;
  return (fromDeg + delta * t + 360) % 360;
}

/**
 * Position along the pass at `tSec` (Unix seconds), or `null` when `tSec`
 * falls outside the pass window (no visible pass — draw nothing).
 */
export function interpolatePassPosition(pass: PassWindow, tSec: number): PassPosition | null {
  if (tSec < pass.startUtc || tSec > pass.endUtc) return null;

  if (tSec <= pass.maxUtc) {
    // Rising leg: start → max.
    const span = pass.maxUtc - pass.startUtc;
    const f = span > 0 ? (tSec - pass.startUtc) / span : 1;
    return {
      azimuthDeg: interpolateAzimuth(pass.startAzimuthDeg, pass.maxAzimuthDeg, f),
      altitudeDeg: pass.maxElevationDeg * f,
    };
  }

  // Descending leg: max → end.
  const span = pass.endUtc - pass.maxUtc;
  const f = span > 0 ? (tSec - pass.maxUtc) / span : 1;
  return {
    azimuthDeg: interpolateAzimuth(pass.maxAzimuthDeg, pass.endAzimuthDeg, f),
    altitudeDeg: pass.maxElevationDeg * (1 - f),
  };
}
