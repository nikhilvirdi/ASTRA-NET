import { describe, expect, it } from 'vitest';
import { selectLearningMoment } from './learning-moment';

describe('selectLearningMoment', () => {
  it('always returns a non-empty string', () => {
    expect(selectLearningMoment(new Date('2026-07-17T00:00:00Z')).length).toBeGreaterThan(0);
  });

  it('is deterministic within the same UTC day', () => {
    const a = selectLearningMoment(new Date('2026-07-17T00:00:01Z'));
    const b = selectLearningMoment(new Date('2026-07-17T23:59:59Z'));
    expect(a).toBe(b);
  });

  it('rotates across day boundaries', () => {
    const day1 = selectLearningMoment(new Date('2026-07-17T12:00:00Z'));
    const day2 = selectLearningMoment(new Date('2026-07-18T12:00:00Z'));
    expect(day1).not.toBe(day2);
  });

  it('never throws for dates before the Unix epoch', () => {
    expect(() => selectLearningMoment(new Date('1969-01-01T00:00:00Z'))).not.toThrow();
  });
});
