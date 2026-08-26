import React, { useEffect, useMemo, useRef } from 'react';
import { Text as TroikaText } from 'troika-three-text';
import gsap from 'gsap';
import { DUR_REDUCED_MOTION_FADE, DUR_TRANSITION, EASE_TRANSITION } from '@/lib/motion';
import { cssColorToken } from '@/lib/color';
import { useDiegeticTextStore } from './diegeticTextStore';

/**
 * In-scene text (WORKPLAN Phase 8: "Diegetic text (troika-three-text) with
 * accessible DOM mirror"). Wraps a troika Text mesh for R3F, keeps the §11
 * DOM mirror in sync via the diegetic registry, and materializes per §7.1's
 * transition class (expo.out — labels are reveals, not camera moves).
 *
 * Typography: Martian Mono (the design system's mono face), self-hosted in
 * /fonts because troika parses the font file itself and can't consume the
 * Google Fonts woff2 pipeline the DOM uses.
 */

/** Self-hosted static TTF — same face the DOM loads from Google Fonts. */
export const DIEGETIC_FONT_URL = '/fonts/MartianMono-Regular.ttf';
export const JOST_BOLD_FONT_URL = '/fonts/Jost-Bold.ttf';

interface DiegeticTextProps {
  text: string;
  /** Position on/near the sky dome, scene units. */
  position: [number, number, number];
  /** Em-height in scene units. */
  fontSize: number;
  /** Custom font URL override (defaults to DIEGETIC_FONT_URL). */
  fontUrl?: string;
  /** CSS token name; defaults to the mono-label brass. */
  colorToken?: string;
  /** Fallback hex for the token (non-browser environments). */
  colorFallback?: string;
  /** Extra letter-spacing in em — mono micro labels are widely tracked (§3). */
  letterSpacing?: number;
  /** Peak fill opacity once materialized. */
  opacity?: number;
}

export function DiegeticText({
  text,
  position,
  fontSize,
  fontUrl = DIEGETIC_FONT_URL,
  colorToken = '--color-brass-300',
  colorFallback = '#c9b187',
  letterSpacing = 0.08,
  opacity = 1,
}: DiegeticTextProps): React.ReactElement {
  const mesh = useMemo(() => new TroikaText(), []);
  const registryId = useRef<number | null>(null);

  // Configure + lay out the troika mesh. sync() is async; troika renders the
  // previous layout until the new one is ready, so there's no flash.
  useEffect(() => {
    mesh.text = text;
    mesh.font = fontUrl;
    mesh.fontSize = fontSize;
    mesh.color = cssColorToken(colorToken, colorFallback);
    mesh.anchorX = 'center';
    mesh.anchorY = 'middle';
    mesh.textAlign = 'center';
    mesh.letterSpacing = letterSpacing;
    mesh.position.set(position[0], position[1], position[2]);
    // Face the observer at the origin (+Z toward target for non-camera objects).
    mesh.lookAt(0, 0, 0);
    mesh.sync();
    // Depend on the individual coordinates, not the `position` array itself:
    // every caller passes an inline `[x, y, z]` literal, a fresh reference on
    // every render. CelestialMarkers re-renders every animation frame (its
    // useFrame reports screen positions upward), so depending on the array
    // reference re-ran this effect — and troika's mesh.sync() — 60x/sec per
    // label, pegging the main thread until the tab stopped responding.
  }, [
    mesh,
    text,
    fontSize,
    fontUrl,
    colorToken,
    colorFallback,
    letterSpacing,
    position[0],
    position[1],
    position[2],
  ]);

  // Materialize (§7.1 transition; §7.6 reduced-motion collapse).
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mesh.fillOpacity = 0;
    const tween = gsap.to(mesh, {
      fillOpacity: opacity,
      duration: reduced ? DUR_REDUCED_MOTION_FADE : DUR_TRANSITION,
      ease: EASE_TRANSITION,
    });
    return () => {
      tween.kill();
    };
  }, [mesh, opacity]);

  // §11 DOM mirror registration — text changes update the same entry.
  useEffect(() => {
    const store = useDiegeticTextStore.getState();
    if (registryId.current === null) {
      registryId.current = store.register(text);
    } else {
      store.update(registryId.current, text);
    }
  }, [text]);
  useEffect(
    () => () => {
      if (registryId.current !== null) {
        useDiegeticTextStore.getState().unregister(registryId.current);
        registryId.current = null;
      }
    },
    [],
  );

  useEffect(
    () => () => {
      mesh.dispose();
    },
    [mesh],
  );

  return <primitive object={mesh} />;
}
