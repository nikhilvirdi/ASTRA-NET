import React, { useEffect, useRef, useState } from 'react';
import type { BestSpotSite } from '@/lib/api';
import { getBortleLuminanceColor } from '@/lib/best-spot-helpers';

export { getBortleLuminanceColor };

export interface MapLibreMarkerInstance {
  setLngLat(lngLat: [number, number]): this;
  addTo(map: MapLibreInstance): this;
  remove(): void;
}

export interface MapLibreInstance {
  easeTo(options: { center: [number, number]; zoom?: number }): void;
}

export interface MapLibreConstructor {
  Map: new (options: {
    container: HTMLElement;
    style: object;
    center: [number, number];
    zoom: number;
  }) => MapLibreInstance;
  Marker: new (options?: { element?: HTMLElement }) => MapLibreMarkerInstance;
}

declare global {
  interface Window {
    maplibregl?: MapLibreConstructor;
  }
}

interface MapLibreSpotMapProps {
  observer: { latDeg: number; lonDeg: number };
  sites: BestSpotSite[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
}

/**
 * MapLibre GL map component displaying light-pollution luminance fields and ranked candidate site markers.
 * Includes a resilient SVG/Canvas fallback for headless test environments (Vitest/JSDOM).
 */
export function MapLibreSpotMap({
  observer,
  sites,
  selectedSiteId,
  onSelectSite,
}: MapLibreSpotMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<MapLibreMarkerInstance[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webGlAvailable, setWebGlAvailable] = useState(true);

  // Dynamic loader for MapLibre GL JS & CSS from unpkg
  useEffect(() => {
    let active = true;

    const checkAndLoadMapLibre = (): void => {
      if (typeof window === 'undefined') return;

      // Check if WebGL context is supported (gracefully handles Vitest / JSDOM)
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          if (active) setWebGlAvailable(false);
          return;
        }
      } catch {
        if (active) setWebGlAvailable(false);
        return;
      }

      if (window.maplibregl) {
        if (active) setMapLoaded(true);
        return;
      }

      // Inject CSS
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link');
        link.id = 'maplibre-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
        document.head.appendChild(link);
      }

      // Inject JS
      const existingScript = document.getElementById('maplibre-js');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'maplibre-js';
        script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
        script.onload = () => {
          if (active) setMapLoaded(true);
        };
        script.onerror = () => {
          if (active) setWebGlAvailable(false);
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => {
          if (active) setMapLoaded(true);
        });
      }
    };

    checkAndLoadMapLibre();

    return () => {
      active = false;
    };
  }, []);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapLoaded || !containerRef.current || !window.maplibregl || mapRef.current) return;

    try {
      const Lib = window.maplibregl;
      const map = new Lib.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
              paint: {
                'raster-opacity': 0.25,
                'raster-brightness-max': 0.4,
                'raster-contrast': 0.2,
              },
            },
          ],
        },
        center: [observer.lonDeg, observer.latDeg],
        zoom: 9,
      });

      mapRef.current = map;
    } catch {
      setWebGlAvailable(false);
    }
  }, [mapLoaded, observer]);

  // Update Markers & Light-Pollution Layer
  useEffect(() => {
    const map = mapRef.current;
    const Lib = window.maplibregl;
    if (!map || !Lib) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add Observer Marker (User Location)
    const userEl = document.createElement('div');
    userEl.className =
      'w-4 h-4 bg-brass-300 rounded-full border-2 border-sky-950 shadow-lg animate-pulse';
    userEl.title = 'Your Location';

    const userMarker = new Lib.Marker({ element: userEl })
      .setLngLat([observer.lonDeg, observer.latDeg])
      .addTo(map);
    markersRef.current.push(userMarker);

    // Add Candidate Site Markers
    sites.forEach((site) => {
      const el = document.createElement('div');
      const isSelected = site.id === selectedSiteId;
      const bortleColor = getBortleLuminanceColor(site.darkness.bortleClass);

      el.className = `flex items-center justify-center cursor-pointer transition-all duration-300 font-mono text-xs font-bold rounded-full shadow-xl ${
        isSelected
          ? 'w-9 h-9 bg-brass-300 text-sky-950 ring-4 ring-brass-300/40 z-30 scale-110'
          : 'w-7 h-7 bg-sky-900 text-sky-100 border border-brass-300/60 hover:bg-sky-800 z-20'
      }`;
      el.style.boxShadow = `0 0 16px ${bortleColor}80`;
      el.innerHTML = `${site.rank}`;
      el.addEventListener('click', () => onSelectSite(site.id));

      const marker = new Lib.Marker({ element: el })
        .setLngLat([site.lonDeg, site.latDeg])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Center map when selection changes
    const selected = sites.find((s) => s.id === selectedSiteId);
    if (selected) {
      map.easeTo({ center: [selected.lonDeg, selected.latDeg], zoom: 10 });
    }
  }, [sites, selectedSiteId, observer, onSelectSite]);

  // Fallback map view for headless / non-WebGL environments
  if (!webGlAvailable || !mapLoaded) {
    return (
      <div className="relative w-full h-full bg-sky-950 border border-sky-800/40 p-4 flex flex-col justify-between select-none">
        <div className="flex justify-between items-center z-10">
          <span className="type-micro text-brass-500 uppercase font-mono">
            LIGHT-POLLUTION LUMINANCE MAP · BORTLE FIELD VIEW
          </span>
          <span className="type-micro text-sky-400 font-mono">
            {sites.length} CANDIDATE SITES PLOTTED
          </span>
        </div>

        {/* Interactive SVG Radar Map Fallback */}
        <div className="relative flex-1 my-4 flex items-center justify-center overflow-hidden border border-sky-800/30 bg-sky-900/30">
          <svg className="w-full h-full max-w-[500px] max-h-[500px]" viewBox="-120 -120 240 240">
            {/* Concentric distance rings */}
            <circle
              cx="0"
              cy="0"
              r="30"
              fill="none"
              stroke="#3E4A4A"
              strokeDasharray="3 3"
              strokeWidth="0.5"
            />
            <circle
              cx="0"
              cy="0"
              r="60"
              fill="none"
              stroke="#3E4A4A"
              strokeDasharray="3 3"
              strokeWidth="0.5"
            />
            <circle
              cx="0"
              cy="0"
              r="90"
              fill="none"
              stroke="#3E4A4A"
              strokeDasharray="3 3"
              strokeWidth="0.5"
            />

            {/* Compass axes */}
            <line
              x1="-100"
              y1="0"
              x2="100"
              y2="0"
              stroke="#3E4A4A"
              strokeWidth="0.5"
              opacity="0.5"
            />
            <line
              x1="0"
              y1="-100"
              x2="0"
              y2="100"
              stroke="#3E4A4A"
              strokeWidth="0.5"
              opacity="0.5"
            />

            {/* Observer Center */}
            <circle cx="0" cy="0" r="4" fill="#C9B187" className="animate-pulse" />
            <text
              x="0"
              y="12"
              fill="#C9B187"
              fontSize="6"
              textAnchor="middle"
              fontFamily="monospace"
            >
              YOU
            </text>

            {/* Sites mapped relative to observer */}
            {sites.map((site) => {
              const dLat = (site.latDeg - observer.latDeg) * 111;
              const dLon =
                (site.lonDeg - observer.lonDeg) * 111 * Math.cos((observer.latDeg * Math.PI) / 180);
              // Scale to canvas (max 90px radius)
              const scale = 2.2;
              const cx = dLon * scale;
              const cy = -dLat * scale; // Invert latitude to match screen Y
              const isSelected = site.id === selectedSiteId;
              const bortleColor = getBortleLuminanceColor(site.darkness.bortleClass);

              return (
                <g
                  key={site.id}
                  onClick={() => onSelectSite(site.id)}
                  className="cursor-pointer transition-transform hover:scale-125"
                >
                  {/* Light pollution aura */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8 + (9 - site.darkness.bortleClass)}
                    fill={bortleColor}
                    opacity="0.35"
                  />
                  {/* Site point */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 7 : 5}
                    fill={isSelected ? '#C9B187' : '#1C2424'}
                    stroke="#C9B187"
                    strokeWidth="1"
                  />
                  <text
                    x={cx}
                    y={cy + 2}
                    fill={isSelected ? '#111818' : '#EEF1F1'}
                    fontSize="5"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {site.rank}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex justify-between items-center text-xs font-mono text-sky-400 z-10">
          <span>
            CENTER: {observer.latDeg.toFixed(2)}°N, {observer.lonDeg.toFixed(2)}°E
          </span>
          <span className="text-brass-300">CLICK SITES TO INSPECT BREAKDOWN</span>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full min-h-[350px] bg-sky-950" />;
}
