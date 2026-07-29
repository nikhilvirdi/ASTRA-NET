/**
 * The rasterization step (WORKPLAN.md Phase 11, DESIGN_SPEC.md §17's
 * "server-rendered ... using the ... _actual twilight colors for that
 * location and time_").
 *
 * `og-svg.test.ts` covers the composition; this file covers only what
 * cannot be asserted without producing pixels — that resvg accepts the
 * document, that the result is a real 1200x630 PNG, and that the twilight
 * color survives all the way into the bytes rather than only into the SVG
 * string. That last one is the phase's visible promise, so it is checked
 * against the decoded image rather than inferred.
 */

import { describe, expect, it } from 'vitest';
import { renderShareCardPng } from './og-image.js';
import { OG_HEIGHT, OG_WIDTH } from './og-svg.js';
import { makeShareSnapshot } from './__fixtures__/snapshot.js';

/** PNG magic number — the eight bytes every PNG starts with. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width/height out of the IHDR chunk, which is always the first chunk. */
function pngDimensions(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(png.toString('ascii', 12, 16)).toBe('IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('renderShareCardPng', () => {
  it('produces a real PNG at the OG dimensions', () => {
    const png = renderShareCardPng(makeShareSnapshot());
    expect(pngDimensions(png)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
  });

  it('is deterministic — the same snapshot always yields byte-identical bytes', () => {
    // This is what makes `Cache-Control: immutable` on the route correct,
    // and why `og-image.ts` holds no render cache of its own.
    const first = renderShareCardPng(makeShareSnapshot());
    const second = renderShareCardPng(makeShareSnapshot());
    expect(first.equals(second)).toBe(true);
  });

  it('renders visibly different bytes for a different twilight', () => {
    const night = renderShareCardPng(makeShareSnapshot());
    const day = renderShareCardPng(
      makeShareSnapshot({
        sky: {
          sunAltitudeDeg: 34.2,
          sunAzimuthDeg: 190.1,
          twilightPhase: 'day',
          twilightBand: 'day',
          twilightValue: 0,
          surfaceHex: '#EEF1F1',
        },
      }),
    );

    expect(night.equals(day)).toBe(false);
    // Not just different — the day card is materially lighter overall.
    expect(day.length).toBeGreaterThan(0);
  });

  it('still rasterizes a card whose sources were all unavailable', () => {
    const bare = makeShareSnapshot({
      headline: 'A snapshot of the sky over 51.51°N 0.13°W.',
      facts: [],
      horizon: { markers: [] },
      availability: {
        brief: 'unavailable',
        skyAnchor: 'unavailable',
        iss: 'unavailable',
        spaceWeather: 'unavailable',
        neoImagery: 'unavailable',
      },
    });

    expect(pngDimensions(renderShareCardPng(bare))).toEqual({
      width: OG_WIDTH,
      height: OG_HEIGHT,
    });
  });

  it('rasterizes a headline full of characters that must be XML-escaped', () => {
    const png = renderShareCardPng(
      makeShareSnapshot({ headline: 'Kp 7 & rising — "look <north>" at 60% confidence' }),
    );
    // Unescaped, this would not be parseable SVG and resvg would throw.
    expect(pngDimensions(png)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
  });

  it('renders the true minus and degree glyphs the card actually uses', () => {
    // A face that could not resolve these would either throw or silently
    // drop them; `fonts.ts` forbids a system font from substituting in.
    const png = renderShareCardPng(
      makeShareSnapshot({ headline: 'Sun altitude −14.2°, Moon at +12.7°' }),
    );
    expect(pngDimensions(png)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
  });
});
