import { describe, expect, it } from 'vitest';
import {
  calculateFactorTicks,
  formatCompassDistance,
  getBortleLuminanceColor,
  getDirectionsUrl,
} from '../../lib/best-spot-helpers';

describe('Best-Spot Helpers & Score Breakdown', () => {
  describe('calculateFactorTicks', () => {
    it('returns 0 filled and 8 unfilled for null factor', () => {
      expect(calculateFactorTicks(null)).toEqual({ filled: 0, unfilled: 8 });
    });

    it('converts factor 0.0 to 0 filled and 8 unfilled', () => {
      expect(calculateFactorTicks(0)).toEqual({ filled: 0, unfilled: 8 });
    });

    it('converts factor 0.5 to 4 filled and 4 unfilled', () => {
      expect(calculateFactorTicks(0.5)).toEqual({ filled: 4, unfilled: 4 });
    });

    it('converts factor 1.0 to 8 filled and 0 unfilled', () => {
      expect(calculateFactorTicks(1.0)).toEqual({ filled: 8, unfilled: 0 });
    });

    it('clamps factors below 0 or above 1', () => {
      expect(calculateFactorTicks(-0.5)).toEqual({ filled: 0, unfilled: 8 });
      expect(calculateFactorTicks(1.5)).toEqual({ filled: 8, unfilled: 0 });
    });
  });

  describe('formatCompassDistance', () => {
    it('formats compass direction and distance string correctly', () => {
      const mockSite = {
        travel: { compass: 'NE', distanceKm: 25.4 },
      };

      expect(formatCompassDistance(mockSite)).toBe('NE 25 km');
    });

    it('falls back gracefully when compass direction is null', () => {
      const mockSite = {
        travel: { compass: null, distanceKm: 42.1 },
      };

      expect(formatCompassDistance(mockSite)).toBe('42 km');
    });
  });

  describe('getDirectionsUrl', () => {
    it('constructs a Google Maps directions URL with raw lat/lon coordinates', () => {
      const mockSite = {
        latDeg: 32.73,
        lonDeg: 74.87,
      };

      expect(getDirectionsUrl(mockSite)).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=32.73,74.87',
      );
    });
  });

  describe('getBortleLuminanceColor', () => {
    it('returns deep night tone for Bortle 1 and luminous tone for Bortle 9', () => {
      expect(getBortleLuminanceColor(1)).toBe('#111818');
      expect(getBortleLuminanceColor(9)).toBe('#EEF1F1');
    });
  });
});
