/**
 * Rasterizes the composed card to the 1200x630 PNG that DESIGN_SPEC.md
 * §17 requires ("server-rendered ... using the same composition and the
 * _actual twilight colors for that location and time_").
 *
 * This is the only file in the share module that touches `@resvg/resvg-js`
 * — the composition itself is a pure string in `og-svg.ts`, so everything
 * about the card except the rasterization step is testable without
 * producing pixels.
 *
 * PNG rather than SVG because that is not a stylistic choice: no major OG
 * consumer (X, Slack, Facebook, iMessage) renders an SVG `og:image`.
 *
 * No render cache. A snapshot is immutable and the composition is
 * deterministic, so the same id always yields byte-identical bytes — which
 * makes `Cache-Control: immutable` on the route the correct place for this
 * to be cached, rather than a second, weaker copy of that guarantee held
 * in process memory.
 */

import { Resvg } from '@resvg/resvg-js';
import { composeShareCardSvg } from './og-svg.js';
import { loadShareCardFonts, type ShareCardFonts } from './fonts.js';
import type { ShareSnapshot } from './share.schemas.js';

export function renderShareCardPng(
  snapshot: ShareSnapshot,
  fonts: ShareCardFonts = loadShareCardFonts(),
): Buffer {
  const svg = composeShareCardSvg({ snapshot, fonts });
  const renderer = new Resvg(svg, {
    font: {
      // The card must look identical on a developer laptop and on the
      // VPS, so only the three vendored faces are allowed to resolve —
      // a system font silently substituting for Archivo would break
      // DESIGN_SPEC.md §5.1's proportional/mono rule invisibly.
      loadSystemFonts: false,
      fontFiles: fonts.fontFiles,
      defaultFontFamily: 'Archivo',
    },
  });
  return renderer.render().asPng();
}
