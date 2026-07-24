/**
 * Local type declarations for troika-three-text (ARCHITECTURE.md §2's locked
 * diegetic-text library). The package (0.52.x) ships no TypeScript types and
 * none exist on DefinitelyTyped, so this file declares exactly the surface
 * ASTRANET uses — no more. Extend it only when a new prop is actually needed.
 */
declare module 'troika-three-text' {
  import { Mesh, Color } from 'three';

  export class Text extends Mesh {
    /** The string to render. */
    text: string;
    /** Em-height in scene units. */
    fontSize: number;
    /** URL of a .ttf/.otf/.woff (not .woff2) font file, or null for troika's default. */
    font: string | null;
    color: string | number | Color;
    anchorX: number | 'left' | 'center' | 'right';
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom';
    textAlign: 'left' | 'right' | 'center' | 'justify';
    /** Extra spacing between characters, in em units. */
    letterSpacing: number;
    maxWidth: number;
    /** Overall fill opacity, 0–1 — the hook GSAP tweens for materialize/fade. */
    fillOpacity: number;
    /**
     * Kick off (async) glyph layout/SDF generation after prop changes.
     * Rendering before sync completes shows the previous text state.
     */
    sync(callback?: () => void): void;
    /** Release GPU resources. Call on unmount. */
    dispose(): void;
  }

  /** Warm the glyph atlas ahead of first render so text doesn't pop in late. */
  export function preloadFont(
    options: { font?: string; characters?: string },
    callback: () => void,
  ): void;
}
