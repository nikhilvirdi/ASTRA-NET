/**
 * Minimal TrueType advance-width reader, used only to lay out the
 * server-rendered OG card (WORKPLAN.md Phase 11, DESIGN_SPEC.md §17).
 *
 * SVG `<text>` does not wrap, and `@resvg/resvg-js` exposes no text
 * measurement API before rendering — so composing a 1200x630 card whose
 * headline is variable-length (it names a real time and a real place)
 * needs the font's own advance widths, or the headline silently runs off
 * the edge of the single artifact most non-users will ever see.
 *
 * Deliberately the smallest parser that answers one question — "how wide
 * is this string at this size?" — rather than a font library: it reads
 * `head` (unitsPerEm), `hhea` (numberOfHMetrics), `hmtx` (advances) and a
 * format-4 `cmap` subtable (codepoint -> glyph id). Both vendored faces
 * (Archivo, Martian Mono) ship a format-4 subtable covering every glyph
 * this card can render — the card's character set is ASCII plus the
 * degree sign, the true minus, and the middle dot, all BMP.
 *
 * Verified against `@resvg/resvg-js`'s own layout in `font-metrics.test.ts`
 * rather than only against itself: the same strings are measured here and
 * rendered by resvg, and the per-glyph advances are required to agree
 * exactly.
 *
 * **Kerning is deliberately not read.** resvg applies each face's GPOS kern
 * pairs; this parser does not, so a whole string measures slightly *wider*
 * here than resvg will draw it (measured at ~0.6% for an ordinary English
 * headline — "To" alone pulls in 3.2px at 40px). Adding a GPOS reader is
 * disproportionate to what that buys: kern adjustments are essentially
 * always negative, so the error is one-directional and lands on the safe
 * side of every decision this module feeds. `wrapText` breaks a line
 * marginally early rather than overflowing the card, and the right-aligned
 * CTA sits marginally left of the margin rather than past it. An
 * under-measure would do the opposite and clip the single artifact most
 * non-users will ever see, so the bias is kept rather than corrected.
 */

import fs from 'node:fs';

/**
 * A parsed face: everything `measureTextWidth` needs, plus the two real
 * vertical metrics the Horizon Band glyph/compass-label collision fix
 * needs (`og-svg.ts`'s `COMPASS_LABEL_OFFSET` derivation, `og-svg.test.ts`'s
 * exhaustive sweep) — read from the font file itself rather than estimated
 * as a fraction of font size.
 */
export interface FontMetrics {
  unitsPerEm: number;
  /** Advance width in font units, by glyph id. */
  advanceWidths: number[];
  /** Codepoint -> glyph id, from the format-4 `cmap` subtable. */
  glyphIds: Map<number, number>;
  /**
   * `OS/2.sCapHeight`, in font units — the real height uppercase glyphs
   * reach above the baseline (every label this card draws is uppercase
   * mono text, so this is the true ink-top bound, not the more generous
   * `hhea`/`OS/2` ascender that also budgets room for accents this font's
   * rendered character set never uses).
   */
  capHeight: number;
  /** `|OS/2.sTypoDescender|`, in font units — real ink-bottom bound below the baseline. */
  descender: number;
}

const SFNT_HEADER_BYTES = 12;
const TABLE_RECORD_BYTES = 16;
const HEAD_UNITS_PER_EM_OFFSET = 18;
const HHEA_NUM_H_METRICS_OFFSET = 34;
const CMAP_FORMAT_4 = 4;
const OS2_VERSION_OFFSET = 0;
const OS2_TYPO_DESCENDER_OFFSET = 70;
const OS2_CAP_HEIGHT_OFFSET = 88;
/** `sCapHeight`/`sxHeight` only exist from OS/2 version 2 onward. */
const OS2_MIN_VERSION_FOR_CAP_HEIGHT = 2;

interface TableRecord {
  offset: number;
  length: number;
}

function readTableDirectory(buffer: Buffer): Map<string, TableRecord> {
  const numTables = buffer.readUInt16BE(4);
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i += 1) {
    const recordOffset = SFNT_HEADER_BYTES + i * TABLE_RECORD_BYTES;
    if (recordOffset + TABLE_RECORD_BYTES > buffer.length) break;
    const tag = buffer.toString('ascii', recordOffset, recordOffset + 4);
    tables.set(tag, {
      offset: buffer.readUInt32BE(recordOffset + 8),
      length: buffer.readUInt32BE(recordOffset + 12),
    });
  }
  return tables;
}

/**
 * Parses the first format-4 subtable found in `cmap`, preferring the
 * Windows/BMP encoding (platform 3, encoding 1) that both vendored faces
 * carry. Segment arithmetic follows the OpenType spec's own description;
 * a segment whose `idRangeOffset` points outside the table is skipped
 * rather than trusted, so a corrupt font yields missing glyphs (and the
 * documented fallback advance) instead of reading arbitrary memory.
 */
function readFormat4Cmap(buffer: Buffer, cmapOffset: number): Map<number, number> {
  const glyphIds = new Map<number, number>();
  const numSubtables = buffer.readUInt16BE(cmapOffset + 2);

  let chosen: number | null = null;
  for (let i = 0; i < numSubtables; i += 1) {
    const recordOffset = cmapOffset + 4 + i * 8;
    const platformId = buffer.readUInt16BE(recordOffset);
    const encodingId = buffer.readUInt16BE(recordOffset + 2);
    const subtableOffset = cmapOffset + buffer.readUInt32BE(recordOffset + 4);
    if (subtableOffset + 4 > buffer.length) continue;
    if (buffer.readUInt16BE(subtableOffset) !== CMAP_FORMAT_4) continue;
    // Windows/BMP wins outright; anything else is a usable fallback.
    if (platformId === 3 && encodingId === 1) {
      chosen = subtableOffset;
      break;
    }
    chosen ??= subtableOffset;
  }
  if (chosen === null) return glyphIds;

  const segCount = buffer.readUInt16BE(chosen + 6) / 2;
  const endCodes = chosen + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;

  for (let segment = 0; segment < segCount; segment += 1) {
    const endCode = buffer.readUInt16BE(endCodes + segment * 2);
    const startCode = buffer.readUInt16BE(startCodes + segment * 2);
    const idDelta = buffer.readInt16BE(idDeltas + segment * 2);
    const idRangeOffsetPosition = idRangeOffsets + segment * 2;
    const idRangeOffset = buffer.readUInt16BE(idRangeOffsetPosition);
    if (startCode === 0xffff) continue;

    for (let codepoint = startCode; codepoint <= endCode && codepoint !== 0xffff; codepoint += 1) {
      let glyphId: number;
      if (idRangeOffset === 0) {
        glyphId = (codepoint + idDelta) & 0xffff;
      } else {
        const glyphIndexPosition =
          idRangeOffsetPosition + idRangeOffset + (codepoint - startCode) * 2;
        if (glyphIndexPosition + 2 > buffer.length) continue;
        const raw = buffer.readUInt16BE(glyphIndexPosition);
        if (raw === 0) continue;
        glyphId = (raw + idDelta) & 0xffff;
      }
      if (glyphId !== 0) glyphIds.set(codepoint, glyphId);
    }
  }

  return glyphIds;
}

/**
 * Reads one TrueType file into the three lookups `measureTextWidth`
 * needs. Throws on a file that is not a parseable sfnt — this runs once
 * at OG-render time over a file vendored into the repo, so a failure here
 * is a broken build artifact, not a runtime condition to degrade around.
 */
export function parseFontMetrics(fontPath: string): FontMetrics {
  const buffer = fs.readFileSync(fontPath);
  const tables = readTableDirectory(buffer);

  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const hmtx = tables.get('hmtx');
  const cmap = tables.get('cmap');
  const os2 = tables.get('OS/2');
  if (
    head === undefined ||
    hhea === undefined ||
    hmtx === undefined ||
    cmap === undefined ||
    os2 === undefined
  ) {
    throw new Error(`Font is missing a required table (head/hhea/hmtx/cmap/OS\\/2): ${fontPath}`);
  }

  const unitsPerEm = buffer.readUInt16BE(head.offset + HEAD_UNITS_PER_EM_OFFSET);
  const numberOfHMetrics = buffer.readUInt16BE(hhea.offset + HHEA_NUM_H_METRICS_OFFSET);

  const advanceWidths: number[] = [];
  for (let i = 0; i < numberOfHMetrics; i += 1) {
    const position = hmtx.offset + i * 4;
    if (position + 2 > buffer.length) break;
    advanceWidths.push(buffer.readUInt16BE(position));
  }

  const os2Version = buffer.readUInt16BE(os2.offset + OS2_VERSION_OFFSET);
  if (os2Version < OS2_MIN_VERSION_FOR_CAP_HEIGHT) {
    throw new Error(
      `Font's OS/2 table is version ${os2Version}, too old to carry sCapHeight (need >= ${OS2_MIN_VERSION_FOR_CAP_HEIGHT}): ${fontPath}`,
    );
  }
  const capHeight = buffer.readInt16BE(os2.offset + OS2_CAP_HEIGHT_OFFSET);
  const descender = Math.abs(buffer.readInt16BE(os2.offset + OS2_TYPO_DESCENDER_OFFSET));

  return {
    unitsPerEm,
    advanceWidths,
    glyphIds: readFormat4Cmap(buffer, cmap.offset),
    capHeight,
    descender,
  };
}

/**
 * Advance width of one codepoint, in font units. Glyphs past
 * `numberOfHMetrics` share the last entry's advance — that is exactly
 * what `hmtx`'s trailing left-side-bearing array means, not an
 * approximation. An unmapped codepoint falls back to the space advance
 * so an unexpected character widens the line rather than being measured
 * as zero (which would under-wrap and overflow the card).
 */
function advanceWidthForCodePoint(metrics: FontMetrics, codepoint: number): number {
  const glyphId = metrics.glyphIds.get(codepoint);
  const last = metrics.advanceWidths[metrics.advanceWidths.length - 1] ?? 0;
  if (glyphId === undefined) {
    const spaceGlyph = metrics.glyphIds.get(0x20);
    if (spaceGlyph === undefined) return last;
    return metrics.advanceWidths[Math.min(spaceGlyph, metrics.advanceWidths.length - 1)] ?? last;
  }
  return metrics.advanceWidths[Math.min(glyphId, metrics.advanceWidths.length - 1)] ?? last;
}

/**
 * Width of `text` in px at `fontSizePx`, including `letterSpacingPx`
 * applied between glyphs. Letter-spacing is counted `length - 1` times,
 * matching SVG's own `letter-spacing` behaviour (no trailing space after
 * the final glyph), which is what the OG card's negative display tracking
 * depends on to land where it is measured.
 */
export function measureTextWidth(
  text: string,
  metrics: FontMetrics,
  fontSizePx: number,
  letterSpacingPx = 0,
): number {
  const codepoints = [...text];
  if (codepoints.length === 0) return 0;

  let units = 0;
  for (const character of codepoints) {
    units += advanceWidthForCodePoint(metrics, character.codePointAt(0) ?? 0x20);
  }
  const glyphWidth = (units / metrics.unitsPerEm) * fontSizePx;
  return glyphWidth + letterSpacingPx * (codepoints.length - 1);
}

/**
 * Greedy word wrap to `maxWidthPx`, capped at `maxLines`. A single word
 * too long to fit on its own line is kept whole on its own line rather
 * than broken mid-word — the card's vocabulary is times, place labels and
 * short sentences, where a hyphenated break would read as a rendering
 * bug. When the text needs more than `maxLines`, the last line is
 * ellipsised with a true ellipsis character.
 */
export function wrapText(
  text: string,
  metrics: FontMetrics,
  fontSizePx: number,
  maxWidthPx: number,
  maxLines: number,
  letterSpacingPx = 0,
): string[] {
  const words = text.split(/\s+/u).filter((word) => word !== '');
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (
      current !== '' &&
      measureTextWidth(candidate, metrics, fontSizePx, letterSpacingPx) > maxWidthPx
    ) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== '') lines.push(current);

  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const lastIndex = maxLines - 1;
  let last = `${kept[lastIndex] ?? ''}…`;
  while (
    last.length > 1 &&
    measureTextWidth(last, metrics, fontSizePx, letterSpacingPx) > maxWidthPx
  ) {
    last = `${last.slice(0, -2)}…`;
  }
  kept[lastIndex] = last;
  return kept;
}
