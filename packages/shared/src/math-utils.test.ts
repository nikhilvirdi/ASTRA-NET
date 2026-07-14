import { describe, expect, it } from 'vitest';
import { bisectionSolve, clamp, degToRad, mod, radToDeg } from './math-utils';

describe('degToRad / radToDeg', () => {
  it('converts 180 degrees to pi radians and back', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 10);
  });
});

describe('mod', () => {
  it('wraps positive values within range', () => {
    expect(mod(370, 360)).toBeCloseTo(10, 10);
  });

  it('wraps negative values to a positive result', () => {
    expect(mod(-10, 360)).toBeCloseTo(350, 10);
  });
});

describe('clamp', () => {
  it('passes values already in range through unchanged', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('clamps values below the lower bound', () => {
    expect(clamp(-5, 0, 1)).toBe(0);
  });

  it('clamps values above the upper bound', () => {
    expect(clamp(5, 0, 1)).toBe(1);
  });
});

describe('bisectionSolve', () => {
  it('solves a simple linear function without needing to expand the bracket', () => {
    // f(x) = x, target = 5, already bracketed in [0, 10] — hi-doubling loop never runs.
    const root = bisectionSolve((x) => x, 5, 0, 10);
    expect(root).toBeCloseTo(5, 6);
  });

  it('expands the upper bracket when the initial guess is too small', () => {
    // f(x) = x, target = 100, initial hi = 1 — forces the doubling loop to run.
    const root = bisectionSolve((x) => x, 100, 0, 1);
    expect(root).toBeCloseTo(100, 3);
  });

  it('solves a monotonic non-linear function', () => {
    const root = bisectionSolve((x) => x * x, 9, 0, 10);
    expect(root).toBeCloseTo(3, 3);
  });
});
