import React from 'react';
import { useDiegeticTextStore } from './diegeticTextStore';

/**
 * DESIGN_SPEC.md §11: "An invisible DOM mirror of all diegetic text is
 * maintained for screen readers — non-negotiable, since the 3D scene is
 * otherwise entirely inaccessible."
 *
 * Rendered outside the Canvas. `sr-only` keeps it out of the visual scene;
 * aria-live announces label changes politely (never assertively — nothing in
 * the sky is an interruption-grade alert).
 */
export function DiegeticTextMirror(): React.ReactElement {
  const entries = useDiegeticTextStore((s) => s.entries);
  return (
    <div className="sr-only" aria-live="polite" aria-label="Objects in the 3D sky scene">
      {entries.map((e) => (
        <p key={e.id}>{e.text}</p>
      ))}
    </div>
  );
}
