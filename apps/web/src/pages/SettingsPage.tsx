import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { DEFAULT_OBSERVER_LOCATION } from '@/lib/api';

/** SettingsPage — /settings · Location, Local Data · local-only, browser storage · DESIGN_SPEC.md §15 */
export function SettingsPage(): React.ReactElement {
  const location = useAppStore((s) => s.location);
  const setLocation = useAppStore((s) => s.setLocation);
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
                className="type-micro text-sky-300 hover:text-brass-300 underline cursor-pointer font-mono text-xs min-h-[44px] px-3 py-2 flex items-center justify-center"
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
                  aria-label="Location label"
                  placeholder="Label (e.g. Home)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-3 font-mono text-xs min-h-[44px]"
                  required
                />
                <input
                  type="number"
                  step="any"
                  aria-label="Latitude"
                  placeholder="Latitude (e.g. 28.6139)"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-3 font-mono text-xs min-h-[44px]"
                  required
                />
                <input
                  type="number"
                  step="any"
                  aria-label="Longitude"
                  placeholder="Longitude (e.g. 77.2090)"
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                  className="bg-sky-900 border border-sky-700 text-sky-100 p-3 font-mono text-xs min-h-[44px]"
                  required
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 border border-brass-300/60 text-brass-300 hover:bg-brass-300/10 font-mono text-xs uppercase cursor-pointer flex items-center justify-center"
                >
                  SAVE LOCATION
                </button>
                <button
                  type="button"
                  onClick={handleResetLocation}
                  className="min-h-[44px] px-4 py-2 border border-sky-700 text-sky-300 hover:text-sky-100 font-mono text-xs uppercase cursor-pointer flex items-center justify-center"
                >
                  RESET TO DEFAULT
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLocation(false)}
                  className="min-h-[44px] px-4 py-2 text-sky-400 hover:text-sky-200 font-mono text-xs uppercase cursor-pointer flex items-center justify-center"
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

        {/* SECTION 2: CLEAR LOCAL DATA */}
        <section className="pt-8 space-y-6">
          <span className="type-micro text-brass-300 uppercase font-mono tracking-widest block">
            YOUR DATA
          </span>

          <div className="p-5 border border-sky-700 bg-sky-950/60 space-y-4">
            <div>
              <h3 className="font-mono text-xs font-bold text-sky-200 uppercase mb-1">
                CLEAR LOCAL DATA
              </h3>
              <p className="type-body font-serif italic text-sky-400 text-sm leading-relaxed">
                Wipes your saved location preferences from this browser. It cannot be undone.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="min-h-[44px] px-4 py-2 border border-sky-600 text-sky-300 hover:bg-ember-400/10 hover:border-ember-400 hover:text-ember-400 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center"
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
              This clears your saved location preferences from this browser. To confirm, type{' '}
              <strong className="text-ember-400">CLEAR</strong> below:
            </p>

            <input
              type="text"
              aria-label="Confirm clear local data"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="w-full bg-sky-900 border border-ember-400/60 text-sky-100 p-3 font-mono text-xs uppercase min-h-[44px]"
            />

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmText('');
                }}
                className="min-h-[44px] px-4 py-2 border border-sky-700 text-sky-300 hover:text-sky-100 cursor-pointer flex items-center justify-center"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={confirmText.trim().toUpperCase() !== 'CLEAR'}
                onClick={handleClearLocalDataConfirm}
                className="min-h-[44px] px-4 py-2 bg-ember-600 text-sky-100 font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer hover:bg-ember-500 flex items-center justify-center"
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
