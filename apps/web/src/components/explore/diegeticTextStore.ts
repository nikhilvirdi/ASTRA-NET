import { create } from 'zustand';

/**
 * Registry behind DESIGN_SPEC.md §11's accessibility mandate: "An invisible
 * DOM mirror of all diegetic text is maintained for screen readers —
 * non-negotiable." Every DiegeticText instance registers its string here;
 * DiegeticTextMirror renders the collected set as visually-hidden DOM.
 *
 * Separate from the global app store: this is /explore-scene plumbing, not
 * app state (auth/location/display modes) — same scoping rule the store's
 * own header comment sets for per-route data.
 */

export interface DiegeticEntry {
  id: number;
  text: string;
}

interface DiegeticTextState {
  entries: DiegeticEntry[];
  register: (text: string) => number;
  update: (id: number, text: string) => void;
  unregister: (id: number) => void;
}

let nextId = 1;

export const useDiegeticTextStore = create<DiegeticTextState>()((set) => ({
  entries: [],
  register: (text) => {
    const id = nextId++;
    set((s) => ({ entries: [...s.entries, { id, text }] }));
    return id;
  },
  update: (id, text) =>
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, text } : e)) })),
  unregister: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));
