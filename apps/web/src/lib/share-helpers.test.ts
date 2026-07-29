import { describe, expect, it } from 'vitest';
import {
  formatCapturedDate,
  getOgImageMetaUrl,
  getShareMarkerColorClass,
  buildShareMetaHead,
} from './share-helpers';
import type { ShareSnapshotData } from './api';

describe('formatCapturedDate', () => {
  it('formats ISO timestamps in UTC upper-case format', () => {
    const formatted = formatCapturedDate('2026-07-29T21:40:00.000Z');
    expect(formatted).toContain('JUL 29');
    expect(formatted).toContain('21:40 UTC');
  });

  it('handles invalid dates gracefully', () => {
    expect(formatCapturedDate('invalid')).toBe('UNKNOWN DATE');
  });
});

describe('getOgImageMetaUrl', () => {
  it('constructs absolute or relative OG image endpoint URL', () => {
    expect(getOgImageMetaUrl('abc123xyz789', 'https://astranet.app')).toBe(
      'https://astranet.app/api/share/abc123xyz789/og.png',
    );
    expect(getOgImageMetaUrl('abc123xyz789')).toBe('/api/share/abc123xyz789/og.png');
  });
});

describe('getShareMarkerColorClass', () => {
  it('returns distinct color tokens per marker type', () => {
    expect(getShareMarkerColorClass('sun')).toBe('bg-solar');
    expect(getShareMarkerColorClass('iss')).toBe('bg-orbital');
    expect(getShareMarkerColorClass('moon')).toBe('bg-sky-100');
    expect(getShareMarkerColorClass('planet')).toBe('bg-brass-300');
  });
});

describe('buildShareMetaHead', () => {
  it('builds head metadata properties from snapshot payload', () => {
    const mockSnapshot: ShareSnapshotData = {
      schemaVersion: 1,
      id: 'testcard1234',
      createdAt: '2026-07-29T20:00:00.000Z',
      capturedAt: '2026-07-29T20:00:00.000Z',
      observer: {
        latDeg: 32.73,
        lonDeg: 74.87,
        label: '32.73°N 74.87°E',
      },
      sky: {
        sunAltitudeDeg: -14.2,
        sunAzimuthDeg: 280.5,
        twilightPhase: 'night',
        twilightBand: 'nautical',
        twilightValue: 2.1,
        surfaceHex: '#111818',
      },
      headline: 'The ISS passes high at 21:42',
      facts: [
        { label: 'ISS TRANSIT', value: '21:42' },
        { label: 'AURORA CHANCE', value: '1 IN 3' },
        { label: 'BORTLE SCALE', value: 'CLASS 3' },
      ],
      horizon: {
        markers: [
          {
            id: 'iss',
            label: 'ISS',
            sublabel: 'Pass 21:42',
            type: 'iss',
            azimuthDeg: 145,
            altitudeDeg: 62,
          },
        ],
      },
      availability: {
        brief: 'ok',
        skyAnchor: 'ok',
        iss: 'ok',
        spaceWeather: 'ok',
        neoImagery: 'ok',
      },
    };

    const meta = buildShareMetaHead(mockSnapshot, 'http://localhost:5173');
    expect(meta.title).toBe('The ISS passes high at 21:42 — ASTRANET Sky Card');
    expect(meta.description).toContain('32.73°N 74.87°E');
    expect(meta.ogImageUrl).toBe('http://localhost:5173/api/share/testcard1234/og.png');
    expect(meta.ogUrl).toBe('http://localhost:5173/share/testcard1234');
  });
});
