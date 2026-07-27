import { describe, it, expect } from 'vitest';
import { historyFactor } from '@astranet/shared';
import { buildAccuracy, BETA_PRIOR, type ScoredPredictionRow } from './build-accuracy.js';

const NOW = new Date('2026-07-27T20:00:00.000Z');

function row(over: Partial<ScoredPredictionRow> = {}): ScoredPredictionRow {
  return {
    targetTime: new Date('2026-07-20T00:00:00Z'),
    predictedKp: 5,
    actualKp: 5,
    hit: true,
    ...over,
  };
}

describe('buildAccuracy — the real record', () => {
  it('publishes every scored prediction as a point', () => {
    const payload = buildAccuracy(
      [
        row({ targetTime: new Date('2026-07-20T00:00:00Z') }),
        row({ targetTime: new Date('2026-07-21T00:00:00Z') }),
      ],
      { hits: 2, trials: 2 },
      NOW,
    );

    expect(payload.series).toHaveLength(2);
    expect(payload.series[0]!.targetTime).toBe('2026-07-20T00:00:00.000Z');
  });

  it('orders the series oldest-first for a left-to-right step plot', () => {
    const payload = buildAccuracy(
      [
        row({ targetTime: new Date('2026-07-25T00:00:00Z') }),
        row({ targetTime: new Date('2026-07-10T00:00:00Z') }),
        row({ targetTime: new Date('2026-07-18T00:00:00Z') }),
      ],
      { hits: 3, trials: 3 },
      NOW,
    );

    expect(payload.series.map((p) => p.targetTime)).toEqual([
      '2026-07-10T00:00:00.000Z',
      '2026-07-18T00:00:00.000Z',
      '2026-07-25T00:00:00.000Z',
    ]);
  });

  it('exposes no identifier that could tie a point to a user', () => {
    const payload = buildAccuracy([row()], { hits: 1, trials: 1 }, NOW);
    expect(Object.keys(payload.series[0]!).sort()).toEqual([
      'actualKp',
      'hit',
      'predictedKp',
      'targetTime',
    ]);
  });

  it('reports the stored hit flag rather than recomputing it', () => {
    // A row whose stored `hit` disagrees with the raw values must still be
    // reported as stored — the accuracy loop is the authority on scoring.
    const payload = buildAccuracy(
      [row({ predictedKp: 5, actualKp: 5, hit: false })],
      { hits: 0, trials: 1 },
      NOW,
    );
    expect(payload.series[0]!.hit).toBe(false);
  });

  it('drops a row with a null observation rather than plotting a fabricated zero', () => {
    const payload = buildAccuracy(
      [row(), row({ targetTime: new Date('2026-07-22T00:00:00Z'), actualKp: null, hit: null })],
      { hits: 1, trials: 1 },
      NOW,
    );
    expect(payload.series).toHaveLength(1);
  });
});

describe('buildAccuracy — Beta-prior hit rate', () => {
  it('uses the shared §8/§9 historyFactor, not a local formula', () => {
    const payload = buildAccuracy([row()], { hits: 7, trials: 10 }, NOW);
    expect(payload.hitRate.rate).toBeCloseTo(historyFactor(7, 10), 12);
    expect(payload.hitRate.rate).toBeCloseTo((7 + 2) / (10 + 4), 12);
  });

  it('reports a neutral rate, not a perfect one, with zero trials', () => {
    const payload = buildAccuracy([], { hits: 0, trials: 0 }, NOW);
    // DESIGN_SPEC §14: "honest from day one" — 0.5, never 1.0 or NaN.
    expect(payload.hitRate.rate).toBeCloseTo(0.5, 12);
    expect(payload.hitRate.rawRate).toBeNull();
    expect(payload.empty).toBe(true);
  });

  it('exposes the raw rate alongside the prior-adjusted one', () => {
    const payload = buildAccuracy([row()], { hits: 3, trials: 4 }, NOW);
    expect(payload.hitRate.rawRate).toBeCloseTo(0.75, 12);
    expect(payload.hitRate.rate).toBeCloseTo(5 / 8, 12);
  });

  it('states the prior terms so §14 can explain them on screen', () => {
    const payload = buildAccuracy([], { hits: 0, trials: 0 }, NOW);
    expect(payload.hitRate.prior).toEqual({ hits: BETA_PRIOR.hits, trials: BETA_PRIOR.trials });
  });

  it('passes the raw counts through unpadded', () => {
    const payload = buildAccuracy([row()], { hits: 1, trials: 1 }, NOW);
    expect(payload.hitRate.hits).toBe(1);
    expect(payload.hitRate.trials).toBe(1);
  });

  it('is not empty once anything has been scored', () => {
    expect(buildAccuracy([row()], { hits: 1, trials: 1 }, NOW).empty).toBe(false);
  });
});
