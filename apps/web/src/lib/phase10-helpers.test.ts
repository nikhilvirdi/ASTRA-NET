import { describe, expect, it } from 'vitest';
import {
  calculateLogStats,
  formatEventTypeLabel,
  generateStepPlotPaths,
  groupEntriesByMonth,
} from './phase10-helpers';
import type { AccuracyPointData } from './api';
import type { SkyLogEntryData } from '@/store';

describe('Phase 10 Helpers', () => {
  describe('calculateLogStats', () => {
    it('returns zeroes for empty entries array', () => {
      const stats = calculateLogStats([]);
      expect(stats).toEqual({ totalSightings: 0, streakDays: 0, lastAurora: null });
    });

    it('calculates total sightings and identifies last aurora timestamp', () => {
      const entries: SkyLogEntryData[] = [
        {
          id: '1',
          eventType: 'aurora',
          timestamp: '2026-07-27T21:00:00.000Z',
          notes: 'Bright green pillars',
          source: 'manual',
          details: { kp: 6 },
          createdAt: '2026-07-27T21:00:00.000Z',
        },
        {
          id: '2',
          eventType: 'iss_pass',
          timestamp: '2026-07-20T19:00:00.000Z',
          notes: 'Clear pass overhead',
          source: 'manual',
          details: null,
          createdAt: '2026-07-20T19:00:00.000Z',
        },
      ];

      const stats = calculateLogStats(entries);
      expect(stats.totalSightings).toBe(2);
      expect(stats.lastAurora).toBe('2026-07-27T21:00:00.000Z');
    });
  });

  describe('groupEntriesByMonth', () => {
    it('groups entries into Map keyed by uppercase month and year', () => {
      const entries: SkyLogEntryData[] = [
        {
          id: '1',
          eventType: 'iss_pass',
          timestamp: '2026-07-27T21:00:00.000Z',
          notes: null,
          source: 'manual',
          details: null,
          createdAt: '2026-07-27T21:00:00.000Z',
        },
        {
          id: '2',
          eventType: 'stargazing',
          timestamp: '2026-06-15T22:00:00.000Z',
          notes: null,
          source: 'manual',
          details: null,
          createdAt: '2026-06-15T22:00:00.000Z',
        },
      ];

      const grouped = groupEntriesByMonth(entries);
      expect(grouped.has('JULY 2026')).toBe(true);
      expect(grouped.has('JUNE 2026')).toBe(true);
      expect(grouped.get('JULY 2026')?.length).toBe(1);
    });
  });

  describe('formatEventTypeLabel', () => {
    it('formats raw event types into uppercase display labels', () => {
      expect(formatEventTypeLabel('iss_pass')).toBe('ISS VISIBLE PASS');
      expect(formatEventTypeLabel('aurora')).toBe('AURORA BOREALIS');
      expect(formatEventTypeLabel('meteor_shower')).toBe('METEOR SHOWER');
      expect(formatEventTypeLabel('neo_approach')).toBe('NEAR-EARTH OBJECT');
    });
  });

  describe('generateStepPlotPaths', () => {
    it('handles empty series gracefully', () => {
      const res = generateStepPlotPaths([]);
      expect(res.predictedPath).toBe('');
      expect(res.actualPath).toBe('');
      expect(res.points).toEqual([]);
    });

    it('generates valid stepAfter SVG paths for predicted and actual Kp series', () => {
      const series: AccuracyPointData[] = [
        { targetTime: '2026-07-27T00:00:00.000Z', predictedKp: 3, actualKp: 3, hit: true },
        { targetTime: '2026-07-27T03:00:00.000Z', predictedKp: 5, actualKp: 4, hit: false },
        { targetTime: '2026-07-27T06:00:00.000Z', predictedKp: 6, actualKp: 6, hit: true },
      ];

      const res = generateStepPlotPaths(series, 600, 300, 40);
      expect(res.points.length).toBe(3);
      expect(res.predictedPath).toContain('M');
      expect(res.predictedPath).toContain('H');
      expect(res.predictedPath).toContain('V');
      expect(res.actualPath).toContain('M');
      expect(res.divergencePath).toContain('Z');
    });
  });
});
