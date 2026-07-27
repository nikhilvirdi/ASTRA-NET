import { describe, it, expect } from 'vitest';
import type { SkyLogEntry } from '@prisma/client';
import { buildLog, currentStreak, observingNight } from './build-log.js';

const NOW = new Date('2026-07-27T20:00:00.000Z');

function entry(over: Partial<SkyLogEntry> & { timestamp: Date }): SkyLogEntry {
  return {
    id: `e-${over.timestamp.toISOString()}`,
    userId: 'u1',
    eventType: 'other',
    source: 'manual',
    details: {},
    createdAt: over.timestamp,
    ...over,
  } as SkyLogEntry;
}

describe('observingNight', () => {
  it('keeps an evening and the small hours after it on the same night', () => {
    // 22:00 on the 27th and 02:00 on the 28th are one observing session.
    expect(observingNight(new Date('2026-07-27T22:00:00Z'))).toBe('2026-07-27');
    expect(observingNight(new Date('2026-07-28T02:00:00Z'))).toBe('2026-07-27');
  });

  it('rolls over at 12:00 UTC, matching the Julian Day convention', () => {
    expect(observingNight(new Date('2026-07-27T11:59:59Z'))).toBe('2026-07-26');
    expect(observingNight(new Date('2026-07-27T12:00:00Z'))).toBe('2026-07-27');
  });
});

describe('currentStreak', () => {
  const nights = (...days: string[]) => new Set(days);

  it('counts consecutive nights ending tonight', () => {
    expect(currentStreak(nights('2026-07-27', '2026-07-26', '2026-07-25'), NOW)).toBe(3);
  });

  it('still counts a run that ended last night — tonight is not over yet', () => {
    expect(currentStreak(nights('2026-07-26', '2026-07-25'), NOW)).toBe(2);
  });

  it('is zero when the most recent night is older than last night', () => {
    expect(currentStreak(nights('2026-07-24', '2026-07-23'), NOW)).toBe(0);
  });

  it('is zero with no nights at all', () => {
    expect(currentStreak(nights(), NOW)).toBe(0);
  });

  it('stops at the first gap rather than counting every night ever logged', () => {
    expect(currentStreak(nights('2026-07-27', '2026-07-26', '2026-07-24', '2026-07-23'), NOW)).toBe(
      2,
    );
  });

  it('counts a single night', () => {
    expect(currentStreak(nights('2026-07-27'), NOW)).toBe(1);
  });

  it('crosses a month boundary', () => {
    const now = new Date('2026-08-02T20:00:00.000Z');
    expect(currentStreak(nights('2026-08-02', '2026-08-01', '2026-07-31', '2026-07-30'), now)).toBe(
      4,
    );
  });
});

describe('buildLog', () => {
  it('reports an honest empty state rather than fabricating figures', () => {
    const payload = buildLog([], NOW);

    expect(payload.entries).toEqual([]);
    expect(payload.stats).toEqual({
      totalSightings: 0,
      nightsObserved: 0,
      issPassesCaught: 0,
      lastAuroraSighting: null,
      currentStreakNights: 0,
    });
    expect(payload.generatedAt).toBe(NOW.toISOString());
  });

  it('counts every headline stat from the real entries', () => {
    const payload = buildLog(
      [
        entry({ timestamp: new Date('2026-07-27T21:00:00Z'), eventType: 'iss_pass' }),
        entry({ timestamp: new Date('2026-07-27T22:30:00Z'), eventType: 'aurora' }),
        entry({ timestamp: new Date('2026-07-26T21:00:00Z'), eventType: 'iss_pass' }),
        entry({ timestamp: new Date('2026-07-20T21:00:00Z'), eventType: 'meteor_shower' }),
      ],
      NOW,
    );

    expect(payload.stats.totalSightings).toBe(4);
    expect(payload.stats.nightsObserved).toBe(3);
    expect(payload.stats.issPassesCaught).toBe(2);
    expect(payload.stats.lastAuroraSighting).toBe('2026-07-27T22:30:00.000Z');
    expect(payload.stats.currentStreakNights).toBe(2);
  });

  it('counts two entries on one night as a single night observed', () => {
    const payload = buildLog(
      [
        entry({ timestamp: new Date('2026-07-27T22:00:00Z') }),
        entry({ timestamp: new Date('2026-07-28T01:00:00Z') }),
      ],
      NOW,
    );

    expect(payload.stats.totalSightings).toBe(2);
    expect(payload.stats.nightsObserved).toBe(1);
  });

  it('returns the newest entry first regardless of input order', () => {
    const payload = buildLog(
      [
        entry({ id: 'old', timestamp: new Date('2026-07-01T21:00:00Z') }),
        entry({ id: 'new', timestamp: new Date('2026-07-27T21:00:00Z') }),
        entry({ id: 'mid', timestamp: new Date('2026-07-15T21:00:00Z') }),
      ],
      NOW,
    );

    expect(payload.entries.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('picks the latest aurora, not the first one it encounters', () => {
    const payload = buildLog(
      [
        entry({ timestamp: new Date('2026-07-01T21:00:00Z'), eventType: 'aurora' }),
        entry({ timestamp: new Date('2026-07-19T21:00:00Z'), eventType: 'aurora' }),
        entry({ timestamp: new Date('2026-07-10T21:00:00Z'), eventType: 'aurora' }),
      ],
      NOW,
    );

    expect(payload.stats.lastAuroraSighting).toBe('2026-07-19T21:00:00.000Z');
  });

  it('carries the source flag through for §13s filled-versus-hollow marker', () => {
    const payload = buildLog(
      [
        entry({ id: 'a', timestamp: new Date('2026-07-27T21:00:00Z'), source: 'auto' }),
        entry({ id: 'm', timestamp: new Date('2026-07-27T20:00:00Z'), source: 'manual' }),
      ],
      NOW,
    );

    expect(payload.entries.map((e) => e.source)).toEqual(['auto', 'manual']);
  });

  it('tags each entry with its observing night', () => {
    const payload = buildLog([entry({ timestamp: new Date('2026-07-28T02:00:00Z') })], NOW);
    expect(payload.entries[0]!.night).toBe('2026-07-27');
  });

  it('does not mutate the caller array', () => {
    const input = [
      entry({ id: 'old', timestamp: new Date('2026-07-01T21:00:00Z') }),
      entry({ id: 'new', timestamp: new Date('2026-07-27T21:00:00Z') }),
    ];
    buildLog(input, NOW);
    expect(input.map((e) => e.id)).toEqual(['old', 'new']);
  });
});
