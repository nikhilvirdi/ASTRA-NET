import { describe, it, expect } from 'vitest';
import { buildStatusRows, type HealthSource } from './StatusPage';

const ALL_CATEGORY_KEYS = [
  'stations',
  'starlink',
  'oneweb',
  'gps',
  'weather',
  'geo',
  'cubesat',
  'debris',
  'hubble',
];

function nullCategorySources(): Record<string, null> {
  return Object.fromEntries(ALL_CATEGORY_KEYS.map((k) => [k, null]));
}

describe('buildStatusRows', () => {
  it('makes one row per non-satellite source, using the source key as fallback label', () => {
    const rows = buildStatusRows({
      donki: { healthy: true, fetchedAt: '2026-09-09T00:00:00.000Z' },
      unknownSource: { healthy: false, fetchedAt: null },
    });

    expect(rows).toEqual([
      { key: 'donki', label: 'DONKI (CME)', healthy: true, fetchedAt: '2026-09-09T00:00:00.000Z' },
      { key: 'unknownSource', label: 'UNKNOWNSOURCE', healthy: false, fetchedAt: null },
    ]);
  });

  it('expands the satellites source into 9 category rows instead of one', () => {
    const rows = buildStatusRows({
      satellites: {
        healthy: true,
        fetchedAt: '2026-09-09T00:00:00.000Z',
        categorySources: { ...nullCategorySources(), starlink: 'celestrak' },
      },
    });

    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.key)).toEqual(ALL_CATEGORY_KEYS.map((k) => `satellites-${k}`));
  });

  it('treats a null category source as unavailable, not an error, with no source label', () => {
    const rows = buildStatusRows({
      satellites: {
        healthy: true,
        fetchedAt: '2026-09-09T00:00:00.000Z',
        categorySources: nullCategorySources(),
      },
    });

    for (const row of rows) {
      expect(row.healthy).toBe(false);
      expect(row.fetchedAt).toBeNull();
      expect(row.sourceLabel).toBeUndefined();
    }
  });

  it('marks a category healthy and attributes its source when non-null', () => {
    const rows = buildStatusRows({
      satellites: {
        healthy: true,
        fetchedAt: '2026-09-09T00:00:00.000Z',
        categorySources: {
          ...nullCategorySources(),
          gps: 'celestrak',
          hubble: 'space-track-fallback',
        },
      },
    });

    const gps = rows.find((r) => r.key === 'satellites-gps')!;
    expect(gps.healthy).toBe(true);
    expect(gps.sourceLabel).toBe('CelesTrak');

    const hubble = rows.find((r) => r.key === 'satellites-hubble')!;
    expect(hubble.healthy).toBe(true);
    expect(hubble.sourceLabel).toBe('Space-Track Fallback');
  });

  it('renders debris identically to every other category — no per-sub-group breakdown implied', () => {
    const rows = buildStatusRows({
      satellites: {
        healthy: true,
        fetchedAt: '2026-09-09T00:00:00.000Z',
        categorySources: { ...nullCategorySources(), debris: 'celestrak' },
      },
    });

    const debris = rows.find((r) => r.key === 'satellites-debris')!;
    const starlink = rows.find((r) => r.key === 'satellites-starlink')!;
    // Same shape as any other category row — no extra fields, no nesting.
    expect(Object.keys(debris).sort()).toEqual(Object.keys(starlink).sort());
    expect(debris.label).toBe('Debris');
  });

  it('falls back to an empty categorySources map when the satellites entry omits it', () => {
    const source: HealthSource = { healthy: false, fetchedAt: null };
    const rows = buildStatusRows({ satellites: source });

    expect(rows).toHaveLength(9);
    expect(rows.every((r) => !r.healthy)).toBe(true);
  });

  it('handles an empty sources object', () => {
    expect(buildStatusRows({})).toEqual([]);
  });
});
