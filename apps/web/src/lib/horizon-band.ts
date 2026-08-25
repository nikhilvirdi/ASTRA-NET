/**
 * Pure layout and selection logic for the Brief's Horizon Band
 * (DESIGN_SPEC.md §9). Extracted from `components/brief/HorizonBand.tsx`
 * for the same reason `phase10-helpers.ts` and `best-spot-helpers.ts`
 * exist: the component is `.tsx` and this project's vitest config only
 * collects `src/**\/*.test.ts`, so logic that needs asserting has to live
 * in a DOM-free module.
 *
 * §9 was rewritten from a flat horizontal strip to a curved dome
 * cross-section. Per §2's own RGB-rendering carve-out, the (azimuth,
 * altitude) -> (x, y) arc projection below is a presentation/layout choice,
 * not a FORMULAS.md physical formula, so it lives here rather than in
 * packages/shared's frozen engines.
 */

import { isAboveHorizon } from './semantic-zoom';

export interface CompassPoint {
  label: string;
  deg: number;
}

/**
 * The eight principal points, at their real azimuths.
 *
 * Previously this table read `N, NE, E, SE, S, SW, W, N` — `NW` was
 * missing and `N` was duplicated at 360deg — and the component rendered it
 * with flexbox `justify-between`, which spaces items evenly and ignores
 * `deg` entirely. `deg` is load-bearing: every consumer positions a point
 * from it, so the table and the layout cannot disagree again.
 */
export const COMPASS_POINTS: readonly CompassPoint[] = [
  { label: 'N', deg: 0 },
  { label: 'NE', deg: 45 },
  { label: 'E', deg: 90 },
  { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SW', deg: 225 },
  { label: 'W', deg: 270 },
  { label: 'NW', deg: 315 },
];

/**
 * Whether a body belongs on the band at all.
 *
 * Reuses the Explore scene's `isAboveHorizon` rather than re-deriving a
 * threshold, so the two surfaces cull identically and the atmospheric
 * refraction allowance is defined in exactly one place.
 *
 * The band answers "where do I look?", and a body below the horizon is not
 * an answer to that. Absent, not faked.
 */
export function belongsOnBand(altitudeDeg: number): boolean {
  return isAboveHorizon(altitudeDeg);
}

/** Formats a real altitude for a marker sublabel — never floored to zero. */
export function formatAltitude(altitudeDeg: number): string {
  return `Alt ${altitudeDeg.toFixed(1)}°`;
}

// ─── Dome-arc geometry (DESIGN_SPEC.md §9) ─────────────────────────────────

/** The window of azimuths currently drawn across the arc. */
export interface ArcSweep {
  /** Azimuth (degrees) at the left edge of the arc. */
  startDeg: number;
  /** Width of the window in degrees, (0, 360]. */
  sweepDeg: number;
}

/**
 * §9: "N through W by default, 240deg sweep." A literal N-to-W span is
 * 270deg going through E/S (the compass's forward direction), 30deg short
 * of the spec's own "240deg" figure — the two phrases don't resolve to one
 * exact window. The 240 figure is treated as authoritative (a precise
 * number beats descriptive flavor text), anchored at N so the window at
 * least *starts* exactly where the prose says: DECISIONS.md records this
 * call.
 */
export const DEFAULT_SWEEP: ArcSweep = { startDeg: 0, sweepDeg: 240 };

/** §9 / Part V "Ultrawide (1920px+)": full 360deg sweep. */
export const ULTRAWIDE_SWEEP: ArcSweep = { startDeg: 0, sweepDeg: 360 };

/** Part V — Responsive Strategy: "Ultrawide (1920px+)". */
export const ULTRAWIDE_BREAKPOINT_PX = 1920;

/** Fixed abstract coordinate space the arc is drawn in (viewBox units). */
export const ARC_VIEW_WIDTH = 1000;
export const ARC_VIEW_HEIGHT = 260;

/** Baseline (0deg altitude) y at the sweep's two edges. */
const ARC_BASE_Y = 235;
/** How far the dome baseline rises from its edges to its center. */
const ARC_DOME_RISE = 50;
/** Vertical span the full 0->90deg altitude extrusion covers. */
const ARC_ALT_SPAN = 150;

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Fraction (0..1) of `azimuthDeg` across `sweep`, or `null` when the azimuth
 * falls outside the current window — the same "absent, not faked" culling
 * `belongsOnBand` already applies to altitude. Handles wraparound at
 * 0deg/360deg: a sweep starting at 350deg with a 20deg width correctly
 * admits 5deg (delta 15) and rejects 340deg (delta 350).
 */
export function azimuthFraction(azimuthDeg: number, sweep: ArcSweep): number | null {
  const az = normalizeDeg(azimuthDeg);
  const start = normalizeDeg(sweep.startDeg);
  const delta = normalizeDeg(az - start);
  if (delta > sweep.sweepDeg) return null;
  return sweep.sweepDeg === 0 ? 0 : delta / sweep.sweepDeg;
}

/**
 * The dome baseline's y (0deg altitude) at horizontal fraction `f`, in
 * viewBox units. A shallow sine arch: lowest at the two edges (f=0, f=1),
 * highest at the center (f=0.5) — the literal cross-section silhouette of
 * a dome, and the "highest point" §9 anchors the zenith label to.
 */
export function arcBaselineY(f: number): number {
  return ARC_BASE_Y - ARC_DOME_RISE * Math.sin(f * Math.PI);
}

export interface ArcPoint {
  x: number;
  y: number;
}

/**
 * The core (azimuth, altitude) -> (x, y) projection. `x` comes from the
 * azimuth's fraction across the current sweep; `y` extrudes straight up
 * from the curved baseline by altitude's fraction of the full 90deg span.
 * Returns `null` when the azimuth is outside the sweep (nothing to draw).
 *
 * Altitude is clamped to [0, 90] — callers cull below-horizon bodies with
 * `belongsOnBand` first, same contract the old flat-strip projection had,
 * so this clamp only ever absorbs the refraction sliver.
 */
export function azAltToArcPoint(
  azimuthDeg: number,
  altitudeDeg: number,
  sweep: ArcSweep,
): ArcPoint | null {
  const f = azimuthFraction(azimuthDeg, sweep);
  if (f === null) return null;
  const clampedAlt = Math.max(0, Math.min(90, altitudeDeg));
  return {
    x: f * ARC_VIEW_WIDTH,
    y: arcBaselineY(f) - (clampedAlt / 90) * ARC_ALT_SPAN,
  };
}

/** Same projection, as a CSS-percentage pair for HTML overlay positioning. */
export function azAltToArcPercent(
  azimuthDeg: number,
  altitudeDeg: number,
  sweep: ArcSweep,
): { leftPercent: number; topPercent: number } | null {
  const p = azAltToArcPoint(azimuthDeg, altitudeDeg, sweep);
  if (!p) return null;
  return {
    leftPercent: (p.x / ARC_VIEW_WIDTH) * 100,
    topPercent: (p.y / ARC_VIEW_HEIGHT) * 100,
  };
}

/**
 * An SVG path (`M ... L ... L ...`) tracing one altitude gridline arc
 * (§9: "faint gridline arcs at 0deg (horizon), 45deg, and 90deg (zenith)")
 * across the full width of whatever sweep is active. The shape depends
 * only on altitude, not on real azimuth degrees or the sweep window, so it
 * is sampled directly over `f` rather than round-tripping through
 * `azAltToArcPoint`.
 */
export function arcGridlinePath(altitudeDeg: number, samples = 48): string {
  const clampedAlt = Math.max(0, Math.min(90, altitudeDeg));
  const yOffset = (clampedAlt / 90) * ARC_ALT_SPAN;
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const f = i / samples;
    const x = f * ARC_VIEW_WIDTH;
    const y = arcBaselineY(f) - yOffset;
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}

/**
 * Closed path bounding the region between the horizon (0deg) and zenith
 * (90deg) gridlines — the twilight gradient's fill area.
 */
export function arcFillPath(samples = 48): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const f = i / samples;
    const x = f * ARC_VIEW_WIDTH;
    bottom.push(`${x.toFixed(2)} ${arcBaselineY(f).toFixed(2)}`);
    top.push(`${x.toFixed(2)} ${(arcBaselineY(f) - ARC_ALT_SPAN).toFixed(2)}`);
  }
  top.reverse();
  return `M ${bottom.join(' L ')} L ${top.join(' L ')} Z`;
}
