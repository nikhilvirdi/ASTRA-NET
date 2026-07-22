import { describe, expect, it } from 'vitest';
import { selectNearestByTimeTag } from './time-match.js';

const NOW = new Date('2026-07-22T12:00:00Z');

function entry(hoursFromNow: number, label: string): { timeTag: string; label: string } {
  return { timeTag: new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString(), label };
}

describe('selectNearestByTimeTag', () => {
  it('returns null for an empty list', () => {
    expect(selectNearestByTimeTag([], NOW)).toBeNull();
  });

  it('picks the entry closest to the target, regardless of before/after', () => {
    const far = entry(-9, 'far-before');
    const near = entry(1, 'near-after');
    const alsoFar = entry(12, 'far-after');
    expect(selectNearestByTimeTag([far, near, alsoFar], NOW)).toEqual(near);
  });

  it('works over any entry shape that carries a timeTag', () => {
    const a = entry(-3, 'a');
    const b = entry(3, 'b');
    // Equidistant — reduce()'s left-to-right scan keeps the first seen on a tie.
    expect(selectNearestByTimeTag([a, b], NOW)).toEqual(a);
  });
});
