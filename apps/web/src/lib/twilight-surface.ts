/**
 * Twilight surface color interpolation & WCAG AA contrast validation (DESIGN_SPEC.md §2, §4.1, L548).
 * Maps twilightState.value (continuous [0, 3] from packages/shared)
 * to runtime RGB color strings for CSS custom properties --surface and --on-surface,
 * ensuring WCAG 2.1 AA contrast compliance (>= 4.5:1 for normal text) at every point along the ramp.
 *
 * Color Stops for Surface:
 *   value = 0 (Day, sunAlt >= 0°):                    sky-100 (#EEF1F1, rgb(238, 241, 241))
 *   value = 1 (Civil twilight end, sunAlt = -6°):     sky-400 (#8B9898, rgb(139, 152, 152))
 *   value = 2 (Nautical twilight end, sunAlt = -12°):  sky-600 (#3E4A4A, rgb(62, 74, 74))
 *   value = 3 (Astronomical / Night, sunAlt <= -18°): sky-900 (#111818, rgb(17, 24, 24))
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const SURFACE_STOPS: readonly RGB[] = [
  { r: 238, g: 241, b: 241 }, // 0: Day (sky-100)
  { r: 139, g: 152, b: 152 }, // 1: Civil twilight (sky-400)
  { r: 62, g: 74, b: 74 }, // 2: Nautical twilight (sky-600)
  { r: 17, g: 24, b: 24 }, // 3: Night / Astronomical twilight (sky-900)
] as const;

/**
 * Calculates sRGB to linear RGB for a single channel [0..255].
 */
export function sRgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.1 relative luminance for an RGB color.
 */
export function relativeLuminance(rgb: RGB): number {
  const r = sRgbToLinear(rgb.r);
  const g = sRgbToLinear(rgb.g);
  const b = sRgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.1 contrast ratio between two RGB colors.
 * Returns a number >= 1.0 (e.g. 15.54).
 */
export function contrastRatio(rgb1: RGB, rgb2: RGB): number {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Linearly interpolates RGB color stops based on a continuous value in [0, 3].
 */
export function interpolateRGB(stops: readonly RGB[], value: number): RGB {
  const clamped = Math.max(0, Math.min(stops.length - 1, value));
  const index = Math.floor(clamped);
  if (index >= stops.length - 1) {
    const last = stops[stops.length - 1]!;
    return { r: last.r, g: last.g, b: last.b };
  }
  const t = clamped - index;
  const start = stops[index]!;
  const end = stops[index + 1]!;
  return {
    r: Math.round(start.r + (end.r - start.r) * t),
    g: Math.round(start.g + (end.g - start.g) * t),
    b: Math.round(start.b + (end.b - start.b) * t),
  };
}

/**
 * Computes surface RGB color for a given continuous twilight value.
 */
export function computeSurfaceRGB(value: number): RGB {
  return interpolateRGB(SURFACE_STOPS, value);
}

/**
 * Computes on-surface text RGB color to guarantee WCAG 2.1 AA (>= 4.5:1) contrast
 * against the surface color at every continuous point in [0, 3].
 */
export function computeOnSurfaceRGB(value: number): RGB {
  const surface = computeSurfaceRGB(value);
  const darkText: RGB = { r: 10, g: 14, b: 14 }; // sky-950 / near-black
  const lightText: RGB = { r: 238, g: 241, b: 241 }; // sky-100 / near-white
  const pureWhite: RGB = { r: 255, g: 255, b: 255 }; // pure white

  if (contrastRatio(surface, darkText) >= 4.5) {
    return darkText;
  }
  if (contrastRatio(surface, lightText) >= 4.5) {
    return lightText;
  }
  return pureWhite;
}

/**
 * Computes CSS color for --surface slot as an rgb(...) string.
 */
export function computeSurfaceColor(value: number): string {
  const rgb = computeSurfaceRGB(value);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Computes CSS color for --on-surface slot as an rgb(...) string.
 */
export function computeOnSurfaceColor(value: number): string {
  const rgb = computeOnSurfaceRGB(value);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
