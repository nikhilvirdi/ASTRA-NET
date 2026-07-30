import { describe, expect, it } from 'vitest';
import {
  calculateCycleIndex,
  calculateTouchPinchDistance,
  clampDepth,
  computeGravityBias,
  computeOrbitDropState,
  computePinchZoomFov,
  DEPTH_HOLD_THRESHOLDS_MS,
  findGravityTarget,
  GROUND_SKY_ANCHOR_STATE,
  hasScreenPosChanged,
  nextDepth,
  ORBIT_VANTAGE_STATE,
} from './explore-interaction';
import type { GravityTarget } from '@/components/explore/CameraController';

describe('explore-interaction', () => {
  describe('Three-Depth Hold Logic', () => {
    it('defines 500ms and 1000ms thresholds for Depth 2 and Depth 3', () => {
      expect(DEPTH_HOLD_THRESHOLDS_MS.depth2).toBe(500);
      expect(DEPTH_HOLD_THRESHOLDS_MS.depth3).toBe(1000);
    });

    it('advances depth sequentially from 1 to 2 to 3', () => {
      expect(nextDepth(1)).toBe(2);
      expect(nextDepth(2)).toBe(3);
    });

    it('clamps nextDepth at Depth 3 maximum', () => {
      expect(nextDepth(3)).toBe(3);
    });

    it('clamps arbitrary numbers to valid PanelDepth [1, 3]', () => {
      expect(clampDepth(0)).toBe(1);
      expect(clampDepth(1)).toBe(1);
      expect(clampDepth(2)).toBe(2);
      expect(clampDepth(3)).toBe(3);
      expect(clampDepth(5)).toBe(3);
    });
  });

  describe('Cursor Gravity Logic (40px magnetic radius & 60ms ease)', () => {
    const targets: GravityTarget[] = [
      { id: 'iss', azimuthDeg: 120, altitudeDeg: 40, screenX: 500, screenY: 300 },
      { id: 'jupiter', azimuthDeg: 250, altitudeDeg: 30, screenX: 200, screenY: 150 },
    ];

    it('returns null if pointerPos is null or targets array is empty', () => {
      expect(findGravityTarget(null, targets)).toBeNull();
      expect(findGravityTarget({ x: 500, y: 300 }, [])).toBeNull();
    });

    it('finds target when pointer is within 40px radius', () => {
      // 10px away from ISS at (500, 300)
      const hit = findGravityTarget({ x: 510, y: 300 }, targets);
      expect(hit).not.toBeNull();
      expect(hit?.azimuthDeg).toBe(120);
    });

    it('finds target exactly on 40px boundary radius', () => {
      // Exactly 40px away (540, 300)
      const hit = findGravityTarget({ x: 540, y: 300 }, targets, 40);
      expect(hit).not.toBeNull();
      expect(hit?.azimuthDeg).toBe(120);
    });

    it('returns null when pointer is outside 40px radius', () => {
      // 45px away from any target
      const hit = findGravityTarget({ x: 545, y: 300 }, targets, 40);
      expect(hit).toBeNull();
    });

    it('picks the nearest target when multiple targets are within 40px', () => {
      const closeTargets: GravityTarget[] = [
        { azimuthDeg: 10, altitudeDeg: 10, screenX: 100, screenY: 100 },
        { azimuthDeg: 20, altitudeDeg: 20, screenX: 110, screenY: 100 },
      ];
      // Pointer at (108, 100) -> 8px from 2nd, 2px from 2nd target
      const hit = findGravityTarget({ x: 108, y: 100 }, closeTargets, 40);
      expect(hit?.azimuthDeg).toBe(20);
    });

    it('computes exponential lerp gravity bias correctly with ease factor', () => {
      const current = { yaw: 0, pitch: 0.2 };
      const target = { yaw: 1.0, pitch: 0.6 };
      const biased = computeGravityBias(current.yaw, current.pitch, target.yaw, target.pitch, 0.35);

      expect(biased.yaw).toBeCloseTo(0.35);
      expect(biased.pitch).toBeCloseTo(0.34);
    });
  });

  describe('Arrow-Key Object Cycling (calculateCycleIndex)', () => {
    it('returns -1 when totalCount is 0 or negative', () => {
      expect(calculateCycleIndex(0, 0, 'next')).toBe(-1);
      expect(calculateCycleIndex(0, -1, 'prev')).toBe(-1);
    });

    it('starts at index 0 when unselected (-1) moving next', () => {
      expect(calculateCycleIndex(-1, 5, 'next')).toBe(0);
    });

    it('starts at last index (totalCount - 1) when unselected (-1) moving prev', () => {
      expect(calculateCycleIndex(-1, 5, 'prev')).toBe(4);
    });

    it('advances to next index sequentially and wraps around at end', () => {
      expect(calculateCycleIndex(0, 3, 'next')).toBe(1);
      expect(calculateCycleIndex(1, 3, 'next')).toBe(2);
      expect(calculateCycleIndex(2, 3, 'next')).toBe(0);
    });

    it('decrements index sequentially and wraps around to end at start', () => {
      expect(calculateCycleIndex(2, 3, 'prev')).toBe(1);
      expect(calculateCycleIndex(1, 3, 'prev')).toBe(0);
      expect(calculateCycleIndex(0, 3, 'prev')).toBe(2);
    });

    it('resets out-of-bounds current index safely', () => {
      expect(calculateCycleIndex(10, 5, 'next')).toBe(0);
      expect(calculateCycleIndex(10, 5, 'prev')).toBe(4);
    });
  });

  describe('Pinch-to-Zoom Touch Math (computePinchZoomFov & calculateTouchPinchDistance)', () => {
    it('calculates 2D distance between two points correctly', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(calculateTouchPinchDistance(p1, p2)).toBe(5);
    });

    it('zooms in (reduces FOV) when pinch distance increases (fingers move apart)', () => {
      // Initial FOV = 60°, initial dist = 100px. Current dist = 200px (fingers spread)
      // scale = 100 / 200 = 0.5 -> FOV = 30°
      const fov = computePinchZoomFov(60, 100, 200);
      expect(fov).toBe(30);
    });

    it('zooms out (increases FOV) when pinch distance decreases (fingers move together)', () => {
      // Initial FOV = 40°, initial dist = 200px. Current dist = 100px (fingers pinch in)
      // scale = 200 / 100 = 2.0 -> FOV = 80°
      const fov = computePinchZoomFov(40, 200, 100);
      expect(fov).toBe(80);
    });

    it('clamps resulting FOV to minFov and maxFov bounds', () => {
      // Extreme pinch apart -> FOV would be 10°, clamped to minFov 30°
      expect(computePinchZoomFov(60, 100, 600, 30, 90)).toBe(30);
      // Extreme pinch together -> FOV would be 120°, clamped to maxFov 90°
      expect(computePinchZoomFov(60, 300, 100, 30, 90)).toBe(90);
    });

    it('returns initial FOV safely when distance inputs are non-positive', () => {
      expect(computePinchZoomFov(60, 0, 100)).toBe(60);
      expect(computePinchZoomFov(60, 100, 0)).toBe(60);
    });
  });

  describe('Screen Position Map Throttling (hasScreenPosChanged)', () => {
    it('returns false when position maps are identical', () => {
      const pos = { iss: { x: 100, y: 200, inView: true } };
      expect(hasScreenPosChanged(pos, pos)).toBe(false);
    });

    it('returns false when position shifts are below minDeltaPx threshold (0.5px)', () => {
      const prev = { iss: { x: 100, y: 200, inView: true } };
      const next = { iss: { x: 100.2, y: 200.3, inView: true } };
      expect(hasScreenPosChanged(prev, next, 0.5)).toBe(false);
    });

    it('returns true when position shift exceeds minDeltaPx threshold', () => {
      const prev = { iss: { x: 100, y: 200, inView: true } };
      const next = { iss: { x: 101.0, y: 200.0, inView: true } };
      expect(hasScreenPosChanged(prev, next, 0.5)).toBe(true);
    });

    it('returns true when visibility (inView) changes', () => {
      const prev = { iss: { x: 100, y: 200, inView: true } };
      const next = { iss: { x: 100, y: 200, inView: false } };
      expect(hasScreenPosChanged(prev, next)).toBe(true);
    });

    it('returns true when object key sets differ', () => {
      const prev = { iss: { x: 100, y: 200, inView: true } };
      const next = {
        iss: { x: 100, y: 200, inView: true },
        jupiter: { x: 300, y: 400, inView: true },
      };
      expect(hasScreenPosChanged(prev, next)).toBe(true);
    });
  });

  describe('Orbit-Drop Camera Trajectory (computeOrbitDropState)', () => {
    it('returns exact orbital vantage state at progress 0', () => {
      const state = computeOrbitDropState(0);
      expect(state).toEqual(ORBIT_VANTAGE_STATE);
      expect(state.y).toBe(800);
      expect(state.z).toBe(400);
      expect(state.pitch).toBe(-0.8);
      expect(state.fov).toBe(90);
    });

    it('returns exact ground Sky Anchor state at progress 1', () => {
      const state = computeOrbitDropState(1);
      expect(state).toEqual(GROUND_SKY_ANCHOR_STATE);
      expect(state.x).toBe(0);
      expect(state.y).toBe(0);
      expect(state.z).toBe(0);
      expect(state.pitch).toBeCloseTo(Math.PI / 8);
      expect(state.fov).toBe(60);
    });

    it('interpolates intermediate camera state linearly at progress 0.5', () => {
      const state = computeOrbitDropState(0.5);
      expect(state.y).toBe(400);
      expect(state.z).toBe(200);
      expect(state.pitch).toBeCloseTo((-0.8 + Math.PI / 8) / 2);
      expect(state.fov).toBe(75);
    });

    it('clamps progress below 0 to orbital vantage state', () => {
      const state = computeOrbitDropState(-0.5);
      expect(state).toEqual(ORBIT_VANTAGE_STATE);
    });

    it('clamps progress above 1 to ground Sky Anchor state', () => {
      const state = computeOrbitDropState(1.5);
      expect(state).toEqual(GROUND_SKY_ANCHOR_STATE);
    });
  });
});
