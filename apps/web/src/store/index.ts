import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * ASTRANET Zustand store — global app state
 *
 * Scope: active location, display mode preferences.
 * There is no account system: location lives in this browser only, persisted
 * to localStorage — not on a server. Route-local data (e.g. the Brief API
 * response) stays in component-local state, not here.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface AppState {
  // Location — a single client-side setting anyone can change, no account
  // required. Defaults to null (falls back to DEFAULT_OBSERVER_LOCATION,
  // see lib/api.ts's getEffectiveLocation) until the visitor sets one.
  location: UserLocation | null;
  setLocation: (loc: UserLocation) => void;

  /** Wipes location preferences from this browser. */
  clearLocalData: () => void;

  // Preferences
  /** Time Format — 12-hour vs 24-hour display. Default: '24h'. */
  timeFormat: '12h' | '24h';
  setTimeFormat: (timeFormat: '12h' | '24h') => void;

  /** Units — Metric vs Imperial measurement system. Default: 'metric'. */
  units: 'metric' | 'imperial';
  setUnits: (units: 'metric' | 'imperial') => void;

  // Display modes
  /** Red Light Mode — §4.5. Toggleable in /settings; auto-suggested at solar < -18°. */
  redLightMode: boolean;
  toggleRedLightMode: () => void;
  setRedLightMode: (on: boolean) => void;

  // Nav state — used by PersistentNav on /explore. Session-only, not persisted.
  navVisible: boolean;
  setNavVisible: (visible: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),

      clearLocalData: () => set({ location: null, timeFormat: '24h', units: 'metric' }),

      timeFormat: '24h',
      setTimeFormat: (timeFormat) => set({ timeFormat }),

      units: 'metric',
      setUnits: (units) => set({ units }),

      redLightMode: false,
      toggleRedLightMode: () => set((s) => ({ redLightMode: !s.redLightMode })),
      setRedLightMode: (redLightMode) => set({ redLightMode }),

      navVisible: true,
      setNavVisible: (navVisible) => set({ navVisible }),
    }),
    {
      name: 'astranet-store',
      // `navVisible` is session-only UI state — persisting it would mean
      // reloading mid-auto-hide restores a stale hidden nav.
      partialize: (state) => ({
        location: state.location,
        redLightMode: state.redLightMode,
        timeFormat: state.timeFormat,
        units: state.units,
      }),
    },
  ),
);
