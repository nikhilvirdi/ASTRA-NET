import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * ASTRANET Zustand store — global app state
 *
 * Scope: active location, Personal Sky Log entries, alert preferences,
 * display mode preferences. There is no account system: location, the
 * Sky Log, and alert toggles all live in this browser only, persisted to
 * localStorage — not on a server. Route-local data (e.g. the Brief API
 * response) stays in component-local state, not here.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface SkyLogEntryData {
  id: string;
  eventType: string;
  timestamp: string;
  notes: string | null;
  source: 'manual';
  details: {
    kp?: number;
    cloudCoverPercent?: number;
    moonPhase?: string;
  } | null;
  createdAt: string;
}

export interface UserAlertsData {
  iss_pass: boolean;
  aurora: boolean;
  meteor_shower: boolean;
  neo_approach: boolean;
}

const DEFAULT_ALERTS: UserAlertsData = {
  iss_pass: false,
  aurora: false,
  meteor_shower: false,
  neo_approach: false,
};

export interface AppState {
  // Location — a single client-side setting anyone can change, no account
  // required. Defaults to null (falls back to DEFAULT_OBSERVER_LOCATION,
  // see lib/api.ts's getEffectiveLocation) until the visitor sets one.
  location: UserLocation | null;
  setLocation: (loc: UserLocation) => void;

  // Personal Sky Log — local-only, browser storage.
  skyLogEntries: SkyLogEntryData[];
  addSkyLogEntry: (entry: { eventType: string; timestamp: string; notes?: string }) => void;
  removeSkyLogEntry: (id: string) => void;

  // Alert toggle preferences — local-only. No delivery mechanism exists
  // yet; toggles just persist the preference for future delivery.
  alerts: UserAlertsData;
  setAlerts: (alerts: Partial<UserAlertsData>) => void;

  /** Wipes location, Sky Log entries, and alert preferences from this browser. */
  clearLocalData: () => void;

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

      skyLogEntries: [],
      addSkyLogEntry: (entry) =>
        set((s) => ({
          skyLogEntries: [
            {
              id: crypto.randomUUID(),
              eventType: entry.eventType,
              timestamp: entry.timestamp,
              notes: entry.notes?.trim() ? entry.notes.trim() : null,
              source: 'manual',
              details: null,
              createdAt: new Date().toISOString(),
            },
            ...s.skyLogEntries,
          ],
        })),
      removeSkyLogEntry: (id) =>
        set((s) => ({ skyLogEntries: s.skyLogEntries.filter((e) => e.id !== id) })),

      alerts: DEFAULT_ALERTS,
      setAlerts: (alerts) => set((s) => ({ alerts: { ...s.alerts, ...alerts } })),

      clearLocalData: () => set({ location: null, skyLogEntries: [], alerts: DEFAULT_ALERTS }),

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
        skyLogEntries: state.skyLogEntries,
        alerts: state.alerts,
        redLightMode: state.redLightMode,
      }),
    },
  ),
);
