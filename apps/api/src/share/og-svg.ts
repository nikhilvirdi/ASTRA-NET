/**
 * Composes DESIGN_SPEC.md §17's share card as an SVG string — the pure,
 * fully testable half of the OG image. Rasterizing it is `og-image.ts`'s
 * job; nothing here touches resvg, so the entire composition (including
 * the twilight color that is the whole point of §17) can be asserted in
 * unit tests without producing a single pixel.
 *
 * §17's composition, in order: location and date in mono micro; the
 * headline at `display-l`; the Horizon Band simplified to markers and
 * horizon only, no scrubber; three key measurements as a mono row; a
 * discreet ASTRANET wordmark and one CTA.
 *
 * **Type scale.** Every size below is a §5.3 token, but rooted at 20px
 * rather than 16px. The card is a fixed 1200x630 artifact that link
 * previews downscale, not a 16px-root document, so a 1.25x root (itself
 * the scale's own modular ratio) keeps every size exactly on §5.3's rem
 * values while staying legible in a feed. One number, applied once — see
 * DECISIONS.md.
 *
 * **Ink.** §4.1's surfaces span near-white (day) to near-black (night), so
 * a single ink color cannot meet Part VI's contrast floor at every
 * twilight phase. Ink is chosen from the surface's own luminance, out of
 * the locked palette only: §4.1's sky tokens for text and §4.2's explicit
 * "brass on light surfaces (day mode)" token for instrument marks. No
 * color is invented, and §4.3's ember is deliberately unused — §4.3
 * restricts it to live state and alerts, which a frozen snapshot is not.
 */

import type { ShareMarker, ShareSnapshot } from './share.schemas.js';
import { MONO_FAMILY, PROPORTIONAL_FAMILY, type ShareCardFonts } from './fonts.js';
import { measureTextWidth, wrapText } from './font-metrics.js';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** DESIGN_SPEC.md §6.1's spacing scale — 64 and 48 are both on it. */
const MARGIN_X = 64;

/** §5.3 tokens at a 20px root (see the file header). */
const ROOT_PX = 20;
const SIZE_DISPLAY_L = 3.75 * ROOT_PX;
const SIZE_DATA_L = 2 * ROOT_PX;
const SIZE_MICRO = 0.75 * ROOT_PX;
const SIZE_BODY = 1 * ROOT_PX;
/** §5.3 tracking, in px at the sizes above. */
const TRACKING_DISPLAY_L = -0.025 * SIZE_DISPLAY_L;
const TRACKING_MICRO = 0.08 * SIZE_MICRO;

/** §5.3 line height for `display-l` is 1.0 — "near-solid leading". */
const HEADLINE_LINE_HEIGHT = SIZE_DISPLAY_L;
const HEADLINE_MAX_LINES = 3;

const EYEBROW_BASELINE = 90;
const HEADLINE_FIRST_BASELINE = 196;
const HORIZON_RULE_Y = 442;
const HORIZON_MAX_RISE = 62;
const HORIZON_MAX_DROP = 26;
const FACT_LABEL_BASELINE = 512;
const FACT_VALUE_BASELINE = 556;
const FOOTER_BASELINE = 594;

const CONTENT_WIDTH = OG_WIDTH - MARGIN_X * 2;

/**
 * DESIGN_SPEC.md §17's instrument plate. Both rects are sized to clear the
 * ascender and descender of the largest face they back, plus §6.1 padding,
 * and are checked in `og-svg.test.ts` against the elements above and below
 * them (the compass tick labels at 468 and the footer baseline at 594) so a
 * later type-scale change cannot make them collide unnoticed.
 */
const EYEBROW_PLATE_Y = 68;
const EYEBROW_PLATE_HEIGHT = 30;
const FACT_PLATE_Y = 492;
const FACT_PLATE_HEIGHT = 82;
/** §6.3 — the smallest radius on the scale; the plate is a panel, not a pill. */
const PLATE_RADIUS = 2;
const PLATE_PAD_X = 12;

/** DESIGN_SPEC.md §4.1 / §4.2 / §4.4 tokens, verbatim. */
const SKY_100 = '#EEF1F1';
const SKY_400 = '#8B9898';
const SKY_600 = '#3E4A4A';
const SKY_900 = '#111818';
const BRASS_300 = '#C9B187';
const BRASS_700 = '#6B5A3C';
const SOLAR = '#D9A05B';
const ORBITAL = '#A8B4BC';

interface InkPalette {
  /** Primary text. */
  ink: string;
  /** Secondary/tertiary text. */
  muted: string;
  /** Instrument marks: rules, ticks, mono labels (§4.2). */
  brass: string;
  /** Outline paired with every marker so shape, not hue, carries meaning (Part VI). */
  markerOutline: string;
}

function channel(hex: string, start: number): number {
  return parseInt(hex.slice(start, start + 2), 16);
}

/** WCAG 2.1 relative luminance (0-1) — the scale the contrast ratio is defined on. */
export function relativeLuminance(hex: string): number {
  const linear = [1, 3, 5].map((start) => {
    const value = channel(hex, start) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

/** WCAG 2.1 contrast ratio between two `#RRGGBB` colors, always >= 1. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/**
 * Light surfaces only occur in the day half of §4.1's ramp (sky-100 and
 * its immediate interpolations); everything from nautical twilight down is
 * dark, and the switch falls inside the civil segment where the ramp
 * crosses from a paper-like surface to a slate one.
 *
 * The choice is made by measuring both candidate inks against the surface
 * rather than by comparing its luminance to a tuned constant. A constant
 * has to be picked in some luminance space, and the crossover — the point
 * where sky-900 and sky-100 contrast equally — does not land on a round
 * number in any of them (it is at Rec. 709 luminance 118.874 for this
 * ramp). Any integer threshold therefore hands the worse of the two inks
 * to a narrow band of real twilights. Asking the contrast function
 * directly makes "always the more legible ink" true by construction and
 * leaves nothing to re-tune if §4.1's tokens ever move.
 *
 * This palette is what the elements sitting *directly on the surface* use:
 * the headline, the horizon band, the wordmark and the CTA. The eyebrow and
 * the fact row do not use it — they sit on §17's instrument plate and take
 * `PLATE_PALETTE` below, because on a mid-grey surface no choice between
 * these two token sets reaches Part VI's small-text floor (see
 * `PLATE_PALETTE`'s comment for the arithmetic).
 */
export function inkPaletteFor(surfaceHex: string): InkPalette {
  const preferDarkInk = contrastRatio(SKY_900, surfaceHex) >= contrastRatio(SKY_100, surfaceHex);
  return preferDarkInk
    ? { ink: SKY_900, muted: SKY_600, brass: BRASS_700, markerOutline: SKY_900 }
    : { ink: SKY_100, muted: SKY_400, brass: BRASS_300, markerOutline: SKY_900 };
}

/**
 * DESIGN_SPEC.md §17's instrument plate — a solid `sky-900` panel behind the
 * eyebrow strip and the mono measurement row.
 *
 * Why a plate rather than a better ink: the best worst-case contrast any
 * two-token strategy can reach is `sqrt(contrast(lightToken, darkToken))`,
 * the value at the crossover where both candidates contrast equally. For
 * `brass-300`/`brass-700` that ceiling is 1.79:1 and for `sky-400`/`sky-600`
 * it is 1.76:1, against the 20.25 pair contrast a 4.5:1 guarantee needs. So
 * small text on the bare ramp cannot meet Part VI at any threshold, and
 * narrowing the ramp would have to delete the whole civil segment to fix it.
 * Lifting the text off the surface is the only remedy that leaves §4.1
 * untouched. On this plate the same tokens give brass-300 8.67:1 and
 * sky-100 15.83:1.
 *
 * Constant, never surface-derived: the plate is unconditional (§17), so the
 * palette on it is always the dark-surface one regardless of the twilight
 * behind it.
 */
const PLATE_HEX = SKY_900;
const PLATE_PALETTE: InkPalette = {
  ink: SKY_100,
  muted: SKY_400,
  brass: BRASS_300,
  markerOutline: SKY_900,
};

/** XML-escapes text before it is interpolated into the document. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

/** §17's eyebrow: "Location and date, mono, `micro`" — uppercase per §7's mono-label rule. */
export function composeEyebrow(snapshot: ShareSnapshot): string {
  const captured = new Date(snapshot.capturedAt);
  const date = `${captured.getUTCDate()} ${MONTHS[captured.getUTCMonth()] ?? ''} ${captured.getUTCFullYear()}`;
  const time = `${String(captured.getUTCHours()).padStart(2, '0')}:${String(captured.getUTCMinutes()).padStart(2, '0')} UTC`;
  const band =
    snapshot.sky.twilightBand === 'day'
      ? 'DAYLIGHT'
      : snapshot.sky.twilightBand === 'night'
        ? 'NIGHT'
        : `${snapshot.sky.twilightBand.toUpperCase()} TWILIGHT`;
  return `${snapshot.observer.label} · ${date} · ${time} · ${band}`;
}

const COMPASS_TICKS: readonly { readonly label: string; readonly deg: number }[] = [
  { label: 'N', deg: 0 },
  { label: 'NE', deg: 45 },
  { label: 'E', deg: 90 },
  { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SW', deg: 225 },
  { label: 'W', deg: 270 },
  { label: 'NW', deg: 315 },
];

/** Full 360deg panorama across the content width — the band's ultrawide form (Part V). */
function azimuthToX(azimuthDeg: number): number {
  return MARGIN_X + (azimuthDeg / 360) * CONTENT_WIDTH;
}

/**
 * Altitude to a y within the band. Above the horizon, 0-90deg maps onto
 * the available rise; below it, the marker is drawn under the rule at a
 * shallower scale and dimmed — a Sun 18deg down is *why* the card is dark,
 * so hiding it would drop the one marker that explains the surface color.
 */
function altitudeToY(altitudeDeg: number): number {
  if (altitudeDeg >= 0) {
    return HORIZON_RULE_Y - Math.min(90, altitudeDeg) * (HORIZON_MAX_RISE / 90);
  }
  return HORIZON_RULE_Y + Math.min(90, -altitudeDeg) * (HORIZON_MAX_DROP / 90);
}

function markerFill(marker: ShareMarker, palette: InkPalette): string {
  switch (marker.type) {
    case 'sun':
      return SOLAR;
    case 'iss':
      return ORBITAL;
    case 'planet':
      return palette.brass;
    case 'moon':
      // §4.4 names no Moon color. Rather than invent one, the Moon takes
      // the surface's own primary ink — neutral, always legible, and
      // distinguished from the others by shape and label (Part VI).
      return palette.ink;
  }
}

/**
 * One shape per marker type, so the band is readable with hue removed
 * entirely (Part VI's colour-independence floor, and what makes Red Light
 * Mode possible at all): the Sun is the largest disc, the Moon a ring, a
 * planet a small disc, the ISS a square.
 */
function markerShape(marker: ShareMarker, x: number, y: number, palette: InkPalette): string {
  const outline = `stroke="${palette.markerOutline}" stroke-width="1"`;
  switch (marker.type) {
    case 'sun':
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${SOLAR}" ${outline}/>`;
    case 'moon':
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="none" stroke="${markerFill(marker, palette)}" stroke-width="2.5"/>`;
    case 'planet':
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${palette.brass}" ${outline}/>`;
    case 'iss':
      return `<rect x="${(x - 6).toFixed(1)}" y="${(y - 6).toFixed(1)}" width="12" height="12" fill="${ORBITAL}" ${outline}/>`;
  }
}

function renderMarker(marker: ShareMarker, palette: InkPalette): string {
  const x = azimuthToX(marker.azimuthDeg);
  const y = altitudeToY(marker.altitudeDeg);
  const below = marker.altitudeDeg < 0;
  const labelY = below ? y + 26 : y - 18;
  return [
    `<g opacity="${below ? '0.5' : '1'}">`,
    markerShape(marker, x, y, palette),
    `<text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-family="${MONO_FAMILY}" font-size="${SIZE_MICRO}" letter-spacing="${TRACKING_MICRO.toFixed(2)}" fill="${palette.brass}">${escapeXml(marker.label)}</text>`,
    '</g>',
  ].join('');
}

/**
 * Lays the three measurements out on their real widths rather than in
 * equal thirds: §5.4's tabular figures are only worth having if the
 * column they sit in is set to the value it actually contains. Columns are
 * evenly distributed across the content width, each left-aligned on its
 * own start.
 */
function renderFacts(snapshot: ShareSnapshot): string {
  if (snapshot.facts.length === 0) return '';
  const columnWidth = CONTENT_WIDTH / snapshot.facts.length;
  // The row sits on §17's plate, so it takes the plate palette rather than
  // the surface-derived one — the surface behind it is irrelevant.
  const plate = `<rect x="${MARGIN_X - PLATE_PAD_X}" y="${FACT_PLATE_Y}" width="${CONTENT_WIDTH + PLATE_PAD_X * 2}" height="${FACT_PLATE_HEIGHT}" rx="${PLATE_RADIUS}" fill="${PLATE_HEX}"/>`;
  const columns = snapshot.facts
    .map((fact, index) => {
      const x = MARGIN_X + index * columnWidth;
      return [
        `<text x="${x.toFixed(1)}" y="${FACT_LABEL_BASELINE}" font-family="${MONO_FAMILY}" font-size="${SIZE_MICRO}" letter-spacing="${TRACKING_MICRO.toFixed(2)}" fill="${PLATE_PALETTE.brass}">${escapeXml(fact.label)}</text>`,
        `<text x="${x.toFixed(1)}" y="${FACT_VALUE_BASELINE}" font-family="${MONO_FAMILY}" font-size="${SIZE_DATA_L}" fill="${PLATE_PALETTE.ink}">${escapeXml(fact.value)}</text>`,
      ].join('');
    })
    .join('');
  return plate + columns;
}

/**
 * The eyebrow strip and its plate. Hugs the text rather than spanning the
 * content width: the eyebrow is a single run whose length varies with the
 * coordinate label, and a plate sized to it occludes the least surface —
 * the twilight color is the point of the card (§17).
 */
function renderEyebrow(snapshot: ShareSnapshot, fonts: ShareCardFonts): string {
  const text = composeEyebrow(snapshot);
  const width = measureTextWidth(text, fonts.mono, SIZE_MICRO, TRACKING_MICRO);
  return [
    `<rect x="${MARGIN_X - PLATE_PAD_X}" y="${EYEBROW_PLATE_Y}" width="${(width + PLATE_PAD_X * 2).toFixed(1)}" height="${EYEBROW_PLATE_HEIGHT}" rx="${PLATE_RADIUS}" fill="${PLATE_HEX}"/>`,
    `<text x="${MARGIN_X}" y="${EYEBROW_BASELINE}" font-family="${MONO_FAMILY}" font-size="${SIZE_MICRO}" letter-spacing="${TRACKING_MICRO.toFixed(2)}" fill="${PLATE_PALETTE.brass}">${escapeXml(text)}</text>`,
  ].join('');
}

export interface ComposeShareCardSvgParams {
  snapshot: ShareSnapshot;
  fonts: ShareCardFonts;
}

/**
 * The whole card, as an SVG document string. Deterministic: the same
 * snapshot always produces byte-identical output, which is what lets the
 * PNG be cached immutably and diffed in tests.
 */
export function composeShareCardSvg({ snapshot, fonts }: ComposeShareCardSvgParams): string {
  const palette = inkPaletteFor(snapshot.sky.surfaceHex);

  const headlineLines = wrapText(
    snapshot.headline,
    fonts.proportionalSemiBold,
    SIZE_DISPLAY_L,
    CONTENT_WIDTH,
    HEADLINE_MAX_LINES,
    TRACKING_DISPLAY_L,
  );

  const headline = headlineLines
    .map(
      (line, index) =>
        `<text x="${MARGIN_X}" y="${HEADLINE_FIRST_BASELINE + index * HEADLINE_LINE_HEIGHT}" font-family="${PROPORTIONAL_FAMILY}" font-weight="600" font-size="${SIZE_DISPLAY_L}" letter-spacing="${TRACKING_DISPLAY_L.toFixed(2)}" fill="${palette.ink}">${escapeXml(line)}</text>`,
    )
    .join('');

  const compass = COMPASS_TICKS.map((tick) => {
    const x = azimuthToX(tick.deg);
    return [
      `<line x1="${x.toFixed(1)}" y1="${HORIZON_RULE_Y}" x2="${x.toFixed(1)}" y2="${HORIZON_RULE_Y + 8}" stroke="${palette.brass}" stroke-width="1"/>`,
      `<text x="${x.toFixed(1)}" y="${HORIZON_RULE_Y + 26}" text-anchor="middle" font-family="${MONO_FAMILY}" font-size="${SIZE_MICRO}" letter-spacing="${TRACKING_MICRO.toFixed(2)}" fill="${palette.brass}">${tick.label}</text>`,
    ].join('');
  }).join('');

  const markers = snapshot.horizon.markers.map((marker) => renderMarker(marker, palette)).join('');

  const wordmark = `<text x="${MARGIN_X}" y="${FOOTER_BASELINE}" font-family="${PROPORTIONAL_FAMILY}" font-weight="600" font-size="${SIZE_BODY}" letter-spacing="${(0.12 * SIZE_BODY).toFixed(2)}" fill="${palette.ink}">ASTRANET</text>`;

  const ctaText = 'See your own sky';
  const ctaWidth = measureTextWidth(ctaText, fonts.proportionalRegular, SIZE_BODY);
  const ctaX = OG_WIDTH - MARGIN_X - ctaWidth;
  const cta = [
    `<text x="${ctaX.toFixed(1)}" y="${FOOTER_BASELINE}" font-family="${PROPORTIONAL_FAMILY}" font-size="${SIZE_BODY}" fill="${palette.muted}">${escapeXml(ctaText)}</text>`,
    `<line x1="${ctaX.toFixed(1)}" y1="${FOOTER_BASELINE + 8}" x2="${(OG_WIDTH - MARGIN_X).toFixed(1)}" y2="${FOOTER_BASELINE + 8}" stroke="${palette.brass}" stroke-width="1"/>`,
  ].join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">`,
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${snapshot.sky.surfaceHex}"/>`,
    renderEyebrow(snapshot, fonts),
    headline,
    `<line x1="${MARGIN_X}" y1="${HORIZON_RULE_Y}" x2="${OG_WIDTH - MARGIN_X}" y2="${HORIZON_RULE_Y}" stroke="${palette.brass}" stroke-width="1"/>`,
    compass,
    markers,
    renderFacts(snapshot),
    wordmark,
    cta,
    '</svg>',
  ].join('');
}
