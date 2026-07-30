/**
 * Explore page interaction helpers — Cursor Gravity (§11) & Three-Depth Hold.
 * Pure functions extracted for unit testing (DESIGN_SPEC.md §11).
 */

export interface GravityTarget {
  id?: string;
  azimuthDeg: number;
  altitudeDeg: number;
  screenX: number;
  screenY: number;
}

/** Hold thresholds in milliseconds for progressive depth disclosure (§11). */
export const DEPTH_HOLD_THRESHOLDS_MS = {
  depth2: 500,
  depth3: 1000,
} as const;

export type PanelDepth = 1 | 2 | 3;

/**
 * Advances depth level by 1, clamped at maximum Depth 3.
 */
export function nextDepth(current: PanelDepth): PanelDepth {
  if (current >= 3) return 3;
  return (current + 1) as PanelDepth;
}

/**
 * Clamps any numeric depth value to valid PanelDepth [1, 3].
 */
export function clampDepth(depth: number): PanelDepth {
  if (depth <= 1) return 1;
  if (depth >= 3) return 3;
  return 2;
}

/**
 * Finds the nearest GravityTarget within a screen-space magnetic radius (default 40px).
 * Returns null if no targets are within the specified radius or if pointerPos is null.
 */
export function findGravityTarget(
  pointerPos: { x: number; y: number } | null,
  targets: readonly GravityTarget[],
  radiusPx = 40,
): GravityTarget | null {
  if (!pointerPos || !targets || targets.length === 0) return null;

  let nearest: GravityTarget | null = null;
  let minDistance = radiusPx;

  for (const target of targets) {
    const dx = pointerPos.x - target.screenX;
    const dy = pointerPos.y - target.screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= minDistance) {
      minDistance = dist;
      nearest = target;
    }
  }

  return nearest;
}

/**
 * Applies exponential lerp (60ms ease factor) from current yaw/pitch toward desired target.
 */
export function computeGravityBias(
  currentYaw: number,
  currentPitch: number,
  targetYaw: number,
  targetPitch: number,
  easeFactor = 0.35,
): { yaw: number; pitch: number } {
  return {
    yaw: currentYaw + (targetYaw - currentYaw) * easeFactor,
    pitch: currentPitch + (targetPitch - currentPitch) * easeFactor,
  };
}

export type CycleDirection = 'next' | 'prev';

/**
 * Calculates the next index when cycling through interactive objects.
 * Returns -1 if totalCount is 0 or negative.
 */
export function calculateCycleIndex(
  currentIndex: number,
  totalCount: number,
  direction: CycleDirection,
): number {
  if (totalCount <= 0) return -1;

  if (currentIndex < 0 || currentIndex >= totalCount) {
    return direction === 'next' ? 0 : totalCount - 1;
  }

  if (direction === 'next') {
    return (currentIndex + 1) % totalCount;
  }

  return (currentIndex - 1 + totalCount) % totalCount;
}

/**
 * Computes pinch-to-zoom FOV from touch distance ratio, clamped to [minFov, maxFov].
 */
export function computePinchZoomFov(
  initialFov: number,
  initialPinchDist: number,
  currentPinchDist: number,
  minFov = 30,
  maxFov = 90,
): number {
  if (initialPinchDist <= 0 || currentPinchDist <= 0) return initialFov;
  const scale = initialPinchDist / currentPinchDist;
  const target = initialFov * scale;
  return Math.max(minFov, Math.min(maxFov, target));
}

/**
 * Calculates 2D Euclidean distance between two touch points.
 */
export function calculateTouchPinchDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
