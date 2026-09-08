// apps/web/src/hooks/useDeviceOrientation.ts

import { useEffect, useRef, useState } from 'react';

/**
 * iOS Safari exposes a static `requestPermission()` method on `DeviceOrientationEvent`
 * that is not part of the standard TypeScript lib types. Described as a plain type
 * (not an interface) because interfaces cannot extend `typeof Class`.
 */
type DeviceOrientationEventCtor = {
  requestPermission(): Promise<'granted' | 'denied'>;
};

/**
 * Some browsers (WebKit/Blink on iOS) expose a non-standard `webkitCompassHeading`
 * property on `DeviceOrientationEvent` instances.
 */
interface DeviceOrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading: number;
}

/**
 * Hook for handling device orientation / compass heading.
 * Works on iOS (webkitCompassHeading + requestPermission) and Android Chrome
 * (deviceorientationabsolute). On devices without the API the hook reports
 * `supported: false` and `permissionState: 'unsupported'`.
 */
export interface OrientationReading {
  /** Heading in degrees, clockwise from true north (0‑360). */
  heading: number;
  /** Pitch in degrees, where 0 is horizon and +90 is zenith. */
  pitch: number;
}

export type PermissionState = 'granted' | 'denied' | 'unsupported' | 'idle';

/**
 * Combines the raw `DeviceOrientationEvent` existence check with
 * `navigator.maxTouchPoints > 0`, a much stronger real-device signal.
 *
 * There is no universal, perfectly reliable way to detect "this is a real
 * mobile device with a working orientation sensor" from the web platform —
 * this is a best-effort heuristic, not a guarantee. `DeviceOrientationEvent`
 * alone is a weak signal: many desktop browsers (Chrome, Edge) define it
 * globally with no real sensor behind it, which is exactly why POINT could
 * previously show up on a laptop. `maxTouchPoints > 0` is a standards-based
 * signal that real hardware advertises truthfully far more often than not,
 * so requiring both together rules out the common desktop-false-positive
 * case. It is not flawless either — a touch-enabled laptop or Chromebook
 * with no orientation sensor can still slip through — but that is a much
 * narrower, rarer category of false positive than "any desktop Chrome tab."
 *
 * Deliberately not layering in `navigator.userAgent` sniffing on top: it is
 * easily spoofed/inaccurate and was called out as unreliable as a sole
 * signal — combining two platform capability checks that are themselves
 * imperfect but non-fragile is a better bar than adding a fragile one.
 */
export function detectOrientationSupport(
  hasDeviceOrientationEvent: boolean,
  maxTouchPoints: number,
): boolean {
  return hasDeviceOrientationEvent && maxTouchPoints > 0;
}

export interface UseDeviceOrientationResult {
  /** Whether the device orientation API exists in this environment. */
  supported: boolean;
  /** Current permission/availability state. */
  permissionState: PermissionState;
  /** Latest reading when permission is granted. */
  reading: OrientationReading | null;
  /** Request permission (iOS only). Returns the new permission state. */
  requestPermission: () => Promise<PermissionState>;
  /** Re‑center the heading so the current direction becomes "north". */
  recenter: () => void;
}

/**
 * @param enabled - Whether the hook should actively listen for orientation events.
 */
export function useDeviceOrientation(enabled: boolean): UseDeviceOrientationResult {
  const [supported, setSupported] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [reading, setReading] = useState<OrientationReading | null>(null);

  // Holds an offset applied when the user presses the RECENTER button.
  const headingOffsetRef = useRef<number>(0);

  // Determine API support on mount.
  useEffect(() => {
    const hasApi = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;
    const has = detectOrientationSupport(hasApi, maxTouchPoints);
    setSupported(has);
    if (!has) setPermissionState('unsupported');
  }, []);

  const requestPermission = async (): Promise<PermissionState> => {
    if (!supported) {
      setPermissionState('unsupported');
      return 'unsupported';
    }
    // iOS Safari provides a static method to request permission.
    const Ctor = DeviceOrientationEvent as unknown as Partial<DeviceOrientationEventCtor>;
    if (typeof Ctor.requestPermission === 'function') {
      try {
        const result = await Ctor.requestPermission();
        const state: PermissionState = result === 'granted' ? 'granted' : 'denied';
        setPermissionState(state);
        return state;
      } catch {
        setPermissionState('denied');
        return 'denied';
      }
    }
    // Android / desktop – permission is implicit.
    setPermissionState('granted');
    return 'granted';
  };

  const handleEvent = (e: DeviceOrientationEvent) => {
    if (!e) return;
    // Prefer absolute heading when provided (Android).
    let rawHeading: number | null = null;
    if (e.absolute && typeof e.alpha === 'number') {
      // Alpha is rotation around Z axis, clockwise from north.
      rawHeading = (360 - e.alpha) % 360;
    }
    // iOS provides webkitCompassHeading (magnetic north).
    const eWithCompass = e as Partial<DeviceOrientationEventWithCompass>;
    if (typeof eWithCompass.webkitCompassHeading === 'number') {
      rawHeading = eWithCompass.webkitCompassHeading;
    }
    if (rawHeading === null) return; // No usable heading.

    // Adjust for screen orientation so the heading is relative to the visual top of the device.
    const screenAngle: number =
      typeof screen !== 'undefined' ? (screen.orientation?.angle ?? 0) : 0;
    const correctedHeading = (rawHeading - screenAngle + 360) % 360;

    // Pitch – use beta (front/back tilt). When device is upright portrait and pointing up, beta ≈ 90.
    const rawPitch = typeof e.beta === 'number' ? e.beta : 0;
    const correctedPitch = rawPitch;

    setReading({
      heading: (correctedHeading - headingOffsetRef.current + 360) % 360,
      pitch: correctedPitch,
    });
  };

  // Attach / detach listeners based on `enabled` and permission.
  useEffect(() => {
    if (!enabled || permissionState !== 'granted' || !supported) return undefined;
    const useAbsolute = 'ondeviceorientationabsolute' in window;
    const eventName = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(eventName, handleEvent, { passive: true });
    return () => {
      window.removeEventListener(eventName, handleEvent);
    };
  }, [enabled, permissionState, supported]);

  const recenter = () => {
    if (reading) {
      headingOffsetRef.current = reading.heading;
    }
  };

  return { supported, permissionState, reading, requestPermission, recenter };
}
