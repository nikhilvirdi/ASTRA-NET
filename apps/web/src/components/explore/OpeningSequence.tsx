import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { DUR_REDUCED_MOTION_FADE, EASE_CINEMATIC, OPENING_SEQUENCE } from '@/lib/motion';

/**
 * DESIGN_SPEC.md §11 opening sequence — the scripted first seconds of
 * /explore, first visit only:
 *
 *   0:00  Black. A single mono line, centered: location + local time.
 *   0:04  The real night sky fades up (cinematic expo.inOut).
 *
 * Implemented as a DOM veil over the live canvas — the scene renders
 * underneath from frame one, so "the sky fades up" is literally the black
 * lifting off the real sky, not a second render path.
 *
 * The later table rows (0:12 ISS reveal, 0:20 click-rise, 0:26 tethered
 * text, 0:40 lock break) belong to the ISS workstream; their timestamps are
 * shared via OPENING_SEQUENCE in @/lib/motion so both halves run off the
 * same table.
 *
 * §7.6: under prefers-reduced-motion the whole sequence collapses to a
 * single 200ms fade. Ambient audio (§11's wind bed) is out of scope — no
 * audio asset exists anywhere in the repo (see PROGRESS.md).
 *
 * Subsequent visits: the caller checks `hasSeenOpeningSequence()` and drops
 * the user straight into the scene without mounting this at all.
 */

const VISITED_KEY = 'astranet:explore:visited';

export function hasSeenOpeningSequence(): boolean {
  try {
    return window.localStorage.getItem(VISITED_KEY) !== null;
  } catch {
    // Storage unavailable (privacy mode) — play the sequence; it degrades fine.
    return false;
  }
}

function markOpeningSequenceSeen(): void {
  try {
    window.localStorage.setItem(VISITED_KEY, new Date().toISOString());
  } catch {
    // Best effort only.
  }
}

interface OpeningSequenceProps {
  /** The single centered mono line: `34.08°N 74.80°E · 21:04 LOCAL`. */
  overlayText: string;
  /** Called once the veil has fully lifted; the caller unmounts this component. */
  onDone: () => void;
}

export function OpeningSequence({ overlayText, onDone }: OpeningSequenceProps): React.ReactElement {
  const veilRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const veil = veilRef.current;
    const line = lineRef.current;
    if (veil === null || line === null) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeline = gsap.timeline({
      onComplete: () => {
        markOpeningSequenceSeen();
        onDoneRef.current();
      },
    });

    if (reduced) {
      // §7.6 — the sequence collapses to a single 200ms fade.
      timeline.to(veil, { opacity: 0, duration: DUR_REDUCED_MOTION_FADE, ease: 'none' });
    } else {
      // 0:00 — black holds, only the mono line showing (it's in the DOM from
      // the start; a gentle settle keeps the very first painted frame from
      // popping). 0:04 — the sky fades up: veil and line lift together.
      timeline.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'none' }, 0).to(
        veil,
        {
          opacity: 0,
          duration: OPENING_SEQUENCE.skyFadeUpDuration,
          ease: EASE_CINEMATIC,
        },
        OPENING_SEQUENCE.skyFadeUpAt,
      );
    }

    return () => {
      timeline.kill();
    };
  }, []);

  // Portaled to <body>: §11's 0:00 frame is black with ONE line — the veil
  // must also cover the persistent nav (fixed, z-50, and #main-content is its
  // own stacking context in Chrome, so no in-container z-index can reach it).
  return createPortal(
    <div
      ref={veilRef}
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      <p ref={lineRef} className="type-micro text-sky-200 uppercase tracking-widest">
        {overlayText}
      </p>
    </div>,
    document.body,
  );
}
