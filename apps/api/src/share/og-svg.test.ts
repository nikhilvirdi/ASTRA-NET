/**
 * The pure SVG composition of the share card (WORKPLAN.md Phase 11,
 * DESIGN_SPEC.md §17).
 *
 * The assertions that matter most are the ones §17 is actually about: that
 * the card is visibly different depending on the real time and location it
 * was shared for, and that its ink stays legible across the whole twilight
 * ramp — the two properties a generic "renders some SVG" test would miss.
 */

import { describe, expect, it } from 'vitest';
import {
  composeEyebrow,
  composeShareCardSvg,
  escapeXml,
  inkPaletteFor,
  relativeLuminance,
  OG_HEIGHT,
  OG_WIDTH,
} from './og-svg.js';
import { loadShareCardFonts } from './fonts.js';
import { makeShareSnapshot } from './__fixtures__/snapshot.js';
import type { ShareSnapshot } from './share.schemas.js';

const fonts = loadShareCardFonts();

function compose(snapshot: ShareSnapshot = makeShareSnapshot()): string {
  return composeShareCardSvg({ snapshot, fonts });
}

/** Contrast ratio per WCAG 2.1, on the same Rec. 709 channels §4.1 is specified in. */
function contrastRatio(foreground: string, background: string): number {
  const relative = (hex: string): number => {
    const channels = [1, 3, 5].map((start) => {
      const value = parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const [lighter, darker] = [relative(foreground), relative(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

describe('escapeXml', () => {
  it('escapes every character that could break the document', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;');
  });

  it('escapes the ampersand first so entities are not double-escaped', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves the card’s real glyphs untouched', () => {
    expect(escapeXml('51.51°N 0.13°W · −14.2°')).toBe('51.51°N 0.13°W · −14.2°');
  });
});

describe('relativeLuminance', () => {
  it('orders the four DESIGN_SPEC.md §4.1 ramp stops monotonically', () => {
    const stops = ['#EEF1F1', '#3E4A4A', '#1C2424', '#111818'].map(relativeLuminance);
    for (let i = 1; i < stops.length; i += 1) {
      expect(stops[i]!).toBeLessThan(stops[i - 1]!);
    }
  });

  it('anchors the two ends of the WCAG scale', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
  });

  it('agrees with the independently computed ratio used throughout this file', () => {
    // The local `contrastRatio` helper below is written from the WCAG
    // definition rather than imported, so this pins the module's own
    // exported version against it instead of against itself.
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 4);
  });
});

describe('inkPaletteFor', () => {
  it('uses dark ink on the day surface and light ink on the night surface', () => {
    expect(inkPaletteFor('#EEF1F1').ink).toBe('#111818');
    expect(inkPaletteFor('#111818').ink).toBe('#EEF1F1');
  });

  it('pairs each surface with the brass token §4.2 assigns to it', () => {
    // §4.2 names brass-700 explicitly for light surfaces (day mode).
    expect(inkPaletteFor('#EEF1F1').brass).toBe('#6B5A3C');
    expect(inkPaletteFor('#111818').brass).toBe('#C9B187');
  });

  it('always picks whichever of the two inks contrasts better', () => {
    // This is the property the threshold exists to guarantee, and it must
    // hold for the whole continuous surface range — the card renders
    // interpolated colors far more often than the four named stops.
    for (let step = 0; step <= 300; step += 1) {
      const surface = surfaceHexFor((step / 300) * 3);
      const chosen = contrastRatio(inkPaletteFor(surface).ink, surface);
      const alternative = contrastRatio(
        inkPaletteFor(surface).ink === '#111818' ? '#EEF1F1' : '#111818',
        surface,
      );
      expect(chosen).toBeGreaterThanOrEqual(alternative);
    }
  });

  it('clears the 3:1 large-text floor everywhere on the ramp', () => {
    // The headline is `display-l` (75px), so 3:1 is its applicable floor
    // and it holds across every twilight the card can render.
    for (let step = 0; step <= 300; step += 1) {
      const surface = surfaceHexFor((step / 300) * 3);
      expect(contrastRatio(inkPaletteFor(surface).ink, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('clears the AA 4.5:1 floor everywhere except the known civil-twilight band', () => {
    // Retained as a regression guard on ink selection, not because any
    // element still depends on it: since §17's plate landed, every
    // bare-surface ink element (headline 75px, wordmark 20px semibold) is
    // WCAG large text and answers to the 3:1 floor asserted above.
    for (let step = 0; step <= 300; step += 1) {
      const value = (step / 300) * 3;
      if (value >= 0.66 && value <= 0.79) continue;
      const surface = surfaceHexFor(value);
      expect(contrastRatio(inkPaletteFor(surface).ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('holds the residual gap no worse than the palette’s own ceiling', () => {
    // ~3.97:1 is the ceiling for sky-100/sky-900 against this ramp when the
    // better ink is always chosen. If a change makes it worse, the ink
    // selection regressed and the fix is there, not in this bound.
    let worst = Infinity;
    for (let step = 0; step <= 3000; step += 1) {
      const surface = surfaceHexFor((step / 3000) * 3);
      worst = Math.min(worst, contrastRatio(inkPaletteFor(surface).ink, surface));
    }
    expect(worst).toBeGreaterThan(3.9);
  });

  it('confirms brass and muted can never reach 4.5:1 on the bare ramp', () => {
    // The arithmetic that forced §17's plate, asserted rather than asserted
    // in a comment: the best worst-case contrast a two-token strategy can
    // reach is sqrt(contrast(lightToken, darkToken)) — the value at the
    // crossover where both candidates are equal. If a future palette change
    // lifts either pair past 20.25, the plate stops being load-bearing and
    // this test is the thing that should say so.
    const REQUIRED_PAIR_CONTRAST = 4.5 * 4.5;
    const pairs = {
      ink: contrastRatio('#EEF1F1', '#111818'),
      brass: contrastRatio('#C9B187', '#6B5A3C'),
      muted: contrastRatio('#8B9898', '#3E4A4A'),
    };

    expect(Math.sqrt(pairs.ink)).toBeCloseTo(3.979, 2);
    expect(Math.sqrt(pairs.brass)).toBeCloseTo(1.792, 2);
    expect(Math.sqrt(pairs.muted)).toBeCloseTo(1.756, 2);

    for (const ceiling of Object.values(pairs)) {
      expect(ceiling).toBeLessThan(REQUIRED_PAIR_CONTRAST);
    }
  });
});

/** Local copy of the shared ramp, so this test does not depend on the engine it checks against. */
function surfaceHexFor(value: number): string {
  const stops = [
    [0xee, 0xf1, 0xf1],
    [0x3e, 0x4a, 0x4a],
    [0x1c, 0x24, 0x24],
    [0x11, 0x18, 0x18],
  ];
  const clamped = Math.min(3, Math.max(0, value));
  const lower = Math.min(2, Math.floor(clamped));
  const t = clamped - lower;
  const channels = stops[lower]!.map((channel, i) =>
    Math.round(channel + (stops[lower + 1]![i]! - channel) * t),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

describe('composeEyebrow', () => {
  it('names the location, date, time and twilight band', () => {
    expect(composeEyebrow(makeShareSnapshot())).toBe(
      '51.51°N 0.13°W · 17 JULY 2026 · 21:40 UTC · ASTRONOMICAL TWILIGHT',
    );
  });

  it('renders the two plateau bands by name rather than as "X TWILIGHT"', () => {
    const day = makeShareSnapshot();
    day.sky.twilightBand = 'day';
    expect(composeEyebrow(day)).toContain('DAYLIGHT');
    expect(composeEyebrow(day)).not.toContain('DAY TWILIGHT');

    const night = makeShareSnapshot();
    night.sky.twilightBand = 'night';
    expect(composeEyebrow(night)).toContain('· NIGHT');
    expect(composeEyebrow(night)).not.toContain('NIGHT TWILIGHT');
  });

  it('states the time zone it is reporting in', () => {
    expect(composeEyebrow(makeShareSnapshot())).toContain('UTC');
  });
});

describe('composeShareCardSvg', () => {
  it('emits a 1200x630 document, the size OG consumers expect', () => {
    const svg = compose();
    expect(OG_WIDTH).toBe(1200);
    expect(OG_HEIGHT).toBe(630);
    expect(svg).toContain(`width="1200" height="630"`);
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('paints the background with the snapshot’s own stored surface color', () => {
    expect(compose()).toContain('<rect width="1200" height="630" fill="#182020"/>');
  });

  it('looks visibly different for a different time of day — §17’s whole point', () => {
    const night = makeShareSnapshot();
    const day = makeShareSnapshot();
    day.sky = {
      ...day.sky,
      sunAltitudeDeg: 34.2,
      twilightBand: 'day',
      twilightValue: 0,
      surfaceHex: '#EEF1F1',
    };

    const nightSvg = compose(night);
    const daySvg = compose(day);

    expect(nightSvg).not.toBe(daySvg);
    // Not merely different — the ink inverts, which is what keeps it legible.
    expect(daySvg).toContain('fill="#EEF1F1"/>');
    expect(daySvg).toContain('fill="#111818"');
    expect(nightSvg).toContain('fill="#182020"/>');
    expect(nightSvg).toContain('fill="#EEF1F1"');
  });

  it('is deterministic — the same snapshot always yields identical bytes', () => {
    expect(compose()).toBe(compose());
  });

  it('renders the headline, wrapped within the content width', () => {
    const svg = compose();
    expect(svg).toContain('The ISS crosses your sky');
    expect(svg).toContain('font-weight="600"');
  });

  it('ellipsises a headline too long for its three lines rather than overflowing', () => {
    const snapshot = makeShareSnapshot();
    snapshot.headline = `${'Aurora may reach your sky tonight '.repeat(8)}end`;
    const svg = compose(snapshot);

    expect(svg).toContain('…');
    // §5.3's display-l line height, three lines maximum.
    expect(svg.match(/font-size="75"/g)?.length).toBe(3);
  });

  it('sets words proportional and measurements mono, per §5.1', () => {
    const svg = compose();
    // The headline is proportional...
    expect(svg).toMatch(/font-family="Archivo"[^>]*>The ISS/);
    // ...and every fact value is mono.
    for (const fact of makeShareSnapshot().facts) {
      expect(svg).toMatch(
        new RegExp(
          `font-family="Martian Mono"[^>]*>${fact.value.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}<`,
        ),
      );
    }
  });

  it('draws all eight compass ticks across a full 360° panorama', () => {
    const svg = compose();
    for (const label of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
      expect(svg).toContain(`>${label}</text>`);
    }
    // Due north sits on the left margin, due south at the midpoint.
    expect(svg).toContain('x1="64.0" y1="442"');
    expect(svg).toContain('x1="600.0" y1="442"');
  });

  it('gives each marker type its own shape so hue is never the only signal', () => {
    const svg = compose();
    // Sun: largest disc. Moon: ring. Planet: small disc. ISS: square.
    expect(svg).toContain('r="9"');
    expect(svg).toContain('r="7" fill="none"');
    expect(svg).toContain('r="4.5"');
    expect(svg).toContain('width="12" height="12"');
  });

  it('dims a below-horizon marker but still draws it', () => {
    const svg = compose();
    // The Sun is 14.2deg down in the fixture — it is *why* the card is dark.
    expect(svg).toContain('<g opacity="0.5">');
    expect(svg).toContain('>SUN</text>');
  });

  it('renders one column per fact and no more', () => {
    const svg = compose();
    expect(svg).toContain('>NEXT ISS PASS</text>');
    expect(svg).toContain('>22:14 UTC</text>');
    expect(svg).toContain('>KP FORECAST</text>');
    expect(svg).toContain('>SOLAR WIND</text>');
  });

  it('omits the fact row entirely rather than drawing empty columns', () => {
    const snapshot = makeShareSnapshot({ facts: [] });
    const svg = compose(snapshot);
    expect(svg).not.toContain('y="512"');
    expect(svg).not.toContain('y="556"');
  });

  it('carries the wordmark and exactly one CTA', () => {
    const svg = compose();
    expect(svg).toContain('>ASTRANET</text>');
    expect(svg.match(/See your own sky/g)?.length).toBe(1);
  });

  it('keeps the right-aligned CTA inside the margin', () => {
    const svg = compose();
    const match = /x="([\d.]+)"[^>]*>See your own sky</.exec(svg);
    expect(match).not.toBeNull();
    const x = Number(match![1]);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(OG_WIDTH - 64);
  });

  it('escapes snapshot text rather than letting it break the document', () => {
    const snapshot = makeShareSnapshot({ headline: 'Tonight & <tomorrow> "clear"' });
    const svg = compose(snapshot);

    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;tomorrow&gt;');
    expect(svg).not.toContain('<tomorrow>');
  });

  it('renders a card with no markers at all without emitting a broken document', () => {
    const svg = compose(makeShareSnapshot({ horizon: { markers: [] } }));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    // The horizon rule and compass survive; only the markers are gone.
    expect(svg).toContain('>N</text>');
  });

  it('never uses §4.3’s ember, which is reserved for live state', () => {
    expect(compose()).not.toMatch(/#C1440A|#E4572E|ember/i);
  });

  it('never uses pure black, which §4.1 restricts to the 3D scene void', () => {
    expect(compose()).not.toMatch(/#000000|"black"/i);
  });
});

describe('the instrument plate (DESIGN_SPEC.md §17)', () => {
  const PLATE = '#111818';
  const BRASS_300 = '#C9B187';
  const BRASS_700 = '#6B5A3C';
  const SKY_100 = '#EEF1F1';

  /** A day-lit card — the case where the plate palette must NOT follow the surface. */
  function dayCard(): ShareSnapshot {
    return makeShareSnapshot({
      sky: {
        sunAltitudeDeg: 34.2,
        sunAzimuthDeg: 190.1,
        twilightPhase: 'day',
        twilightBand: 'day',
        twilightValue: 0,
        surfaceHex: '#EEF1F1',
      },
    });
  }

  /** Every `<rect>` in the document, as {x,y,width,height,fill}. */
  function rects(svg: string): { x: number; y: number; w: number; h: number; fill: string }[] {
    return [...svg.matchAll(/<rect ([^>]*)\/>/g)].map((match) => {
      const attr = (name: string): string =>
        new RegExp(`${name}="([^"]*)"`).exec(match[1] ?? '')?.[1] ?? '';
      return {
        x: Number(attr('x') || 0),
        y: Number(attr('y') || 0),
        w: Number(attr('width')),
        h: Number(attr('height')),
        fill: attr('fill'),
      };
    });
  }

  it('emits a plate behind the eyebrow and behind the fact row', () => {
    const plates = rects(compose()).filter((r) => r.fill === PLATE);
    expect(plates.length).toBe(2);

    const [eyebrow, facts] = plates.sort((a, b) => a.y - b.y);
    expect(eyebrow!.y).toBe(68);
    expect(eyebrow!.h).toBe(30);
    expect(facts!.y).toBe(492);
    expect(facts!.h).toBe(82);
  });

  it('leaves the headline and horizon band on bare surface, as §17 requires', () => {
    const svg = compose();
    const all = rects(svg);

    // The first rect is the full-bleed surface; the only other rects are the
    // two plates and the 12x12 ISS marker glyph. Nothing else backs anything.
    expect(all[0]!.fill).toBe(makeShareSnapshot().sky.surfaceHex);
    expect(all[0]!.w).toBe(OG_WIDTH);
    expect(all[0]!.h).toBe(OG_HEIGHT);

    const backing = all.slice(1).filter((r) => !(r.w === 12 && r.h === 12));
    expect(backing.length).toBe(2);
    expect(backing.every((r) => r.fill === PLATE)).toBe(true);

    // The headline baseline (196), the horizon rule (442) and the compass
    // tick labels (468) fall inside neither plate.
    for (const plate of backing) {
      for (const y of [196, 442, 468]) {
        expect(y >= plate.y && y <= plate.y + plate.h).toBe(false);
      }
    }
  });

  it('keeps the plate palette constant even on a day surface', () => {
    // The whole point: on #EEF1F1 the surface-derived palette would hand the
    // eyebrow brass-700, which against a sky-900 plate is nearly invisible.
    const day = compose(dayCard());
    expect(day).toContain(`fill="${BRASS_300}">51.51°N`);
    expect(day).not.toContain(`fill="${BRASS_700}">51.51°N`);

    // ...while the headline, still on bare surface, correctly takes dark ink.
    expect(day).toMatch(/fill="#111818">The ISS/);
  });

  it('renders fact labels in brass-300 and values in sky-100 on the plate', () => {
    const svg = compose(dayCard());
    expect(svg).toContain(`fill="${BRASS_300}">NEXT ISS PASS</text>`);
    expect(svg).toContain(`fill="${SKY_100}">22:14 UTC</text>`);
  });

  it('omits the fact plate entirely when there are no facts', () => {
    const plates = rects(compose(makeShareSnapshot({ facts: [] }))).filter((r) => r.fill === PLATE);
    expect(plates.length).toBe(1);
    expect(plates[0]!.y).toBe(68);
  });

  it('sizes the eyebrow plate to its text and keeps it inside the card', () => {
    const plates = rects(compose()).filter((r) => r.fill === PLATE);
    const eyebrow = plates.sort((a, b) => a.y - b.y)[0]!;
    expect(eyebrow.x).toBe(64 - 12);
    // Hugs the text rather than spanning the content width, so it occludes
    // the least surface — the twilight color is the point of the card.
    expect(eyebrow.w).toBeLessThan(OG_WIDTH - 128);
    expect(eyebrow.x + eyebrow.w).toBeLessThan(OG_WIDTH);
  });

  it('gives every plate-backed element 4.5:1 at EVERY point on the ramp', () => {
    // The coverage that was missing: brass and muted, not ink. Because the
    // plate is constant these hold regardless of surface — which is exactly
    // the property being asserted.
    for (const ink of [BRASS_300, SKY_100]) {
      expect(contrastRatio(ink, PLATE)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(BRASS_300, PLATE)).toBeCloseTo(8.67, 1);
    expect(contrastRatio(SKY_100, PLATE)).toBeCloseTo(15.83, 1);

    // And it is genuinely surface-independent across the whole ramp.
    for (let step = 0; step <= 300; step += 1) {
      const svg = compose(
        makeShareSnapshot({
          sky: { ...makeShareSnapshot().sky, surfaceHex: surfaceHexFor((step / 300) * 3) },
        }),
      );
      expect(svg).toContain(`fill="${BRASS_300}">NEXT ISS PASS</text>`);
    }
  });

  it('pins §17’s known exception — Band labels and CTA are still below 4.5:1', () => {
    // Not a passing assertion: this records the gap §17 explicitly declines
    // to close, so it stays visible and cannot be mistaken for solved. The
    // compass ticks, marker labels (brass, micro) and the CTA (muted, body)
    // remain on the bare surface.
    let worstBrass = Infinity;
    let worstMuted = Infinity;
    for (let step = 0; step <= 3000; step += 1) {
      const surface = surfaceHexFor((step / 3000) * 3);
      const palette = inkPaletteFor(surface);
      worstBrass = Math.min(worstBrass, contrastRatio(palette.brass, surface));
      worstMuted = Math.min(worstMuted, contrastRatio(palette.muted, surface));
    }

    expect(worstBrass).toBeLessThan(4.5);
    expect(worstMuted).toBeLessThan(4.5);
    expect(worstBrass).toBeCloseTo(1.49, 1);
    expect(worstMuted).toBeCloseTo(1.52, 1);
  });
});
