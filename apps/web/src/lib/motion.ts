/**
 * ASTRANET Motion Constants — GSAP-side tokens
 *
 * DESIGN_SPEC.md §7.1 names specific GSAP easing functions deliberately.
 * GSAP is the locked animation library (ARCHITECTURE.md §2).
 *
 * Consumer split (per DECISIONS.md 2026-07-23):
 *
 *   Micro (120–180ms, ease-out):
 *     → CSS only. Use transition-duration-micro + ease-micro utility classes.
 *     → GSAP is not involved — hover/focus states are pure CSS.
 *
 *   Transition (320–480ms, expo.out):
 *     → EASE_TRANSITION: pass to GSAP's `ease:` property directly.
 *     → GSAP resolves "expo.out" through its own easing engine — never approximate.
 *
 *   Cinematic (800–1600ms, expo.inOut):
 *     → EASE_CINEMATIC: pass to GSAP's `ease:` property directly.
 *     → GSAP resolves "expo.inOut" — sharper acceleration/deceleration than a
 *       standard ease. No CSS bezier approximation defined intentionally.
 *
 *   Ambient (4–20s, sine.inOut, looping):
 *     → OPEN QUESTION for Phase 8: CSS animation vs. GSAP.timeline().repeat(-1)?
 *     → Both this constant and the CSS --ease-sine-in-out custom property are defined;
 *       whoever builds the actual ambient effect (Phase 8) decides which to use and
 *       should update DECISIONS.md with the rationale.
 *
 * Usage:
 *   import { EASE_TRANSITION, DUR_TRANSITION } from '@/lib/motion';
 *   gsap.to(el, { duration: DUR_TRANSITION, ease: EASE_TRANSITION, ... });
 */

/** GSAP ease name strings — pass directly to ease: */
export const EASE_TRANSITION = 'expo.out';
export const EASE_CINEMATIC = 'expo.inOut';
/**
 * Ambient easing — OPEN: Phase 8 to decide GSAP vs CSS.
 * The string form is provided here; the CSS approximation is in tokens.css.
 * Reference: GSAP's sine.inOut, equivalent to CSS cubic-bezier(0.37, 0, 0.63, 1).
 */
export const EASE_AMBIENT = 'sine.inOut';

/** Duration values in seconds — GSAP uses seconds, not ms */
export const DUR_MICRO = 0.15; // 150ms — midpoint of 120–180ms spec range
export const DUR_TRANSITION = 0.4; // 400ms — midpoint of 320–480ms spec range
export const DUR_CINEMATIC = 1.2; // 1200ms — midpoint of 800–1600ms spec range
export const DUR_AMBIENT_MIN = 4; // 4s — spec lower bound
export const DUR_AMBIENT_MAX = 20; // 20s — spec upper bound

/** Duration values in milliseconds — for CSS/React use */
export const DUR_MICRO_MS = 150;
export const DUR_TRANSITION_MS = 400;
export const DUR_CINEMATIC_MS = 1200;

/**
 * Page-load sequence timing offsets (§7.5)
 * "A single orchestrated sequence, not scattered fades."
 *
 * 0–400ms:   Surface resolves to correct twilight color. Nothing else.
 * 300–900ms: Horizon Band draws itself L→R.
 * 600ms:     Headline sets in one motion.
 * 800ms+:    Entries reveal in 60ms stagger, lifting 8px with opacity.
 * 1200ms:    Margin-track provenance fades in last, at 60% opacity.
 */
/**
 * §11 Opening sequence — the first 45 seconds of /explore, first visit only.
 * Timestamps in seconds from sequence start, straight from §11's table.
 * Only the 0:20 orbit rise carries a stated duration/ease (1.6s, expo.inOut);
 * everything else animating inside the sequence uses the §7.1 class that
 * fits it (sky fade-up = cinematic).
 *
 * The ISS steps (0:12 reveal, 0:20 click-rise, 0:26 tethered text) are
 * consumed by the ISS click workstream — the constants live here so both
 * halves of the sequence run off one copy of the table, not two.
 */
export const OPENING_SEQUENCE = {
  /** 0:00 — black; a single centered mono location line. */
  blackAt: 0,
  /** 0:04 — the user's real night sky fades up. */
  skyFadeUpAt: 4,
  /** Fade-up length: §11 states none; cinematic upper bound (§7.1, 800–1600ms). */
  skyFadeUpDuration: 1.6,
  /** 0:12 — one point of light (ISS) begins moving; cursor gravity biases toward it. */
  issRevealAt: 12,
  /** 0:20 on click — "a long expo.inOut rise from ground to orbit, 1.6s" (stated). */
  orbitRiseDuration: 1.6,
  orbitRiseEase: EASE_CINEMATIC,
  /** 0:26 — diegetic text materializes on a tether from the station. */
  diegeticTextAt: 26,
  /** 0:40 — the user drags; camera breaks lock; control is theirs. */
  lockBreakAt: 40,
} as const;

/** §7.6 — under prefers-reduced-motion, load/opening sequences collapse to a single 200ms fade. */
export const DUR_REDUCED_MOTION_FADE = 0.2;

export const PAGE_LOAD = {
  surfaceStart: 0,
  surfaceEnd: 0.4,
  horizonStart: 0.3,
  horizonEnd: 0.9,
  headlineAt: 0.6,
  entriesStart: 0.8,
  entriesStagger: 0.06, // 60ms per entry
  entriesLift: 8, // px
  provenanceAt: 1.2,
  provenanceOpacity: 0.6,
  totalDuration: 1.5,
} as const;
