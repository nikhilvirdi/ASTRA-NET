import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { DUR_REDUCED_MOTION_FADE, OPENING_SEQUENCE } from '@/lib/motion';
import {
  computeGravityBias,
  findGravityTarget,
  type GravityTarget,
} from '@/lib/explore-interaction';

/**
 * Ground-view camera: drag to look, wheel to zoom (FOV), with momentum —
 * plus the §11 GSAP camera rig rows:
 *
 *   0:20 — "On click: the camera lifts — a long expo.inOut rise ... 1.6s —
 *   and locks to the ISS in true orbital motion." Implemented as a cinematic
 *   yaw/pitch/FOV tween onto the target followed by a per-frame follow while
 *   the target moves (`mode: 'lock'`). The literal ground-to-orbit flight
 *   (Earth resolving below) belongs to the orbit view, which still doesn't
 *   exist — same documented deferral as the Auroral Ring's ground-view
 *   reading (see DECISIONS.md).
 *
 *   0:40 — "The user drags. Camera breaks lock. Control is now entirely
 *   theirs." Any pointerdown or wheel while focused kills the tween/follow
 *   and hands control back, reported via `onFocusRelease('user-break')`.
 *
 * `mode: 'flyTo'` is the same cinematic move without the follow — used by
 * the semantic-zoom drill-in (cluster/shell click) — releasing itself on
 * arrival via `onFocusRelease('arrived')`.
 *
 * §7.6: under prefers-reduced-motion the cinematic collapses to a 200ms
 * linear move.
 */

export interface CameraFocusTarget {
  /** Changing the id starts a new cinematic; same-id updates only move the follow target. */
  id: string;
  azimuthDeg: number;
  altitudeDeg: number;
  /** 'lock' follows the target until user input breaks it; 'flyTo' releases on arrival. */
  mode: 'lock' | 'flyTo';
  /** FOV to arrive at (clamped to the controller's min/max). */
  fovDeg?: number;
}

export type FocusReleaseReason = 'user-break' | 'arrived';

export type { GravityTarget };

interface CameraControllerProps {
  /** Minimum vertical pitch angle in radians (e.g. -5° below horizon) */
  minPitch?: number;
  /** Maximum vertical pitch angle in radians (e.g. 88° near zenith) */
  maxPitch?: number;
  /** Minimum Field of View for zoom in (degrees) */
  minFov?: number;
  /** Maximum Field of View for zoom out (degrees) */
  maxFov?: number;
  /** Cinematic focus request; null = free camera. */
  focusTarget?: CameraFocusTarget | null;
  /** The focus ended: the user broke the lock, or a flyTo arrived. */
  onFocusRelease?: (reason: FocusReleaseReason) => void;
  /** Selectable target screen positions for 40px/60ms cursor gravity (§11). */
  gravityTargets?: GravityTarget[];
  /** Pointer position in client coordinates for cursor gravity. */
  pointerPos?: { x: number; y: number } | null;
}

/** Camera yaw (YXZ order, radians) that looks toward an azimuth, nearest-turn from `fromYaw`. */
function nearestYawForAzimuth(azimuthDeg: number, fromYaw: number): number {
  const TWO_PI = Math.PI * 2;
  const desired = -((azimuthDeg * Math.PI) / 180);
  const delta = ((((desired - fromYaw) % TWO_PI) + TWO_PI + Math.PI) % TWO_PI) - Math.PI;
  return fromYaw + delta;
}

export function CameraController({
  minPitch = -Math.PI / 36, // -5 degrees (slightly below horizon rule)
  maxPitch = Math.PI / 2 - 0.02, // ~88.8 degrees (just under zenith to prevent gimbal lock)
  minFov = 30,
  maxFov = 90,
  focusTarget = null,
  onFocusRelease,
  gravityTargets = [],
  pointerPos = null,
}: CameraControllerProps): React.ReactElement | null {
  const { camera, gl } = useThree();

  // Angle targets and current smoothed angles
  const targetYaw = useRef<number>(0);
  const targetPitch = useRef<number>(Math.PI / 8); // default ~22.5° look up
  const currentYaw = useRef<number>(0);
  const currentPitch = useRef<number>(Math.PI / 8);

  // FOV target and current
  const targetFov = useRef<number>(60);
  const currentFov = useRef<number>(60);

  // Velocity for momentum / inertia
  const velocityYaw = useRef<number>(0);
  const velocityPitch = useRef<number>(0);

  // Drag tracking state
  const isDragging = useRef<boolean>(false);
  const previousPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Focus rig state
  const focusPhase = useRef<'idle' | 'tweening' | 'locked'>('idle');
  const focusRef = useRef<CameraFocusTarget | null>(focusTarget);
  focusRef.current = focusTarget;
  const focusTween = useRef<gsap.core.Tween | null>(null);
  const onFocusReleaseRef = useRef(onFocusRelease);
  onFocusReleaseRef.current = onFocusRelease;

  const releaseFocus = useRef((reason: FocusReleaseReason): void => {
    if (focusPhase.current === 'idle') return;
    focusTween.current?.kill();
    focusTween.current = null;
    focusPhase.current = 'idle';
    onFocusReleaseRef.current?.(reason);
  }).current;

  // Start/replace the cinematic when a (new) focus target arrives.
  const focusId = focusTarget?.id ?? null;
  const focusMode = focusTarget?.mode ?? null;
  useEffect(() => {
    focusTween.current?.kill();
    focusTween.current = null;
    if (focusId === null || focusMode === null) {
      focusPhase.current = 'idle';
      return;
    }
    const target = focusRef.current;
    if (target === null) return;

    focusPhase.current = 'tweening';
    velocityYaw.current = 0;
    velocityPitch.current = 0;

    const endYaw = nearestYawForAzimuth(target.azimuthDeg, targetYaw.current);
    const endPitch = Math.max(minPitch, Math.min(maxPitch, (target.altitudeDeg * Math.PI) / 180));
    const endFov = Math.max(minFov, Math.min(maxFov, target.fovDeg ?? targetFov.current));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const proxy = { y: targetYaw.current, p: targetPitch.current, f: targetFov.current };
    focusTween.current = gsap.to(proxy, {
      y: endYaw,
      p: endPitch,
      f: endFov,
      duration: reduced ? DUR_REDUCED_MOTION_FADE : OPENING_SEQUENCE.orbitRiseDuration,
      ease: reduced ? 'none' : OPENING_SEQUENCE.orbitRiseEase,
      onUpdate: () => {
        targetYaw.current = proxy.y;
        targetPitch.current = proxy.p;
        targetFov.current = proxy.f;
      },
      onComplete: () => {
        focusTween.current = null;
        if (focusMode === 'lock') {
          focusPhase.current = 'locked';
        } else {
          focusPhase.current = 'idle';
          onFocusReleaseRef.current?.('arrived');
        }
      },
    });

    return () => {
      focusTween.current?.kill();
      focusTween.current = null;
    };
  }, [focusId, focusMode, minPitch, maxPitch, minFov, maxFov]);

  useEffect(() => {
    const dom = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // §11 0:40 — user input breaks the lock.
      releaseFocus('user-break');
      isDragging.current = true;
      previousPointer.current = { x: e.clientX, y: e.clientY };
      velocityYaw.current = 0;
      velocityPitch.current = 0;
      dom.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - previousPointer.current.x;
      const deltaY = e.clientY - previousPointer.current.y;
      previousPointer.current = { x: e.clientX, y: e.clientY };

      // Sensitivity factor scaled by current FOV
      const sensitivity = 0.003 * (targetFov.current / 60);

      const dyaw = -deltaX * sensitivity;
      const dpitch = -deltaY * sensitivity;

      targetYaw.current += dyaw;
      targetPitch.current = Math.max(minPitch, Math.min(maxPitch, targetPitch.current + dpitch));

      velocityYaw.current = dyaw;
      velocityPitch.current = dpitch;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      try {
        if (dom.hasPointerCapture(e.pointerId)) {
          dom.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if pointer capture release fails
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Wheel is camera motion the user takes — it breaks a lock too.
      releaseFocus('user-break');
      const zoomSpeed = 0.05;
      const delta = e.deltaY * zoomSpeed;
      targetFov.current = Math.max(minFov, Math.min(maxFov, targetFov.current + delta));
    };

    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('pointercancel', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('pointercancel', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel);
    };
  }, [gl, minPitch, maxPitch, minFov, maxFov, releaseFocus]);

  useFrame(() => {
    const damping = 0.15;

    // Locked: track the target's live position (it updates via props as the
    // ISS moves along its pass); the damping below smooths the small steps.
    if (focusPhase.current === 'locked') {
      const target = focusRef.current;
      if (target !== null) {
        targetYaw.current = nearestYawForAzimuth(target.azimuthDeg, targetYaw.current);
        targetPitch.current = Math.max(
          minPitch,
          Math.min(maxPitch, (target.altitudeDeg * Math.PI) / 180),
        );
      }
    }

    if (!isDragging.current && focusPhase.current === 'idle') {
      targetYaw.current += velocityYaw.current;
      targetPitch.current = Math.max(
        minPitch,
        Math.min(maxPitch, targetPitch.current + velocityPitch.current),
      );
      velocityYaw.current *= 0.92;
      velocityPitch.current *= 0.92;

      // §11 Cursor gravity: pointer magnetically biased toward selectable objects within 40px with a 60ms ease
      const nearestTarget = findGravityTarget(pointerPos, gravityTargets, 40);
      if (nearestTarget) {
        const biasYaw = nearestYawForAzimuth(nearestTarget.azimuthDeg, targetYaw.current);
        const biasPitch = Math.max(
          minPitch,
          Math.min(maxPitch, (nearestTarget.altitudeDeg * Math.PI) / 180),
        );
        const biased = computeGravityBias(
          targetYaw.current,
          targetPitch.current,
          biasYaw,
          biasPitch,
          0.35,
        );
        targetYaw.current = biased.yaw;
        targetPitch.current = biased.pitch;
      }
    }

    currentYaw.current += (targetYaw.current - currentYaw.current) * damping;
    currentPitch.current += (targetPitch.current - currentPitch.current) * damping;

    camera.rotation.set(currentPitch.current, currentYaw.current, 0, 'YXZ');
    camera.position.set(0, 0, 0);

    if (camera instanceof THREE.PerspectiveCamera) {
      currentFov.current += (targetFov.current - currentFov.current) * damping;
      if (Math.abs(camera.fov - currentFov.current) > 0.01) {
        camera.fov = currentFov.current;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}
