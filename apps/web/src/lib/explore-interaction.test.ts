import { describe, expect, it } from 'vitest';
import {
  clampDepth,
  computeGravityBias,
  DEPTH_HOLD_THRESHOLDS_MS,
  findGravityTarget,
  nextDepth,
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
});
