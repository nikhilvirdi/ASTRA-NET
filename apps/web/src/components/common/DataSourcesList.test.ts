import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataSourcesList, DATA_SOURCES } from './DataSourcesList';

describe('DATA_SOURCES', () => {
  it('contains all 10 verified data sources', () => {
    const ids = DATA_SOURCES.map((s) => s.id);
    expect(ids).toEqual([
      'iss',
      'solar-wind',
      'donki',
      'neows',
      'gibs',
      'horizons',
      'satellites',
      'cloud-cover',
      'sky-quality',
      'celestial-math',
    ]);
  });

  it('adheres to content constraints (no forbidden feature references)', () => {
    const forbidden = [
      'apparent-size',
      'apparent size',
      'orbit trail',
      'orbit-trail',
      'reentry tracker',
      're-entry tracker',
      'real-time meteor',
      'since-last-visit',
      'since last visit',
    ];

    for (const source of DATA_SOURCES) {
      const text =
        `${source.category} ${source.source} ${source.summary} ${source.details}`.toLowerCase();
      for (const phrase of forbidden) {
        expect(text).not.toContain(phrase);
      }
    }
  });
});

describe('DataSourcesList', () => {
  it('renders all categories, sources, and summaries in static markup', () => {
    const html = renderToStaticMarkup(React.createElement(DataSourcesList));

    for (const source of DATA_SOURCES) {
      expect(html).toContain(source.category.replace(/&/g, '&amp;'));
      expect(html).toContain(source.source.replace(/&/g, '&amp;'));
    }
  });
});
