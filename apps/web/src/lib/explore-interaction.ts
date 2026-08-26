/**
 * Explore page interaction helpers — Cursor Gravity (§11) & Object Cycling.
 * Pure functions extracted for unit testing (DESIGN_SPEC.md §11).
 */

export interface GravityTarget {
  id?: string;
  azimuthDeg: number;
  altitudeDeg: number;
  screenX: number;
  screenY: number;
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

export interface SimpleScreenPos {
  x: number;
  y: number;
  inView: boolean;
}

/**
 * Checks if two screen position maps differ significantly (shift > minDeltaPx or inView change).
 */
export function hasScreenPosChanged(
  prev: Record<string, SimpleScreenPos>,
  next: Record<string, SimpleScreenPos>,
  minDeltaPx = 0.5,
): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return true;

  for (const key of nextKeys) {
    const p = prev[key];
    const n = next[key];
    if (!p || !n) return true;
    if (p.inView !== n.inView) return true;
    if (Math.abs(p.x - n.x) > minDeltaPx || Math.abs(p.y - n.y) > minDeltaPx) {
      return true;
    }
  }

  return false;
}

export interface CameraState {
  x: number;
  y: number;
  z: number;
  pitch: number;
  fov: number;
}

export const ORBIT_VANTAGE_STATE: CameraState = {
  x: 0,
  y: 800,
  z: 400,
  pitch: -0.8,
  fov: 90,
};

export const GROUND_SKY_ANCHOR_STATE: CameraState = {
  x: 0,
  y: 0,
  z: 0,
  pitch: Math.PI / 8,
  fov: 60,
};

/**
 * Computes camera state along the Orbit-Drop trajectory given normalized progress t in [0, 1].
 */
export function computeOrbitDropState(
  progress: number,
  start: CameraState = ORBIT_VANTAGE_STATE,
  end: CameraState = GROUND_SKY_ANCHOR_STATE,
): CameraState {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
    pitch: start.pitch + (end.pitch - start.pitch) * t,
    fov: start.fov + (end.fov - start.fov) * t,
  };
}

export interface CardinalMarkInput {
  label: string;
  azimuthRad: number;
  position: [number, number, number];
}

/**
 * Filters and sorts cardinal marks to prevent grazing-angle screen collisions and back-face rendering.
 */
export function filterVisibleCardinalMarks(
  marks: readonly CardinalMarkInput[],
  cameraYaw: number,
  cameraPitch: number,
  minCosAngle = 0.05,
  minAngularSeparationRad = 0.35,
): CardinalMarkInput[] {
  const cosPitch = Math.cos(cameraPitch);
  const camX = -Math.sin(cameraYaw) * cosPitch;
  const camY = Math.sin(cameraPitch);
  const camZ = -Math.cos(cameraYaw) * cosPitch;

  const scored = marks
    .map((m) => {
      const len = Math.hypot(m.position[0], m.position[1], m.position[2]) || 1;
      const dirX = m.position[0] / len;
      const dirY = m.position[1] / len;
      const dirZ = m.position[2] / len;
      const dot = camX * dirX + camY * dirY + camZ * dirZ;
      return { mark: m, dot, dirX, dirY, dirZ };
    })
    .filter((s) => s.dot >= minCosAngle);

  scored.sort((a, b) => b.dot - a.dot);

  const result: CardinalMarkInput[] = [];
  const acceptedDirs: { x: number; y: number; z: number }[] = [];

  for (const item of scored) {
    let tooClose = false;
    for (const prev of acceptedDirs) {
      const cosSep = item.dirX * prev.x + item.dirY * prev.y + item.dirZ * prev.z;
      const angleSep = Math.acos(Math.max(-1, Math.min(1, cosSep)));
      if (angleSep < minAngularSeparationRad) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      result.push(item.mark);
      acceptedDirs.push({ x: item.dirX, y: item.dirY, z: item.dirZ });
    }
  }

  return result;
}

/**
 * Checks if cardinal mark selection has changed (by label sequence).
 */
export function hasCardinalMarksChanged(
  current: readonly CardinalMarkInput[],
  next: readonly CardinalMarkInput[],
): boolean {
  if (current.length !== next.length) return true;
  for (let i = 0; i < current.length; i++) {
    if (current[i]?.label !== next[i]?.label) return true;
  }
  return false;
}
