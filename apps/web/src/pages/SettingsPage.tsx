import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import {
  createSavedLocation,
  deleteAccount,
  deleteSavedLocation,
  fetchLocations,
  fetchSettings,
  setDefaultLocation,
  updateAlertSettings,
  type SavedLocationData,
  type UserAlertsData,
} from '@/lib/api';

/** SettingsPage — /settings · User Preferences & Controls · Phase 10 · DESIGN_SPEC.md §15 */
export function SettingsPage(): React.ReactElement {
  const setStoreLocation = useAppStore((s) => s.setLocation);

  const [alerts, setAlerts] = useState<UserAlertsData>({
    iss_pass: false,
    aurora: false,
    meteor_shower: false,
    neo_approach: false,
  });
  const [alertsDeliverable, setAlertsDeliverable] = useState<boolean>(false);
  const [locations, setLocations] = useState<SavedLocationData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthed, setIsUnauthed] = useState<boolean>(false);

  // New location form state
  const [newLabel, setNewLabel] = useState<string>('');
  const [newLat, setNewLat] = useState<string>('');
  const [newLon, setNewLon] = useState<string>('');
  const [addingLoc, setAddingLoc] = useState<boolean>(false);

  // Delete account confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);

  const loadData = (): void => {
    setLoading(true);
    setError(null);
    setIsUnauthed(false);

    Promise.all([fetchSettings(), fetchLocations()])
      .then(([settingsData, locationsData]) => {
        setAlerts(settingsData.alerts);
        setAlertsDeliverable(settingsData.alertsDeliverable);
        setLocations(locationsData);

        // Sync active store location with default saved location if present
        const defLoc = locationsData.find((l) => l.isDefault);
        if (defLoc) {
          setStoreLocation({
            lat: defLoc.latitude,
            lon: defLoc.longitude,
            name: defLoc.label,
          });
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.message === 'UNAUTHORIZED') {
          setIsUnauthed(true);
        } else {
          console.error('[SettingsPage] fetch error:', err);
          setError('Failed to load settings data.');
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleAlert = (key: keyof UserAlertsData): void => {
    const updated = { ...alerts, [key]: !alerts[key] };
    setAlerts(updated);
    updateAlertSettings(updated).catch((err) =>
      console.error('Failed to update alert settings:', err),
    );
  };

  const handleSetDefaultLoc = (loc: SavedLocationData): void => {
    setDefaultLocation(loc.id)
      .then(() => {
        setStoreLocation({
          lat: loc.latitude,
          lon: loc.longitude,
          name: loc.label,
        });
        loadData();
      })
      .catch((err) => console.error('Failed to set default location:', err));
  };

  const handleAddLocation = (e: React.FormEvent): void => {
    e.preventDefault();
    const lat = parseFloat(newLat);
    const lon = parseFloat(newLon);

    if (isNaN(lat) || isNaN(lon) || !newLabel.trim()) return;
    setAddingLoc(true);

    createSavedLocation({
      label: newLabel.trim(),
      latitude: lat,
      longitude: lon,
      isDefault: locations.length === 0,
    })
      .then(() => {
        setNewLabel('');
        setNewLat('');
        setNewLon('');
        setAddingLoc(false);
        loadData();
      })
      .catch((err) => {
        console.error('Failed to add location:', err);
        setAddingLoc(false);
      });
  };

  const handleDeleteLocation = (id: string): void => {
    deleteSavedLocation(id)
      .then(() => loadData())
      .catch((err) => console.error('Failed to delete location:', err));
  };

  const handleDeleteAccountConfirm = (): void => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return;
    setDeletingAccount(true);

    deleteAccount()
      .then(() => {
        window.location.href = '/login';
      })
      .catch((err) => {
        console.error('Failed to delete account:', err);
        setDeletingAccount(false);
      });
  };

  if (isUnauthed) {
    return (
      <main
        id="main-content"
        className="pt-20 pb-16 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center select-none"
      >
        <span className="type-micro text-brass-500 uppercase tracking-widest block mb-2">
          SETTINGS · AUTH REQUIRED
        </span>
        <h1 className="type-display-l text-sky-100 font-serif mb-4">Account Preferences</h1>
        <p className="type-body text-sky-300 max-w-md mb-8 leading-relaxed">
          Sign in to manage saved observer locations, alert toggles, and account data controls.
        </p>
        <a
          href="/login"
          className="px-6 py-3 border border-brass-300 text-brass-300 hover:bg-brass-300/10 font-mono text-xs uppercase tracking-wider transition-colors"
        >
          SIGN IN TO VIEW SETTINGS →
        </a>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="pt-16 pb-24 px-4 sm:px-8 max-w-3xl mx-auto flex flex-col min-h-screen"
      aria-label="Settings"
    >
      <div className="border-b border-sky-800/40 pb-6 mb-10">
        <span className="type-micro text-brass-500 uppercase tracking-widest block mb-1">
          PREFERENCES · PHASE 10
        </span>
        <h1 className="type-display-l text-sky-100 font-serif">Settings</h1>
      </div>

      {loading && (
        <div className="py-16 text-center font-mono text-xs text-sky-400 animate-pulse">
          LOADING SETTINGS...
        </div>
      )}

      {error && (
        <div className="p-4 bg-sky-950 border border-ember-400/40 text-xs font-mono text-ember-400 mb-8 text-center">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="divide-y divide-sky-800/40 space-y-12">
          {/* SECTION 1: SAVED LOCATIONS */}
          <section className="pt-8 first:pt-0 space-y-6">
            <div className="flex justify-between items-center">
              <span className="type-micro text-brass-500 uppercase font-mono tracking-widest">
                SAVED LOCATIONS
              </span>
              <span className="type-caption text-sky-400 text-xs font-mono">
                {locations.length} SAVED
              </span>
            </div>

            {/* List of saved locations */}
            <div className="space-y-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className={`p-4 border flex items-center justify-between transition-colors ${
                    loc.isDefault
                      ? 'border-brass-300 bg-sky-950/80'
                      : 'border-sky-800/40 bg-sky-950/30 hover:border-sky-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-sky-100 uppercase">
                        {loc.label}
                      </span>
                      {loc.isDefault && (
                        <span className="type-micro text-brass-300 border border-brass-300/60 px-1.5 py-0.5 text-[10px] font-mono">
                          DEFAULT OVERRIDE
                        </span>
                      )}
                    </div>
                    <span className="type-micro font-mono text-sky-400 block mt-1">
                      {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    {!loc.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultLoc(loc)}
                        className="text-sky-300 hover:text-brass-300 underline cursor-pointer"
                      >
                        SET DEFAULT
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="text-sky-500 hover:text-ember-400 cursor-pointer"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Location Form */}
            <form
              onSubmit={handleAddLocation}
              className="p-4 border border-sky-800/40 bg-sky-900/20 space-y-3"
            >
              <span className="type-micro text-sky-300 font-mono block uppercase">
                ADD SAVED LOCATION
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Label (e.g. Backyard)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
                  required
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 32.73)"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
                  required
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. 74.87)"
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={addingLoc}
                className="px-4 py-2 border border-brass-300/60 text-brass-300 hover:bg-brass-300/10 font-mono text-xs uppercase cursor-pointer"
              >
                {addingLoc ? 'SAVING...' : '+ SAVE LOCATION'}
              </button>
            </form>
          </section>

          {/* SECTION 2: ALERTS */}
          <section className="pt-8 space-y-6">
            <span className="type-micro text-brass-500 uppercase font-mono tracking-widest block">
              PERSONALIZED ALERTS
            </span>

            {/* Requirement #4: Deliverability notice */}
            <div className="p-3 bg-sky-900/40 border-l-2 border-brass-300 text-xs font-mono text-sky-300">
              {alertsDeliverable
                ? 'Alert delivery is active via real push notifications.'
                : 'Alert delivery is not active in this build — toggles persist preference state for future delivery.'}
            </div>

            <div className="space-y-4">
              {(
                [
                  [
                    'iss_pass',
                    'ISS VISIBLE PASS ALERTS',
                    'Notify when ISS peak altitude exceeds 30°',
                  ],
                  [
                    'aurora',
                    'AURORA BOREALIS ALERTS',
                    'Notify when predicted Kp reaches local visibility threshold',
                  ],
                  [
                    'meteor_shower',
                    'METEOR SHOWER PEAK ALERTS',
                    'Notify on peak night of active meteor showers',
                  ],
                  [
                    'neo_approach',
                    'NEAR-EARTH OBJECT ALERTS',
                    'Notify when close-approach asteroid is within 5 lunar distances',
                  ],
                ] as const
              ).map(([key, label, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 border border-sky-800/40 bg-sky-950/40"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-sky-100 block uppercase">
                      {label}
                    </span>
                    <span className="type-caption text-sky-400 text-xs">{desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAlert(key)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      alerts[key] ? 'bg-brass-300' : 'bg-sky-900 border border-sky-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-sky-950 transition-transform ${
                        alerts[key] ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3: YOUR DATA (DELETE MY DATA CONTROL) */}
          <section className="pt-8 space-y-6">
            <span className="type-micro text-ember-400 uppercase font-mono tracking-widest block">
              YOUR DATA
            </span>

            <div className="p-5 border border-ember-500/40 bg-sky-950/60 space-y-4">
              <div>
                <h3 className="font-mono text-xs font-bold text-ember-400 uppercase mb-1">
                  PERMANENT ACCOUNT DELETION
                </h3>
                <p className="type-body font-serif italic text-sky-300 text-sm leading-relaxed">
                  Deleting removes your saved locations, sky log, and prediction history from our
                  database. It is not a deactivation — rows are gone and cannot be restored.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 border border-ember-400 text-ember-400 hover:bg-ember-400/10 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                DELETE MY ACCOUNT & DATA
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Requirement #2: Confirmation Step Modal before DELETE /api/auth/account */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/90 backdrop-blur-sm p-4">
          <div className="max-w-md w-full border border-ember-400 bg-sky-950 p-6 space-y-4 shadow-2xl">
            <h2 className="type-title font-mono text-ember-400 uppercase font-bold">
              CONFIRM PERMANENT DELETION
            </h2>
            <p className="type-body text-sky-200 text-xs font-mono leading-relaxed">
              This action cannot be undone. To confirm permanent erasure of your account, saved
              locations, and sky log, type <strong className="text-ember-400">DELETE</strong> below:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full bg-sky-900 border border-ember-400/60 text-sky-100 p-2 font-mono text-xs uppercase"
            />

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 border border-sky-700 text-sky-300 hover:text-sky-100 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                onClick={handleDeleteAccountConfirm}
                className="px-4 py-2 bg-ember-600 text-sky-100 font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer hover:bg-ember-500"
              >
                {deletingAccount ? 'DELETING...' : 'CONFIRM DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
