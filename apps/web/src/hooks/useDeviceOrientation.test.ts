import { describe, it, expect } from 'vitest';
import { detectOrientationSupport } from './useDeviceOrientation';

describe('detectOrientationSupport', () => {
  it('is supported when both the API exists and the device has touch points', () => {
    expect(detectOrientationSupport(true, 1)).toBe(true);
    expect(detectOrientationSupport(true, 5)).toBe(true);
  });

  it('is NOT supported on a desktop browser that merely defines the API (the original bug)', () => {
    // Chrome/Edge desktop: DeviceOrientationEvent exists globally, maxTouchPoints is 0.
    expect(detectOrientationSupport(true, 0)).toBe(false);
  });

  it('is not supported when the API does not exist, even with touch points', () => {
    // A touch device whose browser genuinely lacks the API.
    expect(detectOrientationSupport(false, 5)).toBe(false);
  });

  it('is not supported when neither signal is present', () => {
    expect(detectOrientationSupport(false, 0)).toBe(false);
  });
});
