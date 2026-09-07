import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BORTLE_DESCRIPTIONS, formatBortleScale } from './sky-quality';
import { SkyQualityStatus } from '../components/brief/SkyQualityStatus';

describe('formatBortleScale', () => {
  it('returns null when bortle is null, undefined, or NaN', () => {
    expect(formatBortleScale(null)).toBeNull();
    expect(formatBortleScale(undefined)).toBeNull();
    expect(formatBortleScale(Number.NaN)).toBeNull();
  });

  it('returns null for out-of-range ratings (< 1 or > 9)', () => {
    expect(formatBortleScale(0)).toBeNull();
    expect(formatBortleScale(-2)).toBeNull();
    expect(formatBortleScale(10)).toBeNull();
  });

  it('formats Bortle 1 as pristine dark sky', () => {
    expect(formatBortleScale(1)).toBe('Bortle 1 — pristine dark sky');
  });

  it('formats Bortle 3 as rural sky', () => {
    expect(formatBortleScale(3)).toBe('Bortle 3 — rural sky');
  });

  it('formats Bortle 9 as inner-city sky', () => {
    expect(formatBortleScale(9)).toBe('Bortle 9 — inner-city sky');
  });

  it('has valid standard descriptions for all classes 1 through 9', () => {
    for (let i = 1; i <= 9; i++) {
      const desc = BORTLE_DESCRIPTIONS[i];
      expect(desc).toBeDefined();
      expect(formatBortleScale(i)).toBe(`Bortle ${i} — ${desc}`);
    }
  });
});

describe('SkyQualityStatus component', () => {
  it('renders nothing when bortle is null or unavailable', () => {
    const html = renderToStaticMarkup(
      React.createElement(SkyQualityStatus, {
        bortle: null,
      }),
    );
    expect(html).toBe('');
    expect(html).not.toContain('sky-quality-status');
  });

  it('renders nothing when bortle is undefined', () => {
    const html = renderToStaticMarkup(
      React.createElement(SkyQualityStatus, {
        bortle: undefined,
      }),
    );
    expect(html).toBe('');
  });

  it('renders Bortle 3 with exact styling and descriptive status phrase', () => {
    const html = renderToStaticMarkup(
      React.createElement(SkyQualityStatus, {
        bortle: 3,
      }),
    );
    expect(html).toContain('data-testid="sky-quality-status"');
    expect(html).toContain('type-body text-sky-200 text-sm mt-1');
    expect(html).toContain('Bortle 3 — rural sky');
  });

  it('renders Bortle 9 with inner-city sky text', () => {
    const html = renderToStaticMarkup(
      React.createElement(SkyQualityStatus, {
        bortle: 9,
      }),
    );
    expect(html).toContain('data-testid="sky-quality-status"');
    expect(html).toContain('Bortle 9 — inner-city sky');
  });
});
