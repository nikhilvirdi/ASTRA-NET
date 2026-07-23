import { create } from 'zustand';

/**
 * ASTRANET Zustand store — global app state
 *
 * Scope: auth state, active location, display mode preferences.
 * Data that belongs per-route (e.g. brief API response) lives in
 * component-local state or React Query — not here.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  /** Token stored in memory only — never localStorage. Refresh via httpOnly cookie. */
  accessToken: string;
}

export interface UserLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface AppState {
  // Auth
  user: AuthUser | null;
  /** Set after a successful login or signup response. */
  setUser: (user: AuthUser) => void;
  /** Clear auth state (logout, token expiry). */
  clearUser: () => void;

  // Location
  location: UserLocation | null;
  setLocation: (loc: UserLocation) => void;

  // Display modes
  /** Red Light Mode — §4.5. Toggleable in /settings; auto-suggested at solar < -18°. */
  redLightMode: boolean;
  toggleRedLightMode: () => void;
  setRedLightMode: (on: boolean) => void;

  // Nav state — used by PersistentNav on /explore
  navVisible: boolean;
  setNavVisible: (visible: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()((set) => ({
  // Auth — null until login/refresh
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  // Location — null until geolocation or user selects a saved location
  location: null,
  setLocation: (location) => set({ location }),

  // Red Light Mode — off by default; Phase 10 /settings toggle wires this
  redLightMode: false,
  toggleRedLightMode: () => set((s) => ({ redLightMode: !s.redLightMode })),
  setRedLightMode: (redLightMode) => set({ redLightMode }),

  // Nav visibility — true by default; /explore route manages auto-hide
  navVisible: true,
  setNavVisible: (navVisible) => set({ navVisible }),
}));
