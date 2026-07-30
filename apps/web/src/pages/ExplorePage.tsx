import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAppStore } from '@/store';
import { getEffectiveLocation, fetchBrief, type DailyBrief } from '@/lib/api';
import { StarField } from '@/components/explore/StarField';
import { SkyDome } from '@/components/explore/SkyDome';
import {
  CameraController,
  type CameraFocusTarget,
  type GravityTarget,
} from '@/components/explore/CameraController';
import {
  CelestialMarkers,
  type CelestialObject,
  type DrillTarget,
  type ScreenPos,
} from '@/components/explore/CelestialMarkers';
import { interpolatePassPosition } from '@/lib/pass-interpolation';
import { ZOOM_FOV_MIDPOINTS_DEG } from '@/lib/semantic-zoom';
import { AuroralRing } from '@/components/explore/AuroralRing';
import { HeliospherePulse } from '@/components/explore/HeliospherePulse';
import { CardinalMarks } from '@/components/explore/CardinalMarks';
import { DiegeticTextMirror } from '@/components/explore/DiegeticTextMirror';
import { OpeningSequence, hasSeenOpeningSequence } from '@/components/explore/OpeningSequence';
import { useSpaceWeather } from '@/hooks/useSpaceWeather';
import {
  calculateCycleIndex,
  DEPTH_HOLD_THRESHOLDS_MS,
  type PanelDepth,
} from '@/lib/explore-interaction';

/** §11: "Persistent nav auto-hides after 3 seconds of camera motion." */
const NAV_AUTO_HIDE_MS = 3000;
/** §11: "...and returns on pointer-to-top-edge." */
const NAV_RETURN_EDGE_PX = 24;

export function ExplorePage(): React.ReactElement {
  const setNavVisible = useAppStore((s) => s.setNavVisible);

  const [sceneTime, setSceneTime] = useState(new Date());
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
  const [activeObjects, setActiveObjects] = useState<CelestialObject[]>([]);
  const [selectedDepth, setSelectedDepth] = useState<PanelDepth>(1);
  const [screenPosMap, setScreenPosMap] = useState<Record<string, ScreenPos>>({});
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  const holdTimerDepth2 = useRef<number | null>(null);
  const holdTimerDepth3 = useRef<number | null>(null);

  const stopDepthHold = useRef(() => {
    if (holdTimerDepth2.current !== null) {
      window.clearTimeout(holdTimerDepth2.current);
      holdTimerDepth2.current = null;
    }
    if (holdTimerDepth3.current !== null) {
      window.clearTimeout(holdTimerDepth3.current);
      holdTimerDepth3.current = null;
    }
  }).current;

  const startDepthHold = useRef(() => {
    stopDepthHold();
    // 500ms hold threshold -> Depth 2 (Measurements)
    holdTimerDepth2.current = window.setTimeout(() => {
      setSelectedDepth((d) => Math.max(d, 2) as PanelDepth);
    }, DEPTH_HOLD_THRESHOLDS_MS.depth2);
    // 1000ms hold threshold -> Depth 3 (Link deeper)
    holdTimerDepth3.current = window.setTimeout(() => {
      setSelectedDepth(3);
    }, DEPTH_HOLD_THRESHOLDS_MS.depth3);
  }).current;

  // §11 camera rig (0:20/0:40): 'lock' rides on the ISS until user input
  // breaks it; 'flyTo' is the semantic-zoom drill-in (cluster/shell click).
  const [focusTarget, setFocusTarget] = useState<CameraFocusTarget | null>(null);
  const focusRef = useRef<CameraFocusTarget | null>(null);
  focusRef.current = focusTarget;

  // §11 opening sequence — first visit only; later visits drop straight in.
  const [openingActive, setOpeningActive] = useState(() => !hasSeenOpeningSequence());

  // Live fast-tier Kp + solar wind over SSE — one connection feeds both the
  // Auroral Ring and the Heliosphere Pulse.
  const spaceWeather = useSpaceWeather();

  const navHideTimer = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setSceneTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loc = getEffectiveLocation();
    fetchBrief(loc.lat, loc.lon)
      .then((b) => setBrief(b))
      .catch((err) => console.warn('Failed to fetch brief for /explore:', err));
  }, []);

  useEffect(() => {
    return () => {
      if (navHideTimer.current !== null) window.clearTimeout(navHideTimer.current);
      stopDepthHold();
      setNavVisible(true);
    };
  }, [setNavVisible, stopDepthHold]);

  // §11 0:20 — clicking the ISS starts the cinematic rise-and-lock; clicking
  // anything else (or closing) releases it. Selection itself is unchanged.
  // §11 Three-depth hold: tap opens at Depth 1; holding down advances to Depth 2 & 3.
  const handleSelect = (obj: CelestialObject | null): void => {
    setSelectedObject(obj);
    setSelectedDepth(1);
    if (obj) {
      startDepthHold();
    } else {
      stopDepthHold();
    }
    if (obj?.type === 'iss') {
      setFocusTarget({
        id: 'iss',
        mode: 'lock',
        azimuthDeg: obj.azimuthDeg,
        altitudeDeg: obj.altitudeDeg,
        fovDeg: ZOOM_FOV_MIDPOINTS_DEG[0],
      });
    } else if (focusRef.current?.id === 'iss') {
      setFocusTarget(null);
    }
  };

  // Arrow-key object cycling per DESIGN_SPEC.md §11 / Phase 12 Requirement 2
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'Escape') {
        handleSelect(null);
        return;
      }

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp'
      ) {
        if (activeObjects.length === 0) return;
        e.preventDefault();

        const currentIndex = selectedObject
          ? activeObjects.findIndex((o) => o.id === selectedObject.id)
          : -1;
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 'next' : 'prev';
        const nextIndex = calculateCycleIndex(currentIndex, activeObjects.length, dir);
        const nextObj = activeObjects[nextIndex];
        if (nextObj) {
          handleSelect(nextObj);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeObjects, selectedObject]);

  // Semantic-zoom drill-in: cluster/shell click → cinematic zoom one level.
  const handleDrill = (target: DrillTarget): void => {
    setFocusTarget({ ...target, mode: 'flyTo' });
  };

  // While locked to the ISS, follow it along its pass (same shared
  // interpolation the marker itself uses — one source of truth). If the pass
  // ends mid-lock there is no position anymore: release quietly.
  useEffect(() => {
    if (focusRef.current?.id !== 'iss') return;
    const pass = brief?.iss?.status === 'ok' ? (brief.iss.data?.nextPass ?? null) : null;
    const pos = pass ? interpolatePassPosition(pass, sceneTime.getTime() / 1000) : null;
    if (pos === null) {
      setFocusTarget(null);
      return;
    }
    setFocusTarget((prev) =>
      prev?.id === 'iss'
        ? { ...prev, azimuthDeg: pos.azimuthDeg, altitudeDeg: pos.altitudeDeg }
        : prev,
    );
  }, [sceneTime, brief]);

  // Closing the panel (✕ sets selection null directly) also releases an ISS lock.
  useEffect(() => {
    if (selectedObject === null && focusRef.current?.id === 'iss') {
      setFocusTarget(null);
    }
  }, [selectedObject]);

  // §11 nav auto-hide: any camera motion (drag or zoom) starts a 3s clock.
  const onCameraMotion = (): void => {
    if (useAppStore.getState().navVisible) {
      if (navHideTimer.current !== null) window.clearTimeout(navHideTimer.current);
      navHideTimer.current = window.setTimeout(() => {
        navHideTimer.current = null;
        setNavVisible(false);
      }, NAV_AUTO_HIDE_MS);
    }
  };

  const onContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    setPointerPos({ x: e.clientX, y: e.clientY });
    // Dragging (buttons pressed) is camera motion.
    if (e.buttons !== 0) onCameraMotion();
    // §11: pointer at the top edge brings the nav back.
    if (e.clientY <= NAV_RETURN_EDGE_PX && !useAppStore.getState().navVisible) {
      setNavVisible(true);
    }
  };

  // Compute 2D screen positions of all selectable targets for 40px/60ms cursor gravity
  const gravityTargets = useMemo<GravityTarget[]>(() => {
    const targets: GravityTarget[] = [];
    for (const [id, pos] of Object.entries(screenPosMap)) {
      if (pos && pos.inView && pos.azimuthDeg !== undefined && pos.altitudeDeg !== undefined) {
        targets.push({
          id,
          azimuthDeg: pos.azimuthDeg,
          altitudeDeg: pos.altitudeDeg,
          screenX: pos.x,
          screenY: pos.y,
        });
      }
    }
    return targets;
  }, [screenPosMap]);

  const loc = getEffectiveLocation();
  const latStr = `${Math.abs(loc.lat).toFixed(2)}°${loc.lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(loc.lon).toFixed(2)}°${loc.lon >= 0 ? 'E' : 'W'}`;
  const timeStr = sceneTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const overlayText = `${latStr} ${lonStr} · ${timeStr} LOCAL`;

  const selectedPos = selectedObject ? screenPosMap[selectedObject.id] : null;

  let panelX = 0;
  let panelY = 0;
  if (selectedPos) {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    panelX = Math.min(windowWidth - 400, Math.max(20, selectedPos.x + 30));
    panelY = Math.min(windowHeight - 240, Math.max(90, selectedPos.y - 80));
  }

  return (
    <div
      id="main-content"
      className="fixed inset-0 bg-sky-950 flex flex-col select-none"
      aria-label="Explorable Universe — 3D scene"
      onPointerMove={onContainerPointerMove}
      onWheel={onCameraMotion}
    >
      {/* DESIGN_SPEC.md §11 - Opening sequence static overlay */}
      <div className="absolute top-8 left-0 right-0 z-10 text-center pointer-events-none">
        <p className="type-micro text-sky-200 uppercase tracking-widest">{overlayText}</p>
      </div>

      <Canvas
        camera={{
          position: [0, 0, 0],
          rotation: [Math.PI / 8, 0, 0],
          fov: 60,
        }}
      >
        <CameraController
          focusTarget={focusTarget}
          onFocusRelease={() => setFocusTarget(null)}
          gravityTargets={gravityTargets}
          pointerPos={pointerPos}
        />
        <StarField observerLat={loc.lat} observerLon={loc.lon} currentTime={sceneTime} />
        <SkyDome />
        <CelestialMarkers
          brief={brief}
          currentTime={sceneTime}
          selectedId={selectedObject?.id ?? null}
          onSelect={handleSelect}
          onObjectsChange={(objs) => setActiveObjects(objs)}
          onUpdateScreenPos={(map) => setScreenPosMap(map)}
          onDrill={handleDrill}
        />
        <AuroralRing observerLat={loc.lat} observerLon={loc.lon} kp={spaceWeather.kp} />
        <HeliospherePulse
          brief={brief}
          solarWindSpeedKmS={spaceWeather.solarWindSpeedKmS}
          healthy={spaceWeather.healthy}
        />
        <CardinalMarks />
      </Canvas>

      {/* §11 — invisible DOM mirror of all diegetic text, for screen readers */}
      <DiegeticTextMirror />

      {/* §11 — first-visit cinematic: black veil + centered mono line; the sky
          fades up at 0:04. Subsequent visits skip it entirely. */}
      {openingActive && (
        <OpeningSequence overlayText={overlayText} onDone={() => setOpeningActive(false)} />
      )}

      {/* DESIGN_SPEC.md §11 - Tethered Info Panel (Three Depths: sentence → measurements → link) */}
      {selectedObject && selectedPos && selectedPos.inView && (
        <>
          {/* 1px Brass Tether Line */}
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            <line
              x1={selectedPos.x}
              y1={selectedPos.y}
              x2={panelX}
              y2={panelY + 40}
              stroke="#C9B187"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <circle cx={selectedPos.x} cy={selectedPos.y} r="4" fill="#C9B187" />
          </svg>

          {/* Info Panel Container (max 380px wide, backdrop blur, progressive order) */}
          <div
            style={{ left: `${panelX}px`, top: `${panelY}px` }}
            className="absolute z-30 max-w-[380px] w-[calc(100vw-40px)] backdrop-blur-md bg-sky-950/90 border border-brass-300/40 p-5 rounded-none shadow-2xl transition-all duration-300"
            onPointerDown={startDepthHold}
            onPointerUp={stopDepthHold}
            onPointerLeave={stopDepthHold}
          >
            <div className="flex items-center justify-between border-b border-sky-600/40 pb-2 mb-3">
              <span className="type-micro text-brass-300 uppercase tracking-wider font-mono">
                {selectedObject.name} · CELESTIAL OBJECT
              </span>
              <div className="flex items-center gap-2">
                {/* Three-Depth Step Indicators [1] [2] [3] for direct accessibility */}
                <div className="flex items-center gap-1 font-mono type-micro text-sky-400">
                  <button
                    type="button"
                    onClick={() => setSelectedDepth(1)}
                    title="Depth 1: One-sentence story"
                    className={`min-w-[44px] min-h-[44px] px-2 py-1 border text-xs cursor-pointer transition-colors flex items-center justify-center ${
                      selectedDepth >= 1
                        ? 'border-brass-300 text-brass-300 bg-brass-300/10 font-bold'
                        : 'border-sky-800 text-sky-400'
                    }`}
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDepth(2)}
                    title="Depth 2: Live measurements"
                    className={`min-w-[44px] min-h-[44px] px-2 py-1 border text-xs cursor-pointer transition-colors flex items-center justify-center ${
                      selectedDepth >= 2
                        ? 'border-brass-300 text-brass-300 bg-brass-300/10 font-bold'
                        : 'border-sky-800 text-sky-400'
                    }`}
                  >
                    2
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDepth(3)}
                    title="Depth 3: Deep data link"
                    className={`min-w-[44px] min-h-[44px] px-2 py-1 border text-xs cursor-pointer transition-colors flex items-center justify-center ${
                      selectedDepth >= 3
                        ? 'border-brass-300 text-brass-300 bg-brass-300/10 font-bold'
                        : 'border-sky-800 text-sky-400'
                    }`}
                  >
                    3
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedObject(null)}
                  className="text-sky-400 hover:text-sky-100 text-sm font-mono leading-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Close celestial object details"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Depth 1: Plain sentence (serif) */}
            <p className="font-serif text-body text-sky-100 mb-3 leading-relaxed">
              {selectedObject.sentence}
            </p>

            {/* Depth 2 (Hold 500ms / Depth >= 2): Measurements (mono) */}
            {selectedDepth >= 2 && (
              <p className="font-mono text-caption text-brass-300 mb-4 bg-sky-900/60 p-2 border-l-2 border-brass-300 transition-all duration-300">
                {selectedObject.measurements}
              </p>
            )}

            {/* Depth 3 (Hold 1000ms / Depth >= 3): Link deeper */}
            {selectedDepth >= 3 ? (
              <a
                href={selectedObject.linkHref}
                className="type-micro text-ember-400 hover:text-ember-400/80 min-h-[44px] inline-flex items-center gap-1 uppercase tracking-wider font-mono transition-colors"
              >
                {selectedObject.linkText} →
              </a>
            ) : (
              <div className="type-micro text-sky-400 font-mono text-[10px] tracking-wider opacity-75 pt-1">
                {selectedDepth === 1
                  ? 'HOLD TO REVEAL MEASUREMENTS [STEP 1/3]'
                  : 'HOLD LONGER FOR FULL DATA [STEP 2/3]'}
              </div>
            )}
          </div>
        </>
      )}

      {/* Accessible Screen-Reader Mirror */}
      <div className="sr-only" aria-live="polite">
        <h2>Interactive Celestial Objects in Scene</h2>
        <p>Use Left and Right Arrow keys or activate buttons below to cycle objects.</p>
        <ul>
          {activeObjects.map((obj) => (
            <li key={obj.id}>
              <button
                type="button"
                onClick={() => handleSelect(obj)}
                aria-pressed={selectedObject?.id === obj.id}
              >
                {obj.name}: {obj.sentence}
              </button>
            </li>
          ))}
        </ul>
        {selectedObject && (
          <div>
            <h3>Selected: {selectedObject.name}</h3>
            <p>{selectedObject.sentence}</p>
            <p>{selectedObject.measurements}</p>
          </div>
        )}
      </div>
    </div>
  );
}
