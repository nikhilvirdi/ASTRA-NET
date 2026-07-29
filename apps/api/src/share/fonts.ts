/**
 * The three font files the server-rendered OG card needs (DESIGN_SPEC.md
 * §5.2), resolved once and memoised for the process lifetime.
 *
 * DESIGN_SPEC.md §5.1's rule — "Words are proportional. Measurements are
 * monospaced. Always, everywhere, without exception." — is a rule about
 * meaning, so it has to hold in the OG image too, which means the renderer
 * needs both faces as real files. `apps/web/index.html` loads them from the
 * Google Fonts CDN, but a server render cannot depend on a CDN at request
 * time, so the proportional face is vendored into the repo.
 *
 * Where each file lives, and why they differ:
 *
 * - **Martian Mono** is read from `apps/web/public/fonts/`, where it
 *   already sits because the 3D scene's diegetic text (troika) self-hosts
 *   it. Same "read it where it already lives rather than duplicate a
 *   binary into apps/api" precedent as `light-pollution.client.ts`.
 * - **Archivo** (Regular 400 + SemiBold 600, the weights `index.css` uses
 *   for body and `type-display-l`) is vendored under `apps/api/assets/`
 *   because nothing in `apps/web` reads it — the browser gets it from the
 *   CDN. Static instances, not the variable font: resvg renders a variable
 *   font's default instance only, which would silently flatten the
 *   §5.3 display weight of 600 to 400.
 *
 * Both relative paths resolve identically from `src/` and the compiled
 * `dist/`, since `src/share` and `dist/share` sit at the same depth.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFontMetrics, type FontMetrics } from './font-metrics.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Proportional face — DESIGN_SPEC.md §5.2 "Interface & display". */
export const ARCHIVO_REGULAR_PATH = path.join(
  HERE,
  '..',
  '..',
  'assets',
  'fonts',
  'Archivo-Regular.ttf',
);
export const ARCHIVO_SEMIBOLD_PATH = path.join(
  HERE,
  '..',
  '..',
  'assets',
  'fonts',
  'Archivo-SemiBold.ttf',
);
/** Monospaced face — DESIGN_SPEC.md §5.2 "Measurement". */
export const MARTIAN_MONO_PATH = path.join(
  HERE,
  '..',
  '..',
  '..',
  'web',
  'public',
  'fonts',
  'MartianMono-Regular.ttf',
);

/** The `font-family` names the composed SVG refers to. */
export const PROPORTIONAL_FAMILY = 'Archivo';
export const MONO_FAMILY = 'Martian Mono';

export interface ShareCardFonts {
  /** Every face resvg must load to rasterize the card. */
  fontFiles: string[];
  /** Metrics for layout, keyed by the role the composer asks for. */
  proportionalRegular: FontMetrics;
  proportionalSemiBold: FontMetrics;
  mono: FontMetrics;
}

let cached: ShareCardFonts | null = null;

/**
 * Loads and memoises the faces. Parsing three ~110 KB files on every
 * share render would be wasted work: the files are immutable build
 * artifacts, so one parse per process is correct.
 */
export function loadShareCardFonts(): ShareCardFonts {
  if (cached !== null) return cached;
  cached = {
    fontFiles: [ARCHIVO_REGULAR_PATH, ARCHIVO_SEMIBOLD_PATH, MARTIAN_MONO_PATH],
    proportionalRegular: parseFontMetrics(ARCHIVO_REGULAR_PATH),
    proportionalSemiBold: parseFontMetrics(ARCHIVO_SEMIBOLD_PATH),
    mono: parseFontMetrics(MARTIAN_MONO_PATH),
  };
  return cached;
}
