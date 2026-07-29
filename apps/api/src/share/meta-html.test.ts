/**
 * The crawler-facing document (WORKPLAN.md Phase 11 — "OG/meta tags for
 * rich link previews", and the half of the Definition of Done that says a
 * card "previews correctly when the link is shared").
 *
 * A link preview is produced by a machine that does not run JavaScript and
 * will not come back, so the assertions here are about what is present in
 * the single response: absolute image URLs, every tag the major consumers
 * actually read, and escaping that holds when the snapshot contains the
 * quotes and angle brackets a headline can legitimately carry.
 */

import { describe, expect, it } from 'vitest';
import { composeMetaDescription, composeOgImageAlt, renderShareMetaHtml } from './meta-html.js';
import { OG_HEIGHT, OG_WIDTH } from './og-svg.js';
import { makeShareSnapshot } from './__fixtures__/snapshot.js';
import type { ShareSnapshot } from './share.schemas.js';

const SHARE_URL = 'https://astranet.example/share/Ab3-_xY9zQ7w';
const OG_IMAGE_URL = 'https://api.astranet.example/api/share/Ab3-_xY9zQ7w/og.png';

function render(snapshot: ShareSnapshot = makeShareSnapshot()): string {
  return renderShareMetaHtml({
    snapshot,
    shareUrl: SHARE_URL,
    ogImageUrl: OG_IMAGE_URL,
    ogImageWidth: OG_WIDTH,
    ogImageHeight: OG_HEIGHT,
  });
}

/** Reads a `<meta property=...>` / `<meta name=...>` content value out of the document. */
function metaContent(html: string, key: string): string | null {
  const pattern = new RegExp(
    `<meta (?:property|name)="${key.replace(/[:.]/g, '\\$&')}" content="([^"]*)"`,
  );
  return pattern.exec(html)?.[1] ?? null;
}

describe('composeMetaDescription', () => {
  it('names where, when, and the same three measurements the card shows', () => {
    expect(composeMetaDescription(makeShareSnapshot())).toBe(
      '51.51°N 0.13°W · 2026-07-17 · NEXT ISS PASS 22:14 UTC · KP FORECAST 4.0 · SOLAR WIND 429 km/s',
    );
  });

  it('falls back to location and date rather than padding with prose', () => {
    expect(composeMetaDescription(makeShareSnapshot({ facts: [] }))).toBe(
      '51.51°N 0.13°W · 2026-07-17',
    );
  });
});

describe('composeOgImageAlt', () => {
  it('describes the card for a reader who cannot see it', () => {
    expect(composeOgImageAlt(makeShareSnapshot())).toBe(
      'ASTRANET sky card for 51.51°N 0.13°W: The ISS crosses your sky at 22:14 UTC, almost directly overhead.',
    );
  });
});

describe('renderShareMetaHtml', () => {
  it('is a complete, self-contained HTML document', () => {
    const html = render();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries every Open Graph tag a preview consumer reads', () => {
    const html = render();
    expect(metaContent(html, 'og:site_name')).toBe('ASTRANET');
    expect(metaContent(html, 'og:type')).toBe('article');
    expect(metaContent(html, 'og:url')).toBe(SHARE_URL);
    expect(metaContent(html, 'og:title')).toBe(makeShareSnapshot().headline);
    expect(metaContent(html, 'og:image')).toBe(OG_IMAGE_URL);
    expect(metaContent(html, 'og:image:type')).toBe('image/png');
  });

  it('declares the image dimensions so consumers can lay out before fetching', () => {
    const html = render();
    expect(metaContent(html, 'og:image:width')).toBe('1200');
    expect(metaContent(html, 'og:image:height')).toBe('630');
  });

  it('uses an absolute image URL — relative ones are rejected by OG consumers', () => {
    const image = metaContent(render(), 'og:image');
    expect(image).toMatch(/^https?:\/\//);
  });

  it('requests the large-image Twitter card, not the small summary', () => {
    const html = render();
    expect(metaContent(html, 'twitter:card')).toBe('summary_large_image');
    expect(metaContent(html, 'twitter:image')).toBe(OG_IMAGE_URL);
  });

  it('provides alt text on both the OG and Twitter images', () => {
    const html = render();
    const alt = composeOgImageAlt(makeShareSnapshot());
    expect(metaContent(html, 'og:image:alt')).toBe(alt);
    expect(metaContent(html, 'twitter:image:alt')).toBe(alt);
  });

  it('points its canonical link at the human-facing page, not at itself', () => {
    expect(render()).toContain(`<link rel="canonical" href="${SHARE_URL}" />`);
  });

  it('forwards a human to the real page while staying readable in the meantime', () => {
    const html = render();
    expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${SHARE_URL}" />`);
    // The body is not empty — a crawler that ignores meta tags still gets text.
    expect(html).toContain(makeShareSnapshot().headline);
    expect(html).toContain(`<a href="${SHARE_URL}">`);
  });

  it('escapes a headline containing quotes and angle brackets', () => {
    // A `"` inside an unescaped content attribute would truncate the tag and
    // silently drop the rest of the preview.
    const snapshot = makeShareSnapshot({ headline: 'Kp 7 & rising — "look <north>"' });
    const html = render(snapshot);

    expect(html).not.toContain('<north>');
    expect(metaContent(html, 'og:title')).toBe(
      'Kp 7 &amp; rising — &quot;look &lt;north&gt;&quot;',
    );
    // The document is still well-formed: exactly one og:title survived.
    expect(html.match(/property="og:title"/g)?.length).toBe(1);
  });

  it('escapes the URLs it is handed rather than trusting them', () => {
    const html = renderShareMetaHtml({
      snapshot: makeShareSnapshot(),
      shareUrl: 'https://astranet.example/share/abc?a=1&b=2',
      ogImageUrl: OG_IMAGE_URL,
      ogImageWidth: OG_WIDTH,
      ogImageHeight: OG_HEIGHT,
    });
    expect(html).toContain('a=1&amp;b=2');
  });

  it('is deterministic for a frozen snapshot', () => {
    expect(render()).toBe(render());
  });

  it('renders a degraded snapshot without leaving an empty description', () => {
    const html = render(makeShareSnapshot({ facts: [] }));
    expect(metaContent(html, 'og:description')).toBe('51.51°N 0.13°W · 2026-07-17');
  });
});
