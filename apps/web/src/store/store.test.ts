import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, SATELLITE_CATEGORIES } from './index';

describe('useAppStore - Location History', () => {
  beforeEach(() => {
    useAppStore.getState().clearLocalData();
  });

  it('saves a new location to history', () => {
    const store = useAppStore.getState();
    store.saveLocationToHistory('Mauna Kea', 19.8206, -155.4681);

    const history = useAppStore.getState().locationHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.name).toBe('Mauna Kea');
    expect(history[0]?.lat).toBe(19.8206);
    expect(history[0]?.lon).toBe(-155.4681);
    expect(history[0]?.savedAt).toBeDefined();
  });

  it('overwrites an existing location when the name matches case-insensitively', () => {
    const store = useAppStore.getState();
    store.saveLocationToHistory('Home Base', 40.7128, -74.006);
    store.saveLocationToHistory('home base', 41.0, -73.5);

    const history = useAppStore.getState().locationHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.name).toBe('home base');
    expect(history[0]?.lat).toBe(41.0);
    expect(history[0]?.lon).toBe(-73.5);
  });

  it('falls back to formatted coordinates if name is blank', () => {
    const store = useAppStore.getState();
    store.saveLocationToHistory('   ', 28.614, 77.209);

    const history = useAppStore.getState().locationHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.name).toBe('28.6140°N, 77.2090°E');
    expect(history[0]?.lat).toBe(28.614);
    expect(history[0]?.lon).toBe(77.209);
  });

  it('caps history at 10 entries and drops the oldest entry', () => {
    const store = useAppStore.getState();

    // Add 10 distinct locations
    for (let i = 1; i <= 10; i++) {
      store.saveLocationToHistory(`Location ${i}`, 10 + i, 20 + i);
    }

    let history = useAppStore.getState().locationHistory;
    expect(history).toHaveLength(10);
    expect(history[0]?.name).toBe('Location 1');
    expect(history[9]?.name).toBe('Location 10');

    // Add 11th location — Location 1 (the oldest) should be dropped
    store.saveLocationToHistory('Location 11', 35, 45);

    history = useAppStore.getState().locationHistory;
    expect(history).toHaveLength(10);
    expect(history[0]?.name).toBe('Location 2');
    expect(history[9]?.name).toBe('Location 11');
    expect(history.find((loc) => loc.name === 'Location 1')).toBeUndefined();
  });

  it('removes a location by name', () => {
    const store = useAppStore.getState();
    store.saveLocationToHistory('Location A', 10, 10);
    store.saveLocationToHistory('Location B', 20, 20);

    expect(useAppStore.getState().locationHistory).toHaveLength(2);

    store.removeLocationFromHistory('location a');

    const history = useAppStore.getState().locationHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.name).toBe('Location B');
  });

  it('resets location history on clearLocalData', () => {
    const store = useAppStore.getState();
    store.saveLocationToHistory('Test Loc', 12, 34);
    expect(useAppStore.getState().locationHistory).toHaveLength(1);

    store.clearLocalData();
    expect(useAppStore.getState().locationHistory).toHaveLength(0);
    expect(useAppStore.getState().location).toBeNull();
  });
});

describe('useAppStore — Task A: satellite category filters, Constellations', () => {
  beforeEach(() => {
    useAppStore.getState().clearLocalData();
  });

  it('defaults every satellite category to visible', () => {
    const visibility = useAppStore.getState().satelliteCategoryVisibility;
    for (const category of SATELLITE_CATEGORIES) {
      expect(visibility[category], `${category} should default true`).toBe(true);
    }
  });

  it('covers all 9 real categories, no more, no fewer', () => {
    expect(SATELLITE_CATEGORIES).toHaveLength(9);
    expect(Object.keys(useAppStore.getState().satelliteCategoryVisibility).sort()).toEqual(
      [...SATELLITE_CATEGORIES].sort(),
    );
  });

  it('toggles one category off without affecting the others', () => {
    useAppStore.getState().setSatelliteCategoryVisible('starlink', false);

    const visibility = useAppStore.getState().satelliteCategoryVisibility;
    expect(visibility.starlink).toBe(false);
    for (const category of SATELLITE_CATEGORIES) {
      if (category === 'starlink') continue;
      expect(visibility[category]).toBe(true);
    }
  });

  it('toggles a category back on', () => {
    const store = useAppStore.getState();
    store.setSatelliteCategoryVisible('debris', false);
    expect(useAppStore.getState().satelliteCategoryVisibility.debris).toBe(false);

    store.setSatelliteCategoryVisible('debris', true);
    expect(useAppStore.getState().satelliteCategoryVisibility.debris).toBe(true);
  });

  it('defaults constellationsVisible to true', () => {
    expect(useAppStore.getState().constellationsVisible).toBe(true);
  });

  it('toggles constellationsVisible', () => {
    useAppStore.getState().setConstellationsVisible(false);
    expect(useAppStore.getState().constellationsVisible).toBe(false);

    useAppStore.getState().setConstellationsVisible(true);
    expect(useAppStore.getState().constellationsVisible).toBe(true);
  });

  it('resets both fields on clearLocalData', () => {
    const store = useAppStore.getState();
    store.setSatelliteCategoryVisible('hubble', false);
    store.setConstellationsVisible(false);

    store.clearLocalData();

    expect(useAppStore.getState().satelliteCategoryVisibility.hubble).toBe(true);
    expect(useAppStore.getState().constellationsVisible).toBe(true);
  });
});

describe('useAppStore — Task B: reduced motion override, default landing page', () => {
  beforeEach(() => {
    useAppStore.getState().clearLocalData();
  });

  it('defaults reducedMotion to "system"', () => {
    expect(useAppStore.getState().reducedMotion).toBe('system');
  });

  it('sets reducedMotion to each valid value', () => {
    const store = useAppStore.getState();
    store.setReducedMotion('on');
    expect(useAppStore.getState().reducedMotion).toBe('on');

    store.setReducedMotion('off');
    expect(useAppStore.getState().reducedMotion).toBe('off');

    store.setReducedMotion('system');
    expect(useAppStore.getState().reducedMotion).toBe('system');
  });

  it('defaults defaultLandingPage to "home"', () => {
    expect(useAppStore.getState().defaultLandingPage).toBe('home');
  });

  it('sets defaultLandingPage to "explore" and back', () => {
    const store = useAppStore.getState();
    store.setDefaultLandingPage('explore');
    expect(useAppStore.getState().defaultLandingPage).toBe('explore');

    store.setDefaultLandingPage('home');
    expect(useAppStore.getState().defaultLandingPage).toBe('home');
  });

  it('resets both fields on clearLocalData', () => {
    const store = useAppStore.getState();
    store.setReducedMotion('on');
    store.setDefaultLandingPage('explore');

    store.clearLocalData();

    expect(useAppStore.getState().reducedMotion).toBe('system');
    expect(useAppStore.getState().defaultLandingPage).toBe('home');
  });
});
