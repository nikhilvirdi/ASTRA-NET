import { describe, expect, it } from 'vitest';
import { generateStepPlotPaths } from './phase10-helpers';
import type { AccuracyPointData } from './api';

describe('Phase 10 Helpers', () => {
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
