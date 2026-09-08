import { describe, it, expect } from 'vitest';
import { resolveReducedMotion } from './motion';

describe('resolveReducedMotion', () => {
  it('"system" follows the OS media query exactly, in both directions', () => {
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
  });

  it('"on" forces reduced motion regardless of the OS setting', () => {
    expect(resolveReducedMotion('on', false)).toBe(true);
    expect(resolveReducedMotion('on', true)).toBe(true);
  });

  it('"off" forces full motion regardless of the OS setting', () => {
    expect(resolveReducedMotion('off', true)).toBe(false);
    expect(resolveReducedMotion('off', false)).toBe(false);
  });
});
