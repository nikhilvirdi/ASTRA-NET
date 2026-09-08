import React, { useState } from 'react';

export interface DataSourceInfo {
  id: string;
  category: string;
  source: string;
  summary: string;
  details: string;
  isComputation?: boolean;
}

export const DATA_SOURCES: DataSourceInfo[] = [
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
    id: 'satellites',
    category: 'SATELLITES',
    source: 'CelesTrak / Space-Track.org',
    summary:
      'Live positions for satellites, space stations, and debris — Starlink, GPS, weather, geostationary, and more, computed from real orbital elements.',
    details:
      "Orbital element sets for satellites, space stations, and tracked debris — Starlink, GPS, weather, geostationary orbit, and more — come from CelesTrak's public catalog. Falls back to Space-Track.org if CelesTrak is unreachable, so satellite positions keep working even when the primary source is down.",
  },
  {
    id: 'cloud-cover',
    category: 'CLOUD COVER',
    source: 'Open-Meteo',
    summary: 'Real-time and forecasted cloud cover and visibility for your exact location.',
    details:
      "Hourly cloud cover percentage and visibility, current hour through the next five, fetched live for your exact coordinates from Open-Meteo's free, keyless weather API.",
  },
  {
    id: 'sky-quality',
    category: 'SKY QUALITY',
    source: 'NASA Black Marble',
    summary:
      "Light pollution estimate (Bortle scale) from NASA's Black Marble night-lights composite.",
    details:
      "Estimates Bortle-scale sky darkness (1–9) from a downsampled brightness reading of NASA's Black Marble night-lights composite, at roughly 11km resolution. This is a relative darkness estimate, not a calibrated scientific measurement — city, rural, and open-ocean skies are ranked correctly relative to each other, but the exact value at any one point is approximate.",
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

export function DataSourcesList(): React.ReactElement {
  const [openDataSources, setOpenDataSources] = useState<Record<string, boolean>>({});

  const toggleDataSource = (id: string): void => {
    setOpenDataSources((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
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
                  <span className="font-jost text-xs text-sky-400 font-medium">{item.source}</span>
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
  );
}
