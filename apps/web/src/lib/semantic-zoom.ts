/**
 * Semantic zoom / sky-object presentation.
 *
 * Pure presentation policy over the scene's clickable-object list — no
 * physics, no FORMULAS.md constants — so it lives beside
 * `pass-interpolation.ts` in apps/web/src/lib, not in packages/shared.
 *
 * DESIGN_SPEC.md §11 ("never more than seven clickable objects at any zoom
 * level... satellites merge into constellation-shaped clusters, then into a
 * single orbital shell glow") no longer governs the satellite population at
 * all — see DECISIONS.md, 2026-09-07 "Satellite clustering removed
 * entirely". Every object — anchor or satellite — always renders as its own
 * individual object, unconditionally. Overlapping icons on screen when
 * satellites are genuinely close together is expected and accepted; it is
 * not solved by merging them into an aggregate marker.
 *
 * The SHELL regime (`ShellRenderable`/`ShellMarker`) still exists in the
 * type system and renderer but nothing here produces one — flagged in
 * DECISIONS.md rather than deleted, since removing a designed, tested
 * visual feature wasn't part of this change. The CLUSTERED regime that
 * previously sat between INDIVIDUAL and SHELL has been removed entirely,
 * along with `ClusterRenderable`/`ClusterMarker` — see DECISIONS.md,
 * 2026-09-07.
 */

/**
 * Standard atmospheric refraction at the horizon (~34' = 0.5667deg): a body's
 * true geometric altitude can be slightly below the horizon and still be
 * visually above it, since the atmosphere bends light near grazing
 * incidence — the same figure almanacs use for sunrise/sunset horizon dip.
 * A real, documented value, not an invented threshold; not in FORMULAS.md
 * (no locked doc governs it), so it lives here as presentation policy
 * rather than packages/shared.
 */
export const HORIZON_REFRACTION_DEG = 34 / 60;

/** True below this, a body is genuinely below the horizon (see above). */
export function isAboveHorizon(altitudeDeg: number): boolean {
  return altitudeDeg >= -HORIZON_REFRACTION_DEG;
}

export type SkyObjectKind = 'satellite' | 'planet' | 'sun';

export interface SkyObjectInput {
  id: string;
  kind: SkyObjectKind;
  azimuthDeg: number;
  altitudeDeg: number;
  /**
   * Historical: marked the ISS as exempt from clustering back when
   * satellites could cluster. Nothing clusters anymore (see file header),
   * so this no longer changes any aggregation behavior — kept because the
   * ISS is still the product's hero object (§11's opening sequence tethers,
   * cursor gravity, camera lock), all driven by `type === 'iss'` elsewhere,
   * not by this field. Not removed outright — see DECISIONS.md, 2026-09-07.
   */
  pinned?: boolean;
}

/**
 * DESIGN_SPEC.md §11 — the Rule of 7. Still governs anchors (Sun/Moon/
 * planets, pinned ISS), which stay individually clickable unconditionally;
 * no longer governs the satellite population, which is no longer aggregated
 * at all (see file header, DECISIONS.md 2026-09-07).
 */
export const MAX_CLICKABLE_OBJECTS = 7;

/**
 * Discrete zoom levels over CameraController's 30–90° FOV range.
 * 0 = close, 1 = mid, 2 = wide.
 */
export type ZoomLevel = 0 | 1 | 2;

const ZOOM_BAND_EDGES_DEG = [45, 70] as const;

/** Midpoint FOV of each band — used for merge radii and drill-in targets. */
export const ZOOM_FOV_MIDPOINTS_DEG: readonly [number, number, number] = [37.5, 57.5, 80];

export function fovToZoomLevel(fovDeg: number): ZoomLevel {
  if (fovDeg < ZOOM_BAND_EDGES_DEG[0]) return 0;
  if (fovDeg < ZOOM_BAND_EDGES_DEG[1]) return 1;
  return 2;
}

/**
 * Drill-in target FOV for a shell click at `level`: the midpoint of the
 * next band in — clicking the shell zooms the camera to where it resolves
 * further. Already at level 0 → stay at level 0's mid.
 */
export function drillFovDeg(level: ZoomLevel): number {
  return ZOOM_FOV_MIDPOINTS_DEG[Math.max(0, level - 1) as ZoomLevel];
}

/**
 * Two satellites merge when their apparent separation is under ~15% of the
 * view height — close enough to read as one thing / fight for the same
 * click. Radius therefore scales with the band's midpoint FOV: zooming in
 * shrinks it (clusters resolve), zooming out grows it (satellites merge).
 * The 0.15 fraction is invented presentation (no doc pins it) — flagged in
 * DECISIONS.md alongside the Heliosphere Pulse's wind-speed mapping.
 */
const APPARENT_SEPARATION_FRACTION = 0.15;

/**
 * Not called by `aggregateSkyObjects` anymore (satellites no longer cluster
 * at all, so there is no merge radius of any kind — see file header). Kept
 * and still exported/tested as a standalone pure function; orphaned from
 * production — see DECISIONS.md, 2026-09-07.
 */
export function mergeRadiusDeg(level: ZoomLevel): number {
  return APPARENT_SEPARATION_FRACTION * ZOOM_FOV_MIDPOINTS_DEG[level];
}

// ─── Angular math (same alt/az sphere mapping as the scene) ─────────────────

function toUnitVector(altitudeDeg: number, azimuthDeg: number): [number, number, number] {
  const alt = (altitudeDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)];
}

/**
 * Not called by `aggregateSkyObjects` anymore (nothing clusters, so nothing
 * needs a pairwise angular distance — see file header). Kept and still
 * exported/tested as a standalone pure function; orphaned from production
 * — see DECISIONS.md, 2026-09-07.
 */
export function angularSeparationDeg(
  a: { altitudeDeg: number; azimuthDeg: number },
  b: { altitudeDeg: number; azimuthDeg: number },
): number {
  const va = toUnitVector(a.altitudeDeg, a.azimuthDeg);
  const vb = toUnitVector(b.altitudeDeg, b.azimuthDeg);
  const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

/**
 * Spherical centroid (normalized mean unit vector) of a set of positions.
 * Degenerate case (vectors cancel, e.g. antipodal pair): falls back to the
 * first member's position rather than dividing by ~zero.
 *
 * Not called by `aggregateSkyObjects` anymore (there are no cluster
 * centroids to compute — see file header). Kept and still exported/tested
 * as a standalone pure function; orphaned from production — see
 * DECISIONS.md, 2026-09-07.
 */
export function sphericalCentroid(
  members: readonly { altitudeDeg: number; azimuthDeg: number }[],
): { altitudeDeg: number; azimuthDeg: number } {
  const first = members[0];
  if (first === undefined) return { altitudeDeg: 0, azimuthDeg: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const m of members) {
    const v = toUnitVector(m.altitudeDeg, m.azimuthDeg);
    x += v[0];
    y += v[1];
    z += v[2];
  }
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-9) {
    return { altitudeDeg: first.altitudeDeg, azimuthDeg: first.azimuthDeg };
  }
  const altitudeDeg = (Math.asin(y / len) * 180) / Math.PI;
  const azimuthDeg = ((Math.atan2(x / len, -z / len) * 180) / Math.PI + 360) % 360;
  return { altitudeDeg, azimuthDeg };
}

// ─── Aggregation ────────────────────────────────────────────────────────────

export interface IndividualRenderable {
  kind: 'object';
  object: SkyObjectInput;
}

export interface ShellRenderable {
  kind: 'shell';
  id: 'orbital-shell';
  count: number;
  /** Clickable-core position: member centroid, altitude floored so the
   * handle is comfortably above the horizon. Presentation only — the glow
   * itself is the whole dome. */
  azimuthDeg: number;
  altitudeDeg: number;
}

export type SkyRenderable = IndividualRenderable | ShellRenderable;

export interface AggregationResult {
  regime: 'individual' | 'shell';
  renderables: SkyRenderable[];
  /** Always equal to `renderables.length` — nothing is aggregated, so every
   * object in the input becomes exactly one renderable. */
  clickableCount: number;
}

/**
 * Every object — anchor or satellite — always renders individually.
 * Deterministic: same inputs → same output, regardless of input order
 * (sorted by id).
 */
export function aggregateSkyObjects(objects: readonly SkyObjectInput[]): AggregationResult {
  const renderables: SkyRenderable[] = [...objects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((object) => ({ kind: 'object', object }));

  return {
    regime: 'individual',
    renderables,
    clickableCount: renderables.length,
  };
}
