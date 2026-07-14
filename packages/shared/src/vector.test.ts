import { describe, expect, it } from 'vitest';
import { dot, magnitude, scale, subtract } from './vector';

describe('vector helpers', () => {
  it('computes the dot product', () => {
    expect(dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32);
  });

  it('scales a vector by a scalar', () => {
    expect(scale({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 });
  });

  it('subtracts one vector from another', () => {
    expect(subtract({ x: 5, y: 5, z: 5 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 4, y: 3, z: 2 });
  });

  it('computes magnitude (3-4-5 triangle in the x-y plane)', () => {
    expect(magnitude({ x: 3, y: 4, z: 0 })).toBe(5);
  });
});
