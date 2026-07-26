/**
 * Semantic zoom / Rule of 7 aggregation (DESIGN_SPEC.md §11: "never more
 * than seven clickable objects at any zoom level. Everything else is
 * ambient. Enforced by the semantic zoom system, which aggregates rather
 * than hides: satellites merge into constellation-shaped clusters, then into
 * a single orbital shell glow.")
 *
 * Pure presentation policy over the scene's clickable-object list — no
 * physics, no FORMULAS.md constants — so it lives beside
 * `pass-interpolation.ts` in apps/web/src/lib, not in packages/shared.
 *
 * How the spec's three regimes fall out:
 *
 *   1. INDIVIDUAL — total clickables ≤ 7: nothing aggregates. The Rule of 7
 *      is the trigger, not proximity; below the cap every object stays
 *      individually clickable ("aggregates rather than hides" is the
 *      *enforcement* mechanism, not ambient decluttering).
 *   2. CLUSTERED — over the cap, unpinned satellites within a zoom-dependent
 *      angular radius merge into constellation-shaped clusters (union-find
 *      connected components — deterministic and order-independent). If the
 *      first radius still leaves too many clickables, the radius widens
 *      geometrically a bounded number of times.
 *   3. SHELL — if no bounded widening fits the budget, every unpinned
 *      satellite collapses into the single orbital-shell glow (one
 *      clickable).
 *
 * Scope note: the rule is enforced scene-wide (all-sky), not per-viewport —
 * the engine sees zoom level but not camera direction. Scene-wide is
 * strictly stronger than §11's per-view wording, so it can never violate it.
 *
 * Zoom levels are discrete FOV bands (§11 itself speaks of "any zoom
 * level"), which also gives the renderer natural hysteresis: aggregation
 * only recomputes when the camera crosses a band edge, never per frame.
 */

export type SkyObjectKind = 'satellite' | 'planet' | 'sun';

export interface SkyObjectInput {
  id: string;
  kind: SkyObjectKind;
  azimuthDeg: number;
  altitudeDeg: number;
  /**
   * Never aggregated (still counts toward the 7). The ISS is pinned: it is
   * the product's hero object — §11's opening sequence tethers, cursor
   * gravity, and camera lock all address it individually.
   */
  pinned?: boolean;
}

/** DESIGN_SPEC.md §11 — the Rule of 7. */
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
 * Drill-in target FOV for a cluster/shell click at `level`: the midpoint of
 * the next band in — clicking an aggregate zooms the camera to where that
 * aggregate resolves further. Already at level 0 → stay at level 0's mid.
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

export function mergeRadiusDeg(level: ZoomLevel): number {
  return APPARENT_SEPARATION_FRACTION * ZOOM_FOV_MIDPOINTS_DEG[level];
}

/**
 * Bounded escalation before giving up and going to the shell: radius ×1.5
 * per extra attempt, 3 extra attempts (up to ~3.4× the base radius).
 */
const ESCALATION_FACTOR = 1.5;
const MAX_ESCALATION_STEPS = 3;

/**
 * A cluster is only "constellation-shaped" (§11) while it stays compact —
 * beyond ~15° from centroid to farthest member (~30° across, the span of a
 * large real constellation) the glyph stops reading as one asterism.
 * Union-find chains can otherwise link an evenly-spread population into one
 * sky-wide component, which would satisfy the cap while being illegible.
 * Widening the radius only grows extent, so an over-extended component at
 * any step escalates straight to the shell. Invented presentation constant —
 * flagged in DECISIONS.md.
 */
const MAX_CLUSTER_EXTENT_DEG = 15;

// ─── Angular math (same alt/az sphere mapping as the scene) ─────────────────

function toUnitVector(altitudeDeg: number, azimuthDeg: number): [number, number, number] {
  const alt = (altitudeDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)];
}

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

export interface ClusterRenderable {
  kind: 'cluster';
  /** Stable across small membership changes: keyed by the first member id. */
  id: string;
  azimuthDeg: number;
  altitudeDeg: number;
  /** Sorted by id — the constellation glyph draws these real positions. */
  members: SkyObjectInput[];
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

export type SkyRenderable = IndividualRenderable | ClusterRenderable | ShellRenderable;

export interface AggregationResult {
  regime: 'individual' | 'clustered' | 'shell';
  renderables: SkyRenderable[];
  /** The number the Rule of 7 caps — always ≤ MAX_CLICKABLE_OBJECTS. */
  clickableCount: number;
}

const SHELL_CORE_MIN_ALTITUDE_DEG = 15;

/** Union-find with path compression. */
function findRoot(parent: number[], i: number): number {
  let r = i;
  for (;;) {
    const p = parent[r];
    if (p === undefined || p === r) break;
    r = p;
  }
  let cur = i;
  while (cur !== r) {
    const next = parent[cur];
    if (next === undefined) break;
    parent[cur] = r;
    cur = next;
  }
  return r;
}

/** Connected components of `sats` under angular threshold, sorted lists. */
function clusterComponents(sats: SkyObjectInput[], radiusDeg: number): SkyObjectInput[][] {
  const parent = sats.map((_, i) => i);
  for (let i = 0; i < sats.length; i++) {
    const si = sats[i];
    if (si === undefined) continue;
    for (let j = i + 1; j < sats.length; j++) {
      const sj = sats[j];
      if (sj === undefined) continue;
      if (angularSeparationDeg(si, sj) <= radiusDeg) {
        parent[findRoot(parent, i)] = findRoot(parent, j);
      }
    }
  }
  const byRoot = new Map<number, SkyObjectInput[]>();
  sats.forEach((s, i) => {
    const r = findRoot(parent, i);
    const list = byRoot.get(r);
    if (list) list.push(s);
    else byRoot.set(r, [s]);
  });
  const components = [...byRoot.values()];
  components.forEach((c) => c.sort((a, b) => a.id.localeCompare(b.id)));
  components.sort((a, b) => (a[0]?.id ?? '').localeCompare(b[0]?.id ?? ''));
  return components;
}

/** Max member-to-centroid separation — the compactness measure. */
function clusterExtentDeg(members: SkyObjectInput[]): number {
  const centroid = sphericalCentroid(members);
  return members.reduce((max, m) => Math.max(max, angularSeparationDeg(m, centroid)), 0);
}

/**
 * The Rule of 7 gate. Deterministic: same inputs → same output, regardless
 * of input order (components and members are id-sorted).
 *
 * Anchors (non-satellites + pinned satellites) always render individually;
 * the product's real anchor roster (Sun, planets, pinned ISS) is bounded
 * well under 7, so the budget for satellite renderables is always ≥ 1.
 */
export function aggregateSkyObjects(
  objects: readonly SkyObjectInput[],
  level: ZoomLevel,
): AggregationResult {
  const anchors = objects
    .filter((o) => o.kind !== 'satellite' || o.pinned === true)
    .sort((a, b) => a.id.localeCompare(b.id));
  const sats = objects
    .filter((o) => o.kind === 'satellite' && o.pinned !== true)
    .sort((a, b) => a.id.localeCompare(b.id));

  const anchorRenderables: SkyRenderable[] = anchors.map((object) => ({ kind: 'object', object }));

  // Under the cap: the rule isn't triggered, nothing aggregates.
  if (objects.length <= MAX_CLICKABLE_OBJECTS) {
    return {
      regime: 'individual',
      renderables: [
        ...anchorRenderables,
        ...sats.map<SkyRenderable>((object) => ({ kind: 'object', object })),
      ],
      clickableCount: objects.length,
    };
  }

  // Over the cap with nothing aggregatable (roster-impossible: anchors are
  // bounded under 7) — render anchors rather than crash on an empty shell.
  if (sats.length === 0) {
    return {
      regime: 'individual',
      renderables: anchorRenderables,
      clickableCount: anchors.length,
    };
  }

  const budget = MAX_CLICKABLE_OBJECTS - anchors.length;

  // Over the cap: cluster at the level's radius, widening a bounded number
  // of times if the component count still busts the budget.
  if (budget >= 1) {
    for (let step = 0; step <= MAX_ESCALATION_STEPS; step++) {
      const radius = mergeRadiusDeg(level) * ESCALATION_FACTOR ** step;
      const components = clusterComponents(sats, radius);
      // An over-extended component can't render as a constellation, and
      // widening only grows extent — stop escalating, go to the shell.
      if (components.some((c) => c.length > 1 && clusterExtentDeg(c) > MAX_CLUSTER_EXTENT_DEG)) {
        break;
      }
      if (components.length > budget) continue;

      const satRenderables = components.map<SkyRenderable>((members) => {
        const first = members[0];
        if (first !== undefined && members.length === 1) {
          return { kind: 'object', object: first };
        }
        const centroid = sphericalCentroid(members);
        return {
          kind: 'cluster',
          id: `cluster:${first?.id ?? ''}`,
          azimuthDeg: centroid.azimuthDeg,
          altitudeDeg: centroid.altitudeDeg,
          members,
        };
      });
      return {
        regime: satRenderables.some((r) => r.kind === 'cluster') ? 'clustered' : 'individual',
        renderables: [...anchorRenderables, ...satRenderables],
        clickableCount: anchors.length + components.length,
      };
    }
  }

  // Widening never fit the budget: the single orbital shell glow.
  const centroid = sphericalCentroid(sats);
  const shell: ShellRenderable = {
    kind: 'shell',
    id: 'orbital-shell',
    count: sats.length,
    azimuthDeg: centroid.azimuthDeg,
    altitudeDeg: Math.max(SHELL_CORE_MIN_ALTITUDE_DEG, centroid.altitudeDeg),
  };
  return {
    regime: 'shell',
    renderables: [...anchorRenderables, shell],
    clickableCount: anchors.length + 1,
  };
}
