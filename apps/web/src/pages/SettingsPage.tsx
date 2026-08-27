import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import { DEFAULT_OBSERVER_LOCATION } from '@/lib/api';

interface DataSourceInfo {
  id: string;
  category: string;
  source: string;
  summary: string;
  details: string;
  isComputation?: boolean;
}

const DATA_SOURCES: DataSourceInfo[] = [
  {
    id: 'iss',
    category: 'ISS POSITION & PASSES',
    source: 'N2YO API',
    summary: 'Live space station coordinates, visible pass predictions, and overfly look-angles.',
    details:
      "Combines real-time orbital positions (polled every 30–60s) with 5-minute cached visible pass predictions for your coordinates. Pass visibility requires 3 concurrent astronomical conditions: elevation ≥ 10°, observer in civil darkness (Sun elevation < -6°), and the space station remaining in direct sunlight outside Earth's shadow cone. Falls back to client-side SGP4/satellite.js propagation from CelesTrak two-line element sets if N2YO is unreachable.",
  },
  {
    id: 'solar-wind',
    category: 'SOLAR WIND & KP INDEX',
    source: 'NOAA SWPC',
    summary:
      'Real-time solar wind plasma parameters, geomagnetic disturbance index, and 3-day forecasts.',
    details:
      'Ingests 1-minute real-time solar wind (RTSW) plasma measurements (proton bulk speed, density, temperature) and 1-minute estimated planetary Kp indices from NOAA SWPC satellites at the Sun-Earth L1 Lagrange point. Powers the Heliosphere Pulse gauge, auroral oval equatorward boundary calculations (λ_b = 66° - 2 × Kp), and feeds 3-day geomagnetic storm forecasts.',
  },
  {
    id: 'donki',
    category: 'SOLAR FLARES & CMES',
    source: 'NASA DONKI',
    summary: 'Space weather disturbance events and physics-based solar transit timeline.',
    details:
      'Evaluates solar eruptions and coronal mass ejections detected by NASA/ESA solar observatories. When a CME is Earth-directed, its initial launch velocity is fed into an analytical Drag-Based Model (Vršnak 2013). The model solves for aerodynamic deceleration against ambient solar wind to project transit time across 1 AU and estimate arrival windows at Earth.',
  },
  {
    id: 'neows',
    category: 'NEAR-EARTH OBJECTS',
    source: 'NASA NeoWs',
    summary:
      'Close-approach asteroid tracking, miss distance scales, and landmark size comparisons.',
    details:
      'Monitors daily close approaches of asteroids and comets passing within 20 Lunar Distances (LD) of Earth (~7.68M km). Evaluates estimated diameter ranges, relative velocity (km/s), and close-approach epoch, benchmarking physical scale against architectural and geographic landmarks.',
  },
  {
    id: 'gibs',
    category: 'SKY & EARTH IMAGERY',
    source: 'NASA GIBS',
    summary: 'Real-time satellite cloud cover and Earth observation imagery.',
    details:
      "Streams true-color satellite imagery tiles from NASA's Global Imagery Browse Services (GIBS) Earthdata Web Map Tile Service (WMTS), updated continuously from Terra and Aqua MODIS / VIIRS polar-orbiting satellites, with static high-resolution composite fallbacks.",
  },
  {
    id: 'horizons',
    category: 'PLANETARY POSITIONS',
    source: 'JPL Horizons',
    summary: 'High-precision solar system ephemerides for planets and major celestial bodies.',
    details:
      "Computes true heliocentric and geocentric positions for the Sun, Mercury, Venus, Mars, Jupiter, and Saturn using NASA Jet Propulsion Laboratory's Horizons ephemeris computation system. Ephemerides are predictable and cached across multi-hour intervals.",
  },
  {
    id: 'celestial-math',
    category: 'LOCAL SKY DOME & ASTRONOMY',
    source: 'Pure Local Computation',
    isComputation: true,
    summary: 'Sun/Moon coordinates, twilight transitions, sidereal time, and 3D stellar backdrop.',
    details:
      'Executed entirely in pure client-side mathematical engines with zero network roundtrips. Implements Meeus low-precision solar algorithms (≥ 0.01° precision), Julian Day time-offsets (d_UT1), Local Sidereal Time (LST), and spherical trigonometry transformations converting Right Ascension/Declination into local Altitude/Azimuth. Maps 120,000+ stars from the HYG catalog with parallax-derived 3D Cartesian coordinates and Ballesteros blackbody color temperature calculations.',
  },
];

/** Format decimal lat/lon with correct N/S and E/W direction letters (negative longitude = West). */
function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

/** SettingsPage — /settings · Location, Local Data · local-only, browser storage · DESIGN_SPEC.md §15 */
export function SettingsPage(): React.ReactElement {
  const location = useAppStore((s) => s.location);
  const setLocation = useAppStore((s) => s.setLocation);
  const locationHistory = useAppStore((s) => s.locationHistory);
  const saveLocationToHistory = useAppStore((s) => s.saveLocationToHistory);
  const removeLocationFromHistory = useAppStore((s) => s.removeLocationFromHistory);
  const clearLocalData = useAppStore((s) => s.clearLocalData);
  const timeFormat = useAppStore((s) => s.timeFormat);
  const setTimeFormat = useAppStore((s) => s.setTimeFormat);
  const units = useAppStore((s) => s.units);
  const setUnits = useAppStore((s) => s.setUnits);

  const effectiveLocation = location ?? DEFAULT_OBSERVER_LOCATION;

  // Location Name & Coordinate Entry State
  const [nameInput, setNameInput] = useState<string>('');
  const [latInput, setLatInput] = useState<string>(() =>
    Math.abs(effectiveLocation.lat).toFixed(4),
  );
  const [latDir, setLatDir] = useState<'N' | 'S'>(() => (effectiveLocation.lat >= 0 ? 'N' : 'S'));
  const [lonInput, setLonInput] = useState<string>(() =>
    Math.abs(effectiveLocation.lon).toFixed(4),
  );
  const [lonDir, setLonDir] = useState<'E' | 'W'>(() => (effectiveLocation.lon >= 0 ? 'E' : 'W'));
  const [coordError, setCoordError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Geolocation State
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Clear local data confirmation modal state
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');

  // Collapsible state for About the Data items
  const [openDataSources, setOpenDataSources] = useState<Record<string, boolean>>({});

  const toggleDataSource = (id: string): void => {
    setOpenDataSources((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const parseCurrentCoordinates = (): {
    signedLat: number;
    signedLon: number;
    formattedCoords: string;
  } | null => {
    const trimmedLat = latInput.trim();
    const trimmedLon = lonInput.trim();

    if (!trimmedLat) {
      setCoordError('Please enter a latitude degree value.');
      return null;
    }
    if (!trimmedLon) {
      setCoordError('Please enter a longitude degree value.');
      return null;
    }

    const numLat = Number(trimmedLat);
    if (Number.isNaN(numLat) || numLat < 0 || numLat > 90) {
      setCoordError('Latitude must be a valid number between 0° and 90°.');
      return null;
    }

    const numLon = Number(trimmedLon);
    if (Number.isNaN(numLon) || numLon < 0 || numLon > 180) {
      setCoordError('Longitude must be a valid number between 0° and 180°.');
      return null;
    }

    const signedLat = latDir === 'S' ? -numLat : numLat;
    const signedLon = lonDir === 'W' ? -numLon : numLon;
    const formattedCoords = formatCoordinates(signedLat, signedLon);

    return { signedLat, signedLon, formattedCoords };
  };

  const handleApplyCoordinates = (e?: React.FormEvent): void => {
    if (e) e.preventDefault();
    setCoordError(null);
    setSaveFeedback(null);

    const parsed = parseCurrentCoordinates();
    if (!parsed) return;

    const displayName = nameInput.trim() || parsed.formattedCoords;
    setLocation({
      lat: parsed.signedLat,
      lon: parsed.signedLon,
      name: displayName,
    });

    setSaveFeedback('Location updated successfully.');
  };

  const handleSaveToHistory = (e?: React.MouseEvent | React.FormEvent): void => {
    if (e) e.preventDefault();
    setCoordError(null);
    setSaveFeedback(null);

    const parsed = parseCurrentCoordinates();
    if (!parsed) return;

    const displayName = nameInput.trim() || parsed.formattedCoords;
    saveLocationToHistory(displayName, parsed.signedLat, parsed.signedLon);
    setLocation({
      lat: parsed.signedLat,
      lon: parsed.signedLon,
      name: displayName,
    });

    setSaveFeedback(`Saved "${displayName}" to location history.`);
  };

  const handleSelectSavedLocation = (entry: (typeof locationHistory)[number]): void => {
    setLocation({
      lat: entry.lat,
      lon: entry.lon,
      name: entry.name,
    });
    setLatInput(Math.abs(entry.lat).toFixed(4));
    setLatDir(entry.lat >= 0 ? 'N' : 'S');
    setLonInput(Math.abs(entry.lon).toFixed(4));
    setLonDir(entry.lon >= 0 ? 'E' : 'W');
    setNameInput(entry.name);
    setCoordError(null);
    setGeoError(null);
    setSaveFeedback(`Switched to "${entry.name}".`);
  };

  const handleUseCurrentLocation = (): void => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    setCoordError(null);
    setSaveFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const newLatDir = lat >= 0 ? 'N' : 'S';
        const newLonDir = lon >= 0 ? 'E' : 'W';
        const absLat = Math.abs(lat);
        const absLon = Math.abs(lon);

        const initialName = nameInput.trim() || 'Current Location';
        setLocation({
          lat,
          lon,
          name: initialName,
        });

        setLatInput(absLat.toFixed(4));
        setLatDir(newLatDir);
        setLonInput(absLon.toFixed(4));
        setLonDir(newLonDir);
        setSaveFeedback('Location detected. Click "Save to History" to remember it.');
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === 1) {
          setGeoError(
            'Location permission was denied. Please allow location access in your browser settings.',
          );
        } else if (err.code === 2) {
          setGeoError('Location is unavailable on this device right now.');
        } else if (err.code === 3) {
          setGeoError('Location request timed out. Please try again.');
        } else {
          setGeoError("Couldn't access your location — check your browser's location permission.");
        }
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
      },
    );
  };

  const handleResetLocation = (): void => {
    setLocation(DEFAULT_OBSERVER_LOCATION);
    const defaultLat = DEFAULT_OBSERVER_LOCATION.lat;
    const defaultLon = DEFAULT_OBSERVER_LOCATION.lon;
    setLatInput(Math.abs(defaultLat).toFixed(4));
    setLatDir(defaultLat >= 0 ? 'N' : 'S');
    setLonInput(Math.abs(defaultLon).toFixed(4));
    setLonDir(defaultLon >= 0 ? 'E' : 'W');
    setNameInput('');
    setCoordError(null);
    setGeoError(null);
    setSaveFeedback(null);
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
      {/* Header */}
      <header className="border-b border-sky-800/40 pb-6 mb-10">
        <h1 className="type-display-l text-sky-100">Settings</h1>
      </header>

      <div className="divide-y divide-sky-800/40 space-y-10">
        {/* SECTION 1: LOCATION */}
        <section className="pt-10 first:pt-0 space-y-6">
          <div>
            <h2 className="font-jost text-xl font-medium text-sky-100">Location</h2>
            <p className="type-body text-sm text-sky-300 mt-1 leading-relaxed">
              This location applies across the Daily Brief and Explore. Saved locally to this
              browser only.
            </p>
          </div>

          {/* Current Location Display */}
          <div className="py-2">
            <span className="font-jost text-xs font-semibold text-brass-400 uppercase tracking-wider block mb-1">
              CURRENT LOCATION
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <span className="type-body text-base font-medium text-sky-100 block">
                  {effectiveLocation.name}
                </span>
                <span className="type-body text-sm text-sky-300 block mt-0.5 font-mono">
                  {formatCoordinates(effectiveLocation.lat, effectiveLocation.lon)}
                </span>
              </div>
              {location !== null && (
                <button
                  type="button"
                  onClick={handleResetLocation}
                  className="font-jost text-xs text-sky-400 hover:text-sky-200 transition-colors cursor-pointer py-1"
                >
                  Reset to Default
                </button>
              )}
            </div>
          </div>

          {/* Manual Coordinate Entry Form */}
          <form onSubmit={handleApplyCoordinates} className="space-y-4 pt-2">
            <span className="font-jost text-xs font-semibold text-brass-400 uppercase tracking-wider block">
              SET COORDINATES MANUALLY
            </span>

            {/* Optional Location Name */}
            <div>
              <label
                htmlFor="location-name-input"
                className="font-jost text-xs text-sky-300 block mb-1.5"
              >
                Location Name (optional)
              </label>
              <input
                id="location-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Home Observatory, Mauna Kea, Campsite"
                className="w-full bg-sky-950/60 border border-sky-800 text-sky-100 px-3.5 py-2.5 type-body text-sm rounded-sm focus:border-brass-400 focus:outline-none min-h-[44px] placeholder:text-sky-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Latitude */}
              <div>
                <label
                  htmlFor="latitude-input"
                  className="font-jost text-xs text-sky-300 block mb-1.5"
                >
                  Latitude (0° – 90°)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="latitude-input"
                    type="number"
                    step="any"
                    min="0"
                    max="90"
                    value={latInput}
                    onChange={(e) => {
                      setLatInput(e.target.value);
                      if (coordError) setCoordError(null);
                    }}
                    placeholder="40.7128"
                    className="w-full min-w-0 bg-sky-950/60 border border-sky-800 text-sky-100 px-3.5 py-2.5 type-body text-sm rounded-sm focus:border-brass-400 focus:outline-none min-h-[44px] font-mono"
                  />
                  <div
                    role="group"
                    aria-label="Latitude hemisphere"
                    className="inline-flex rounded-sm border border-sky-800 bg-sky-950/80 p-0.5 shrink-0 min-h-[44px] items-center"
                  >
                    <button
                      type="button"
                      aria-pressed={latDir === 'N'}
                      onClick={() => setLatDir('N')}
                      className={`px-3 py-2 text-xs font-jost uppercase tracking-wider rounded-sm transition-colors cursor-pointer min-h-[38px] ${
                        latDir === 'N'
                          ? 'bg-brass-400 text-sky-950 font-bold shadow-sm'
                          : 'text-sky-400 hover:text-sky-200'
                      }`}
                    >
                      N
                    </button>
                    <button
                      type="button"
                      aria-pressed={latDir === 'S'}
                      onClick={() => setLatDir('S')}
                      className={`px-3 py-2 text-xs font-jost uppercase tracking-wider rounded-sm transition-colors cursor-pointer min-h-[38px] ${
                        latDir === 'S'
                          ? 'bg-brass-400 text-sky-950 font-bold shadow-sm'
                          : 'text-sky-400 hover:text-sky-200'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>
              </div>

              {/* Longitude */}
              <div>
                <label
                  htmlFor="longitude-input"
                  className="font-jost text-xs text-sky-300 block mb-1.5"
                >
                  Longitude (0° – 180°)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="longitude-input"
                    type="number"
                    step="any"
                    min="0"
                    max="180"
                    value={lonInput}
                    onChange={(e) => {
                      setLonInput(e.target.value);
                      if (coordError) setCoordError(null);
                    }}
                    placeholder="74.0060"
                    className="w-full min-w-0 bg-sky-950/60 border border-sky-800 text-sky-100 px-3.5 py-2.5 type-body text-sm rounded-sm focus:border-brass-400 focus:outline-none min-h-[44px] font-mono"
                  />
                  <div
                    role="group"
                    aria-label="Longitude hemisphere"
                    className="inline-flex rounded-sm border border-sky-800 bg-sky-950/80 p-0.5 shrink-0 min-h-[44px] items-center"
                  >
                    <button
                      type="button"
                      aria-pressed={lonDir === 'E'}
                      onClick={() => setLonDir('E')}
                      className={`px-3 py-2 text-xs font-jost uppercase tracking-wider rounded-sm transition-colors cursor-pointer min-h-[38px] ${
                        lonDir === 'E'
                          ? 'bg-brass-400 text-sky-950 font-bold shadow-sm'
                          : 'text-sky-400 hover:text-sky-200'
                      }`}
                    >
                      E
                    </button>
                    <button
                      type="button"
                      aria-pressed={lonDir === 'W'}
                      onClick={() => setLonDir('W')}
                      className={`px-3 py-2 text-xs font-jost uppercase tracking-wider rounded-sm transition-colors cursor-pointer min-h-[38px] ${
                        lonDir === 'W'
                          ? 'bg-brass-400 text-sky-950 font-bold shadow-sm'
                          : 'text-sky-400 hover:text-sky-200'
                      }`}
                    >
                      W
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {coordError && <p className="type-body text-sm text-ember-400 mt-1.5">{coordError}</p>}

            {saveFeedback && (
              <p className="type-body text-sm text-brass-300 mt-1.5">{saveFeedback}</p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <button
                type="submit"
                className="w-full sm:w-auto font-jost text-sm font-semibold px-5 py-2.5 bg-brass-400 text-sky-950 hover:bg-brass-300 transition-colors cursor-pointer rounded-sm min-h-[44px] flex items-center justify-center shadow-sm"
              >
                Apply Location
              </button>

              <button
                type="button"
                onClick={handleSaveToHistory}
                className="w-full sm:w-auto font-jost text-sm font-medium px-4 py-2.5 border border-brass-400/80 text-brass-300 hover:bg-brass-400/10 hover:border-brass-400 transition-colors cursor-pointer rounded-sm min-h-[44px] flex items-center justify-center gap-2"
              >
                Save to History
              </button>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={geoLoading}
                className="w-full sm:w-auto font-jost text-sm font-medium px-4 py-2.5 border border-sky-800 text-sky-300 hover:bg-sky-900/40 hover:border-sky-700 disabled:opacity-50 transition-colors cursor-pointer rounded-sm min-h-[44px] flex items-center justify-center gap-2"
              >
                {geoLoading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-brass-400/30 border-t-brass-400 rounded-full animate-spin" />
                    <span>Detecting location...</span>
                  </>
                ) : (
                  <span>Use my current location</span>
                )}
              </button>
            </div>

            {geoError && (
              <p className="type-body text-sm text-ember-400 mt-2 leading-relaxed">{geoError}</p>
            )}
          </form>

          {/* Saved Locations List */}
          {locationHistory.length > 0 && (
            <div className="pt-4 space-y-3">
              <span className="font-jost text-xs font-semibold text-brass-400 uppercase tracking-wider block">
                SAVED LOCATIONS
              </span>

              <div className="divide-y divide-sky-800/30 border-y border-sky-800/30">
                {locationHistory.map((entry) => {
                  const isCurrent =
                    location !== null &&
                    Math.abs(location.lat - entry.lat) < 0.0001 &&
                    Math.abs(location.lon - entry.lon) < 0.0001;

                  return (
                    <div
                      key={`${entry.name}-${entry.lat}-${entry.lon}`}
                      className="py-3 flex items-center justify-between gap-3 group"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSavedLocation(entry)}
                        className="flex-1 text-left flex flex-col min-w-0 cursor-pointer focus:outline-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="type-body text-sm font-medium text-sky-100 group-hover:text-brass-300 transition-colors truncate">
                            {entry.name}
                          </span>
                          {isCurrent && (
                            <span className="font-jost text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-xs bg-brass-400 text-sky-950 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-sky-300 mt-0.5">
                          {formatCoordinates(entry.lat, entry.lon)}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectSavedLocation(entry)}
                          className="font-jost text-xs text-sky-400 hover:text-brass-300 px-2.5 py-1.5 transition-colors cursor-pointer rounded-sm hover:bg-sky-900/40"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLocationFromHistory(entry.name);
                          }}
                          aria-label={`Remove ${entry.name} from saved locations`}
                          className="text-sky-500 hover:text-ember-400 p-2 text-sm leading-none transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center rounded-sm hover:bg-ember-500/10"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: PREFERENCES */}
        <section className="pt-10 space-y-6">
          <div>
            <h2 className="font-jost text-xl font-medium text-sky-100">Preferences</h2>
          </div>

          <div className="divide-y divide-sky-800/30">
            {/* Time Format */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
              <div>
                <span className="font-jost text-xs font-semibold text-brass-400 uppercase tracking-wider block mb-1">
                  TIME FORMAT
                </span>
                <span className="type-body text-base font-medium text-sky-100 block">
                  {timeFormat === '24h' ? '24-Hour (14:30)' : '12-Hour (2:30 PM)'}
                </span>
                <span className="type-body text-xs text-sky-300 block mt-0.5">
                  Controls timestamps for the ISS pass, moonrise/set, and observation windows.
                </span>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <span
                  className={`font-jost text-xs uppercase tracking-wider transition-colors ${
                    timeFormat === '24h' ? 'text-sky-100 font-semibold' : 'text-sky-500'
                  }`}
                >
                  24H
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={timeFormat === '12h'}
                  aria-label="Toggle 12-hour or 24-hour time format"
                  onClick={() => setTimeFormat(timeFormat === '24h' ? '12h' : '24h')}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:border-brass-400 p-0.5 ${
                    timeFormat === '12h'
                      ? 'bg-brass-500/30 border-brass-400/70'
                      : 'bg-sky-950/80 border-sky-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                      timeFormat === '12h'
                        ? 'translate-x-7 bg-brass-400 ring-1 ring-brass-200'
                        : 'translate-x-0 bg-sky-600 ring-1 ring-sky-400'
                    }`}
                  />
                </button>
                <span
                  className={`font-jost text-xs uppercase tracking-wider transition-colors ${
                    timeFormat === '12h' ? 'text-brass-300 font-semibold' : 'text-sky-500'
                  }`}
                >
                  12H
                </span>
              </div>
            </div>

            {/* Units */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
              <div>
                <span className="font-jost text-xs font-semibold text-brass-400 uppercase tracking-wider block mb-1">
                  UNITS
                </span>
                <span className="type-body text-base font-medium text-sky-100 block">
                  {units === 'metric' ? 'Metric (km, m, km/s)' : 'Imperial (mi, ft, mi/s)'}
                </span>
                <span className="type-body text-xs text-sky-300 block mt-0.5">
                  Controls altitude, asteroid distance/size, and solar wind telemetry units.
                </span>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <span
                  className={`font-jost text-xs uppercase tracking-wider transition-colors ${
                    units === 'metric' ? 'text-sky-100 font-semibold' : 'text-sky-500'
                  }`}
                >
                  METRIC
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={units === 'imperial'}
                  aria-label="Toggle metric or imperial units"
                  onClick={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:border-brass-400 p-0.5 ${
                    units === 'imperial'
                      ? 'bg-brass-500/30 border-brass-400/70'
                      : 'bg-sky-950/80 border-sky-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                      units === 'imperial'
                        ? 'translate-x-7 bg-brass-400 ring-1 ring-brass-200'
                        : 'translate-x-0 bg-sky-600 ring-1 ring-sky-400'
                    }`}
                  />
                </button>
                <span
                  className={`font-jost text-xs uppercase tracking-wider transition-colors ${
                    units === 'imperial' ? 'text-brass-300 font-semibold' : 'text-sky-500'
                  }`}
                >
                  IMPERIAL
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ABOUT THE DATA */}
        <section className="pt-10 space-y-6">
          <div>
            <h2 className="font-jost text-xl font-medium text-sky-100">About the Data</h2>
            <p className="type-body text-sm text-sky-300 mt-1 leading-relaxed">
              Every data feed, astronomical calculation, and space weather model powering ASTRANET.
            </p>
          </div>

          <div className="divide-y divide-sky-800/30 border-y border-sky-800/30">
            {DATA_SOURCES.map((item) => {
              const isOpen = !!openDataSources[item.id];
              return (
                <div key={item.id} className="py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleDataSource(item.id)}
                    aria-expanded={isOpen}
                    className="w-full text-left flex items-start justify-between gap-3 sm:gap-4 group cursor-pointer focus:outline-none"
                  >
                    <div className="flex flex-col min-w-0 pr-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                        <span className="font-jost text-xs font-semibold text-brass-400 uppercase tracking-wider">
                          {item.category}
                        </span>
                        <span className="text-sky-600 text-xs hidden sm:inline">·</span>
                        <span className="font-jost text-xs text-sky-400 font-medium">
                          {item.source}
                        </span>
                      </div>
                      <span className="type-body text-sm font-medium text-sky-100 group-hover:text-brass-300 transition-colors break-words">
                        {item.summary}
                      </span>
                    </div>
                    <div className="pt-1 shrink-0">
                      <svg
                        viewBox="0 0 20 20"
                        className={`w-4 h-4 text-sky-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-brass-400' : 'group-hover:text-sky-200'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 8l4 4 4-4" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="pt-3 pb-1 pr-2 sm:pr-6">
                      <p className="type-body text-sm text-sky-200/90 leading-relaxed break-words">
                        {item.details}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: MORE */}
        <section className="pt-10 space-y-4">
          <div>
            <h2 className="font-jost text-xl font-medium text-sky-100">More</h2>
          </div>

          <div className="pt-2">
            <Link
              to="/status"
              className="type-title text-sky-100 hover:text-brass-300 transition-colors inline-flex items-center gap-2 group"
            >
              <span>System Status</span>
              <span className="type-mono group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </section>

        {/* SECTION 5: YOUR DATA */}
        <section className="pt-10 space-y-4">
          <div>
            <h2 className="font-jost text-xl font-medium text-sky-100">Your Data</h2>
            <p className="type-body text-sm text-sky-300 mt-1 leading-relaxed">
              Wipes your saved location preferences and reset state from this browser. This action
              cannot be undone.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="w-full sm:w-auto font-jost text-sm px-4 py-2.5 border border-ember-500/60 text-ember-400 hover:bg-ember-500/10 hover:border-ember-400 transition-colors cursor-pointer rounded-sm min-h-[44px] flex items-center justify-center"
            >
              Clear Local Data
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation Step Modal before clearing local data */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/90 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-md w-full border border-ember-500/60 bg-sky-950 p-5 sm:p-6 space-y-4 rounded-sm shadow-2xl my-auto">
            <h2 className="font-jost text-lg font-medium text-ember-400">
              Confirm Clear Local Data
            </h2>
            <p className="type-body text-sm text-sky-200 leading-relaxed">
              This will wipe all saved preferences from this browser. To confirm, type{' '}
              <strong className="text-ember-400 font-semibold">CLEAR</strong> below:
            </p>

            <input
              type="text"
              aria-label="Confirm clear local data"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="w-full bg-sky-900 border border-ember-500/50 text-sky-100 px-3 py-2 type-body text-sm uppercase rounded-sm focus:border-ember-400 focus:outline-none min-h-[44px]"
            />

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmText('');
                }}
                className="w-full sm:w-auto font-jost text-sm px-4 py-2.5 border border-sky-800 text-sky-300 hover:text-sky-100 cursor-pointer rounded-sm min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmText.trim().toUpperCase() !== 'CLEAR'}
                onClick={handleClearLocalDataConfirm}
                className="w-full sm:w-auto font-jost text-sm px-4 py-2.5 bg-ember-600 text-sky-100 font-medium disabled:opacity-40 cursor-pointer hover:bg-ember-500 transition-colors rounded-sm min-h-[44px] flex items-center justify-center"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
