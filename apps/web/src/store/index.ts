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

export interface SavedLocationEntry {
  name: string;
  lat: number;
  lon: number;
  savedAt: string;
}

// ─── Task A: satellite category filters, Constellations persistence ──────────

/** Mirrors the api's category taxonomy (apps/api/src/poller/store.ts's SatelliteCategory) — CelesTrak/Space-Track's real category set, one source of truth for the web app. */
export type SatelliteCategory =
  'stations' | 'starlink' | 'oneweb' | 'gps' | 'weather' | 'geo' | 'cubesat' | 'debris' | 'hubble';

export const SATELLITE_CATEGORIES: readonly SatelliteCategory[] = [
  'stations',
  'starlink',
  'oneweb',
  'gps',
  'weather',
  'geo',
  'cubesat',
  'debris',
  'hubble',
];

export const SATELLITE_CATEGORY_LABELS: Record<SatelliteCategory, string> = {
  stations: 'Stations',
  starlink: 'Starlink',
  oneweb: 'OneWeb',
  gps: 'GPS',
  weather: 'Weather',
  geo: 'Geo',
  cubesat: 'CubeSat',
  debris: 'Debris',
  hubble: 'Hubble',
};

/** Every category visible by default — a category never explicitly toggled off stays visible. */
function defaultSatelliteCategoryVisibility(): Record<SatelliteCategory, boolean> {
  return {
    stations: true,
    starlink: true,
    oneweb: true,
    gps: true,
    weather: true,
    geo: true,
    cubesat: true,
    debris: true,
    hubble: true,
  };
}

// ─── Task B: reduced-motion override, default landing page ───────────────────

/** 'system' follows the OS prefers-reduced-motion media query (today's only behavior); 'on'/'off' force it either way. */
export type ReducedMotionPreference = 'system' | 'on' | 'off';

/** Which page the site's root ('/') shows on the first load of a session. Does not affect direct navigation to '/' or '/explore' afterward. */
export type DefaultLandingPage = 'home' | 'explore';

export interface AppState {
  // Location — a single client-side setting anyone can change, no account
  // required. Defaults to null (falls back to DEFAULT_OBSERVER_LOCATION,
  // see lib/api.ts's getEffectiveLocation) until the visitor sets one.
  location: UserLocation | null;
  setLocation: (loc: UserLocation) => void;

  /** Location history list capped at 10 entries (oldest dropped). */
  locationHistory: SavedLocationEntry[];
  saveLocationToHistory: (name: string, lat: number, lon: number) => void;
  removeLocationFromHistory: (name: string) => void;

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

  // ── Task A: Explore overlay persistence ──────────────────────────────────
  /** Per-category satellite visibility in Explore. Any category never explicitly set defaults to visible (true). */
  satelliteCategoryVisibility: Record<SatelliteCategory, boolean>;
  setSatelliteCategoryVisible: (category: SatelliteCategory, visible: boolean) => void;

  /** Constellation lines overlay in Explore — moved from local component state (ExplorePage.tsx) so the choice persists across visits. Default: true. */
  constellationsVisible: boolean;
  setConstellationsVisible: (visible: boolean) => void;

  // ── Task B: motion & landing-page preferences ────────────────────────────
  /** Overrides the OS prefers-reduced-motion signal for Explore's camera cinematics (CameraController.tsx). Default: 'system' — unchanged behavior until a visitor opts in. */
  reducedMotion: ReducedMotionPreference;
  setReducedMotion: (pref: ReducedMotionPreference) => void;

  /** Which page loads at the site's root ('/') on the first load of a session. Default: 'home' — unchanged behavior. */
  defaultLandingPage: DefaultLandingPage;
  setDefaultLandingPage: (page: DefaultLandingPage) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),

      locationHistory: [],
      saveLocationToHistory: (name, lat, lon) =>
        set((state) => {
          const trimmedName = name.trim();
          const finalName =
            trimmedName ||
            `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
          const newEntry: SavedLocationEntry = {
            name: finalName,
            lat,
            lon,
            savedAt: new Date().toISOString(),
          };

          const existingIndex = state.locationHistory.findIndex(
            (item) => item.name.trim().toLowerCase() === finalName.toLowerCase(),
          );

          let nextHistory: SavedLocationEntry[];
          if (existingIndex >= 0) {
            nextHistory = [...state.locationHistory];
            nextHistory[existingIndex] = newEntry;
          } else {
            nextHistory = [...state.locationHistory, newEntry];
            if (nextHistory.length > 10) {
              nextHistory = nextHistory.slice(nextHistory.length - 10);
            }
          }

          return { locationHistory: nextHistory };
        }),

      removeLocationFromHistory: (name) =>
        set((state) => ({
          locationHistory: state.locationHistory.filter(
            (item) => item.name.trim().toLowerCase() !== name.trim().toLowerCase(),
          ),
        })),

      clearLocalData: () =>
        set({
          location: null,
          locationHistory: [],
          timeFormat: '24h',
          units: 'metric',
          // Task A
          satelliteCategoryVisibility: defaultSatelliteCategoryVisibility(),
          constellationsVisible: true,
          // Task B
          reducedMotion: 'system',
          defaultLandingPage: 'home',
        }),

      timeFormat: '24h',
      setTimeFormat: (timeFormat) => set({ timeFormat }),

      units: 'metric',
      setUnits: (units) => set({ units }),

      redLightMode: false,
      toggleRedLightMode: () => set((s) => ({ redLightMode: !s.redLightMode })),
      setRedLightMode: (redLightMode) => set({ redLightMode }),

      navVisible: true,
      setNavVisible: (navVisible) => set({ navVisible }),

      // ── Task A: Explore overlay persistence ──────────────────────────────
      satelliteCategoryVisibility: defaultSatelliteCategoryVisibility(),
      setSatelliteCategoryVisible: (category, visible) =>
        set((state) => ({
          satelliteCategoryVisibility: {
            ...state.satelliteCategoryVisibility,
            [category]: visible,
          },
        })),

      constellationsVisible: true,
      setConstellationsVisible: (constellationsVisible) => set({ constellationsVisible }),

      // ── Task B: motion & landing-page preferences ────────────────────────
      reducedMotion: 'system',
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),

      defaultLandingPage: 'home',
      setDefaultLandingPage: (defaultLandingPage) => set({ defaultLandingPage }),
    }),
    {
      name: 'astranet-store',
      // `navVisible` is session-only UI state — persisting it would mean
      // reloading mid-auto-hide restores a stale hidden nav.
      partialize: (state) => ({
        location: state.location,
        locationHistory: state.locationHistory,
        redLightMode: state.redLightMode,
        timeFormat: state.timeFormat,
        units: state.units,
        // Task A
        satelliteCategoryVisibility: state.satelliteCategoryVisibility,
        constellationsVisible: state.constellationsVisible,
        // Task B
        reducedMotion: state.reducedMotion,
        defaultLandingPage: state.defaultLandingPage,
      }),
    },
  ),
);
