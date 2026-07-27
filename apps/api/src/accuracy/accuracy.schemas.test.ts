import { describe, it, expect } from 'vitest';
import { AccuracyPayloadSchema } from './accuracy.schemas.js';

/** A validator is only proven by what it rejects. */

function point(over: Record<string, unknown> = {}) {
  return {
    targetTime: '2026-06-01T00:00:00.000Z',
    predictedKp: 5,
    actualKp: 5,
    hit: true,
    ...over,
  };
}

function payload(over: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-07-27T20:00:00.000Z',
    series: [point()],
    hitRate: { hits: 1, trials: 1, rate: 0.6, rawRate: 1, prior: { hits: 2, trials: 4 } },
    empty: false,
    ...over,
  };
}

describe('AccuracyPayloadSchema — accepts real output', () => {
  it('accepts a valid payload', () => {
    expect(AccuracyPayloadSchema.safeParse(payload()).success).toBe(true);
  });

  it('accepts the empty record', () => {
    const result = AccuracyPayloadSchema.safeParse(
      payload({
        series: [],
        hitRate: { hits: 0, trials: 0, rate: 0.5, rawRate: null, prior: { hits: 2, trials: 4 } },
        empty: true,
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('AccuracyPayloadSchema — rejects dishonest output', () => {
  it('rejects a truncated series — the §14 cherry-pick guard', () => {
    // 5 scored trials but only 1 point published means the record was cut.
    const result = AccuracyPayloadSchema.safeParse(
      payload({
        hitRate: { hits: 3, trials: 5, rate: 0.55, rawRate: 0.6, prior: { hits: 2, trials: 4 } },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('every scored trial');
  });

  it('rejects a user identifier smuggled onto a point', () => {
    const result = AccuracyPayloadSchema.safeParse(payload({ series: [point({ userId: 'u1' })] }));
    expect(result.success).toBe(false);
  });

  it('rejects a prediction id on a point', () => {
    expect(
      AccuracyPayloadSchema.safeParse(payload({ series: [point({ id: 'p1' })] })).success,
    ).toBe(false);
  });

  it('rejects more hits than trials', () => {
    const result = AccuracyPayloadSchema.safeParse(
      payload({
        hitRate: { hits: 9, trials: 1, rate: 0.9, rawRate: 1, prior: { hits: 2, trials: 4 } },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('hits cannot exceed trials');
  });

  it('rejects a series that is not chronological', () => {
    const result = AccuracyPayloadSchema.safeParse(
      payload({
        series: [
          point({ targetTime: '2026-06-05T00:00:00.000Z' }),
          point({ targetTime: '2026-06-01T00:00:00.000Z' }),
        ],
        hitRate: { hits: 2, trials: 2, rate: 0.66, rawRate: 1, prior: { hits: 2, trials: 4 } },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('oldest first');
  });

  it('rejects empty:true alongside a populated series', () => {
    const result = AccuracyPayloadSchema.safeParse(payload({ empty: true }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('empty cannot be true');
  });

  it('rejects a Kp outside the 0-9 index', () => {
    expect(
      AccuracyPayloadSchema.safeParse(payload({ series: [point({ actualKp: 12 })] })).success,
    ).toBe(false);
  });

  it('rejects a NaN Kp', () => {
    expect(
      AccuracyPayloadSchema.safeParse(payload({ series: [point({ predictedKp: NaN })] })).success,
    ).toBe(false);
  });

  it('rejects a rate outside [0,1]', () => {
    const result = AccuracyPayloadSchema.safeParse(
      payload({
        hitRate: { hits: 1, trials: 1, rate: 1.4, rawRate: 1, prior: { hits: 2, trials: 4 } },
      }),
    );
    expect(result.success).toBe(false);
  });
});
