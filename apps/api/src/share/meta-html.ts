/**
 * The crawler-facing HTML document for a shared card (WORKPLAN.md Phase 11
 * — "OG/meta tags for rich link previews").
 *
 * Why the backend serves HTML at all: `apps/web` is a Vite SPA deployed to
 * Cloudflare Pages (ARCHITECTURE.md §9), which serves one static
 * `index.html` for every route. Link-preview crawlers do not execute
 * JavaScript, so per-share `og:` tags injected by React are never seen —
 * the tags have to exist in a server response or the phase's Definition of
 * Done ("previews correctly when the link is shared") cannot hold.
 *
 * This document is therefore self-contained and static: every tag is
 * filled from the frozen snapshot, with no live fetch at view time. A
 * human who lands here (crawlers are not reliably distinguishable, so this
 * never tries) is forwarded to the real `/share/:id` page in `apps/web` by
 * a meta refresh plus a canonical link, and gets a readable fallback in
 * the meantime.
 *
 * Pointing crawlers at this URL is a deployment step (a Pages redirect or
 * middleware rule), not something this route can do for itself — flagged
 * in PROGRESS.md for Phase 12.
 */

import { escapeXml } from './og-svg.js';
import type { ShareSnapshot } from './share.schemas.js';

export interface ShareMetaHtmlParams {
  snapshot: ShareSnapshot;
  /** Absolute URL of the human-facing `apps/web` page. */
  shareUrl: string;
  /** Absolute URL of the 1200x630 PNG. OG consumers reject relative image URLs. */
  ogImageUrl: string;
  ogImageWidth: number;
  ogImageHeight: number;
}

const SITE_NAME = 'ASTRANET';

/**
 * One line of plain description, built from the same three measurements
 * the card shows. Falls back to the observer label alone rather than
 * padding with prose that claims more than the snapshot holds.
 */
export function composeMetaDescription(snapshot: ShareSnapshot): string {
  const captured = new Date(snapshot.capturedAt);
  const when = captured.toISOString().slice(0, 10);
  const where = `${snapshot.observer.label} · ${when}`;
  if (snapshot.facts.length === 0) return where;
  const facts = snapshot.facts.map((fact) => `${fact.label} ${fact.value}`).join(' · ');
  return `${where} · ${facts}`;
}

/** Alt text for the card image — Part VI's accessibility floor applies to shared links too. */
export function composeOgImageAlt(snapshot: ShareSnapshot): string {
  return `${SITE_NAME} sky card for ${snapshot.observer.label}: ${snapshot.headline}`;
}

export function renderShareMetaHtml({
  snapshot,
  shareUrl,
  ogImageUrl,
  ogImageWidth,
  ogImageHeight,
}: ShareMetaHtmlParams): string {
  const title = escapeXml(snapshot.headline);
  const description = escapeXml(composeMetaDescription(snapshot));
  const alt = escapeXml(composeOgImageAlt(snapshot));
  const image = escapeXml(ogImageUrl);
  const url = escapeXml(shareUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — ${SITE_NAME}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${ogImageWidth}" />
    <meta property="og:image:height" content="${ogImageHeight}" />
    <meta property="og:image:alt" content="${alt}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${alt}" />

    <meta http-equiv="refresh" content="0; url=${url}" />
  </head>
  <body>
    <p>${title}</p>
    <p>${description}</p>
    <p><a href="${url}">See this sky card on ${SITE_NAME}</a></p>
  </body>
</html>
`;
}
