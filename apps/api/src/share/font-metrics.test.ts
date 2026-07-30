/**
 * The TrueType advance-width reader behind the OG card's layout
 * (WORKPLAN.md Phase 11).
 *
 * `font-metrics.ts` claims to be "verified against `@resvg/resvg-js`'s own
 * layout ... rather than only against itself", so that is what the first
 * block here actually does, using the renderer that ships the pixels.
 *
 * Measuring text against a rasterizer needs care: a glyph's *ink* extent is
 * not its *advance* width — side bearings sit outside the ink on both
 * sides, so comparing `measureTextWidth('A')` to the bounding box of a
 * rendered "A" would fail by design. The trick used below removes them:
 * for a doubled glyph, the ink bounding box grows by exactly one advance
 * width, because the left edge is unmoved and the right edge shifts by the
 * advance. So `bbox('XX') - bbox('X')` *is* resvg's advance for X, exactly,
 * and can be compared to this module's number directly.
 */

import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { measureTextWidth, parseFontMetrics, wrapText } from './font-metrics.js';
import {
  ARCHIVO_REGULAR_PATH,
  ARCHIVO_SEMIBOLD_PATH,
  MARTIAN_MONO_PATH,
  loadShareCardFonts,
  MONO_FAMILY,
  PROPORTIONAL_FAMILY,
} from './fonts.js';

const FONT_SIZE = 40;

/**
 * resvg returns f32 bounding boxes, so its numbers and this module's f64
 * arithmetic cannot be bit-identical even when the underlying advance is
 * the same integer count of font units. The comparisons below use
 * `toBeCloseTo`'s 2-decimal precision — a hundredth of a pixel, far below
 * the half-pixel that could ever change a wrap decision.
 */
const fonts = loadShareCardFonts();

/** Ink bounding-box width of `text` as resvg itself lays it out. */
function resvgInkWidth(text: string, family: string, fontFiles: string[], weight = 400): number {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200">',
    `<text x="20" y="120" font-family="${family}" font-weight="${weight}" font-size="${FONT_SIZE}">${text}</text>`,
    '</svg>',
  ].join('');
  const bbox = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: family },
  }).getBBox();
  if (bbox === undefined) throw new Error(`resvg produced no bounding box for ${text}`);
  return bbox.width;
}

/** resvg's own advance width for one glyph, with side bearings cancelled out. */
function resvgAdvance(glyph: string, family: string, fontFiles: string[], weight = 400): number {
  return (
    resvgInkWidth(`${glyph}${glyph}`, family, fontFiles, weight) -
    resvgInkWidth(glyph, family, fontFiles, weight)
  );
}

describe('measureTextWidth agrees with resvg', () => {
  const proportional = [ARCHIVO_REGULAR_PATH, ARCHIVO_SEMIBOLD_PATH];
  const mono = [MARTIAN_MONO_PATH];

  // Every class of character the card can actually render: letters, digits,
  // and the three non-ASCII glyphs `build-snapshot.ts` emits.
  it.each(['A', 'i', 'W', 'm', '0', '8', '°', '−', '·'])(
    'matches resvg for %s in the proportional face',
    (glyph) => {
      expect(measureTextWidth(glyph, fonts.proportionalRegular, FONT_SIZE)).toBeCloseTo(
        resvgAdvance(glyph, PROPORTIONAL_FAMILY, proportional),
        2,
      );
    },
  );

  it.each(['A', '0', '8', '°', '−', '·'])('matches resvg for %s in the mono face', (glyph) => {
    expect(measureTextWidth(glyph, fonts.mono, FONT_SIZE)).toBeCloseTo(
      resvgAdvance(glyph, MONO_FAMILY, mono),
      2,
    );
  });

  it('over-measures a real headline by no more than kerning explains', () => {
    // Doubling the whole string cancels its side bearings the same way a
    // doubled glyph does, so this compares the summed advances end to end.
    //
    // These do NOT agree exactly, and must not be asserted as though they
    // did: resvg applies the face's GPOS kern pairs and this module does
    // not (see `font-metrics.ts`'s documented limitation). Kerning is
    // effectively always negative — "To" pulls in by 3.2px at this size —
    // so the parser's number is reliably the *wider* of the two. That is
    // the safe direction and the property worth pinning: a wrap computed
    // from it breaks early rather than overflowing the card.
    const text = 'The ISS crosses your sky at 22:14 UTC';
    const resvgWidth =
      resvgInkWidth(`${text}${text}`, PROPORTIONAL_FAMILY, proportional) -
      resvgInkWidth(text, PROPORTIONAL_FAMILY, proportional);
    const measured = measureTextWidth(text, fonts.proportionalRegular, FONT_SIZE);

    expect(measured).toBeGreaterThanOrEqual(resvgWidth);
    // Within 1.5% — enough headroom for the kern pairs in ordinary English
    // at the card's vocabulary, tight enough to catch a real parser fault.
    expect(measured - resvgWidth).toBeLessThan(resvgWidth * 0.015);
  });

  it('agrees exactly on a string whose pairs the face does not kern', () => {
    // The unkerned case is where equality genuinely holds, so it is
    // asserted at full precision rather than within a tolerance.
    const text = 'oo AA oo';
    const resvgWidth =
      resvgInkWidth(`${text}${text}`, PROPORTIONAL_FAMILY, proportional) -
      resvgInkWidth(text, PROPORTIONAL_FAMILY, proportional);

    expect(measureTextWidth(text, fonts.proportionalRegular, FONT_SIZE)).toBeCloseTo(resvgWidth, 2);
  });

  it('reads the SemiBold face as genuinely wider than Regular', () => {
    // DESIGN_SPEC.md §5.3's display weight is 600. If the static instances
    // were mixed up, or a variable font flattened to its default, these two
    // would measure identically — which is the failure `fonts.ts` warns of.
    const text = 'Aurora may reach your sky tonight';
    expect(measureTextWidth(text, fonts.proportionalSemiBold, FONT_SIZE)).toBeGreaterThan(
      measureTextWidth(text, fonts.proportionalRegular, FONT_SIZE),
    );
  });

  it('measures the mono face as genuinely monospaced', () => {
    const widths = ['0', '1', 'W', 'i', '.'].map((glyph) =>
      measureTextWidth(glyph, fonts.mono, FONT_SIZE),
    );
    for (const width of widths) {
      expect(width).toBeCloseTo(widths[0]!, 5);
    }
  });
});

describe('measureTextWidth', () => {
  it('is zero for the empty string', () => {
    expect(measureTextWidth('', fonts.proportionalRegular, FONT_SIZE)).toBe(0);
  });

  it('scales linearly with font size', () => {
    const at20 = measureTextWidth('ASTRANET', fonts.proportionalRegular, 20);
    const at40 = measureTextWidth('ASTRANET', fonts.proportionalRegular, 40);
    expect(at40).toBeCloseTo(at20 * 2, 6);
  });

  it('applies letter-spacing between glyphs only, never after the last', () => {
    const plain = measureTextWidth('ABCD', fonts.proportionalRegular, FONT_SIZE);
    const tracked = measureTextWidth('ABCD', fonts.proportionalRegular, FONT_SIZE, 3);
    // Four glyphs, three gaps — the SVG `letter-spacing` rule the card's
    // negative display tracking depends on.
    expect(tracked - plain).toBeCloseTo(9, 6);
  });

  it('accepts negative tracking, as the display scale uses', () => {
    const plain = measureTextWidth('ABCD', fonts.proportionalRegular, FONT_SIZE);
    expect(measureTextWidth('ABCD', fonts.proportionalRegular, FONT_SIZE, -2)).toBeCloseTo(
      plain - 6,
      6,
    );
  });

  it('falls back to the space advance for an unmapped codepoint rather than zero', () => {
    // A glyph no vendored face carries. Measuring it as zero would
    // under-wrap and overflow the card, which is the documented reason for
    // the fallback.
    const width = measureTextWidth('\u{10FFFD}', fonts.proportionalRegular, FONT_SIZE);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeCloseTo(measureTextWidth(' ', fonts.proportionalRegular, FONT_SIZE), 6);
  });

  it('counts astral-plane characters as one glyph, not two code units', () => {
    const single = measureTextWidth('\u{1F680}', fonts.proportionalRegular, FONT_SIZE, 10);
    // One glyph means zero letter-spacing gaps; a UTF-16 miscount would add one.
    expect(single).toBeCloseTo(
      measureTextWidth('\u{1F680}', fonts.proportionalRegular, FONT_SIZE, 0),
      6,
    );
  });
});

describe('parseFontMetrics', () => {
  it('reads plausible metrics from every vendored face', () => {
    for (const path of [ARCHIVO_REGULAR_PATH, ARCHIVO_SEMIBOLD_PATH, MARTIAN_MONO_PATH]) {
      const metrics = parseFontMetrics(path);
      expect(metrics.unitsPerEm).toBeGreaterThan(0);
      expect(metrics.advanceWidths.length).toBeGreaterThan(0);
      // The card's character set is ASCII plus three BMP symbols.
      for (const codepoint of [0x20, 0x41, 0x30, 0xb0, 0x2212, 0xb7]) {
        expect(metrics.glyphIds.has(codepoint)).toBe(true);
      }
    }
  });

  it('throws on a file that is not a parseable sfnt', () => {
    // A broken build artifact, not a runtime condition to degrade around.
    expect(() => parseFontMetrics(new URL(import.meta.url).pathname)).toThrow();
  });

  /**
   * Real values read directly from each vendored font's own `OS/2` table
   * (`os2.offset + 88` for `sCapHeight`, `+ 70` for `sTypoDescender`),
   * confirmed independently with a standalone table-directory read before
   * this test was written, not derived from `parseFontMetrics` itself —
   * pinning these guards `og-svg.ts`'s Horizon Band collision fix (which
   * depends on Martian Mono's exact `capHeight`) against silently drifting
   * if the vendored file is ever swapped for a different build of the
   * same family.
   */
  it('reads the real OS/2 vertical metrics for each vendored face, not an estimate', () => {
    const mono = parseFontMetrics(MARTIAN_MONO_PATH);
    expect(mono.unitsPerEm).toBe(1000);
    expect(mono.capHeight).toBe(800);
    expect(mono.descender).toBe(200);

    for (const path of [ARCHIVO_REGULAR_PATH, ARCHIVO_SEMIBOLD_PATH]) {
      const archivo = parseFontMetrics(path);
      expect(archivo.unitsPerEm).toBe(1000);
      expect(archivo.capHeight).toBe(686);
      expect(archivo.descender).toBe(210);
    }
  });
});

describe('wrapText', () => {
  const metrics = fonts.proportionalSemiBold;

  it('returns no lines for empty or whitespace-only text', () => {
    expect(wrapText('', metrics, FONT_SIZE, 500, 3)).toEqual([]);
    expect(wrapText('   \n  ', metrics, FONT_SIZE, 500, 3)).toEqual([]);
  });

  it('keeps text that fits on one line', () => {
    expect(wrapText('Tonight', metrics, FONT_SIZE, 1000, 3)).toEqual(['Tonight']);
  });

  it('wraps greedily at word boundaries', () => {
    const lines = wrapText('one two three four five six', metrics, FONT_SIZE, 200, 5);
    expect(lines.length).toBeGreaterThan(1);
    // Nothing is broken mid-word, and no line exceeds the width.
    expect(lines.join(' ')).toBe('one two three four five six');
    for (const line of lines) {
      expect(measureTextWidth(line, metrics, FONT_SIZE)).toBeLessThanOrEqual(200);
    }
  });

  it('keeps a single over-long word whole rather than hyphenating it', () => {
    const lines = wrapText('Supercalifragilistic', metrics, FONT_SIZE, 50, 3);
    expect(lines).toEqual(['Supercalifragilistic']);
  });

  it('caps at maxLines and ellipsises with a true ellipsis character', () => {
    const lines = wrapText(
      'one two three four five six seven eight nine ten eleven twelve',
      metrics,
      FONT_SIZE,
      200,
      2,
    );
    expect(lines.length).toBe(2);
    expect(lines[1]).toMatch(/…$/);
    expect(lines[1]).not.toMatch(/\.\.\.$/);
  });

  it('shrinks the ellipsised line until it actually fits', () => {
    const maxWidth = 200;
    const lines = wrapText(
      'alpha bravo charlie delta echo foxtrot golf hotel india juliett',
      metrics,
      FONT_SIZE,
      maxWidth,
      2,
    );
    for (const line of lines) {
      expect(measureTextWidth(line, metrics, FONT_SIZE)).toBeLessThanOrEqual(maxWidth);
    }
  });

  it('collapses runs of whitespace rather than emitting empty lines', () => {
    expect(wrapText('one    two', metrics, FONT_SIZE, 1000, 3)).toEqual(['one two']);
  });
});
