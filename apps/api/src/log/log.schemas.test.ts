import { describe, it, expect } from 'vitest';
import { LogPayloadSchema } from './log.schemas.js';

function entry(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    eventType: 'aurora',
    timestamp: '2026-07-27T21:00:00.000Z',
    source: 'manual',
    details: {},
    night: '2026-07-27',
    ...over,
  };
}

function payload(over: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-07-27T22:00:00.000Z',
    stats: {
      totalSightings: 1,
      nightsObserved: 1,
      issPassesCaught: 0,
      lastAuroraSighting: '2026-07-27T21:00:00.000Z',
      currentStreakNights: 1,
    },
    entries: [entry()],
    ...over,
  };
}

describe('LogPayloadSchema — accepts real output', () => {
  it('accepts a valid payload', () => {
    expect(LogPayloadSchema.safeParse(payload()).success).toBe(true);
  });

  it('accepts the empty log', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: 0,
          nightsObserved: 0,
          issPassesCaught: 0,
          lastAuroraSighting: null,
          currentStreakNights: 0,
        },
        entries: [],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('LogPayloadSchema — rejects inconsistent stats', () => {
  it('rejects a total that disagrees with the entries returned', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: 99,
          nightsObserved: 1,
          issPassesCaught: 0,
          lastAuroraSighting: null,
          currentStreakNights: 1,
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('totalSightings must equal');
  });

  it('rejects more nights than entries', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: 1,
          nightsObserved: 5,
          issPassesCaught: 0,
          lastAuroraSighting: null,
          currentStreakNights: 1,
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('nightsObserved cannot exceed');
  });

  it('rejects a streak longer than the nights observed', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: 1,
          nightsObserved: 1,
          issPassesCaught: 0,
          lastAuroraSighting: null,
          currentStreakNights: 4,
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('currentStreakNights cannot exceed');
  });

  it('rejects more ISS passes than entries', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: 1,
          nightsObserved: 1,
          issPassesCaught: 7,
          lastAuroraSighting: null,
          currentStreakNights: 1,
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('issPassesCaught cannot exceed');
  });

  it('rejects entries that are not newest-first', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: 2,
          nightsObserved: 2,
          issPassesCaught: 0,
          lastAuroraSighting: null,
          currentStreakNights: 1,
        },
        entries: [
          entry({ id: 'a', timestamp: '2026-07-20T21:00:00.000Z' }),
          entry({ id: 'b', timestamp: '2026-07-27T21:00:00.000Z' }),
        ],
      }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('newest first');
  });

  it('rejects a negative count', () => {
    const result = LogPayloadSchema.safeParse(
      payload({
        stats: {
          totalSightings: -1,
          nightsObserved: 0,
          issPassesCaught: 0,
          lastAuroraSighting: null,
          currentStreakNights: 0,
        },
        entries: [],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unknown event type', () => {
    expect(
      LogPayloadSchema.safeParse(payload({ entries: [entry({ eventType: 'ufo' })] })).success,
    ).toBe(false);
  });

  it('rejects an unknown source flag', () => {
    expect(
      LogPayloadSchema.safeParse(payload({ entries: [entry({ source: 'imported' })] })).success,
    ).toBe(false);
  });

  it('rejects a malformed night key', () => {
    expect(
      LogPayloadSchema.safeParse(payload({ entries: [entry({ night: '27/07/2026' })] })).success,
    ).toBe(false);
  });
});
