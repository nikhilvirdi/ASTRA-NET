import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { DEFAULT_OBSERVER_LOCATION } from '@/lib/api';
import type { UserAlertsData } from '@/store';

/** SettingsPage — /settings · Location, Alerts, Local Data · local-only, browser storage · DESIGN_SPEC.md §15 */
export function SettingsPage(): React.ReactElement {
  const location = useAppStore((s) => s.location);
  const setLocation = useAppStore((s) => s.setLocation);
  const alerts = useAppStore((s) => s.alerts);
  const setAlerts = useAppStore((s) => s.setAlerts);
  const clearLocalData = useAppStore((s) => s.clearLocalData);

  const effectiveLocation = location ?? DEFAULT_OBSERVER_LOCATION;

  // Location edit form state
  const [editingLocation, setEditingLocation] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>(effectiveLocation.name);
  const [newLat, setNewLat] = useState<string>(String(effectiveLocation.lat));
  const [newLon, setNewLon] = useState<string>(String(effectiveLocation.lon));

  // Clear local data confirmation modal state
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');

  const handleToggleAlert = (key: keyof UserAlertsData): void => {
    setAlerts({ [key]: !alerts[key] } as Partial<UserAlertsData>);
  };

  const openLocationEditor = (): void => {
    setNewLabel(effectiveLocation.name);
    setNewLat(String(effectiveLocation.lat));
    setNewLon(String(effectiveLocation.lon));
    setEditingLocation(true);
  };

  const handleSaveLocation = (e: React.FormEvent): void => {
    e.preventDefault();
    const lat = parseFloat(newLat);
    const lon = parseFloat(newLon);
    if (isNaN(lat) || isNaN(lon) || !newLabel.trim()) return;

    setLocation({ lat, lon, name: newLabel.trim().toUpperCase() });
    setEditingLocation(false);
  };

  const handleResetLocation = (): void => {
    setLocation(DEFAULT_OBSERVER_LOCATION);
    setEditingLocation(false);
  };

  const handleClearLocalDataConfirm = (): void => {
    if (confirmText.trim().toUpperCase() !== 'CLEAR') return;
    clearLocalData();
    setShowClearModal(false);
    setConfirmText('');
  };

  return (
    <main
      id="main-content"
      className="pt-16 pb-24 px-4 sm:px-8 max-w-3xl mx-auto flex flex-col min-h-screen"
      aria-label="Settings"
    >
      <div className="border-b border-sky-800/40 pb-6 mb-10">
        <span className="type-micro text-brass-500 uppercase tracking-widest block mb-1">
          PREFERENCES
        </span>
        <h1 className="type-display-l text-sky-100 font-serif">Settings</h1>
      </div>

      <div className="divide-y divide-sky-800/40 space-y-12">
        {/* SECTION 1: LOCATION */}
        <section className="pt-8 first:pt-0 space-y-6">
          <span className="type-micro text-brass-500 uppercase font-mono tracking-widest">
            LOCATION
          </span>

          <div className="p-4 border border-brass-300 bg-sky-950/80 flex items-center justify-between">
            <div>
              <span className="font-mono text-sm font-bold text-sky-100 uppercase">
                {effectiveLocation.name}
              </span>
              <span className="type-micro font-mono text-sky-400 block mt-1">
                {effectiveLocation.lat.toFixed(4)}°N, {effectiveLocation.lon.toFixed(4)}°E
              </span>
            </div>
            {!editingLocation && (
              <button
                type="button"
                onClick={openLocationEditor}
                className="type-micro text-sky-300 hover:text-brass-300 underline cursor-pointer font-mono text-xs"
              >
                CHANGE
              </button>
            )}
          </div>

          {editingLocation && (
            <form
              onSubmit={handleSaveLocation}
              className="p-4 border border-sky-800/40 bg-sky-900/20 space-y-3"
            >
              <span className="type-micro text-sky-300 font-mono block uppercase">
                SET CURRENT LOCATION
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Label (e.g. Home)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
                  required
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 28.6139)"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
                  required
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. 77.2090)"
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 border border-brass-300/60 text-brass-300 hover:bg-brass-300/10 font-mono text-xs uppercase cursor-pointer"
                >
                  SAVE LOCATION
                </button>
                <button
                  type="button"
                  onClick={handleResetLocation}
                  className="px-4 py-2 border border-sky-700 text-sky-300 hover:text-sky-100 font-mono text-xs uppercase cursor-pointer"
                >
                  RESET TO DEFAULT
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLocation(false)}
                  className="px-4 py-2 text-sky-500 hover:text-sky-300 font-mono text-xs uppercase cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          )}

          <p className="type-caption text-sky-400 text-xs font-mono leading-relaxed">
            This location applies across the Daily Brief, Explore, and Best Spot. No account needed
            — it's saved to this browser only.
          </p>
        </section>

        {/* SECTION 2: ALERTS */}
        <section className="pt-8 space-y-6">
          <span className="type-micro text-brass-500 uppercase font-mono tracking-widest block">
            PERSONALIZED ALERTS
          </span>

          <div className="p-3 bg-sky-900/40 border-l-2 border-brass-300 text-xs font-mono text-sky-300">
            Alert delivery is not active in this build — toggles persist preference state in this
            browser for future delivery.
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

        {/* SECTION 3: CLEAR LOCAL DATA */}
        <section className="pt-8 space-y-6">
          <span className="type-micro text-ember-400 uppercase font-mono tracking-widest block">
            YOUR DATA
          </span>

          <div className="p-5 border border-ember-500/40 bg-sky-950/60 space-y-4">
            <div>
              <h3 className="font-mono text-xs font-bold text-ember-400 uppercase mb-1">
                CLEAR LOCAL DATA
              </h3>
              <p className="type-body font-serif italic text-sky-300 text-sm leading-relaxed">
                Wipes your saved location, Sky Log entries, and alert preferences from this browser.
                It cannot be undone.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="px-4 py-2 border border-ember-400 text-ember-400 hover:bg-ember-400/10 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              CLEAR LOCAL DATA
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation Step Modal before clearing local data */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/90 backdrop-blur-sm p-4">
          <div className="max-w-md w-full border border-ember-400 bg-sky-950 p-6 space-y-4 shadow-2xl">
            <h2 className="type-title font-mono text-ember-400 uppercase font-bold">
              CONFIRM CLEAR LOCAL DATA
            </h2>
            <p className="type-body text-sky-200 text-xs font-mono leading-relaxed">
              This clears your saved location, Sky Log entries, and alert preferences from this
              browser. To confirm, type <strong className="text-ember-400">CLEAR</strong> below:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="w-full bg-sky-900 border border-ember-400/60 text-sky-100 p-2 font-mono text-xs uppercase"
            />

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 border border-sky-700 text-sky-300 hover:text-sky-100 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={confirmText.trim().toUpperCase() !== 'CLEAR'}
                onClick={handleClearLocalDataConfirm}
                className="px-4 py-2 bg-ember-600 text-sky-100 font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer hover:bg-ember-500"
              >
                CONFIRM CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
