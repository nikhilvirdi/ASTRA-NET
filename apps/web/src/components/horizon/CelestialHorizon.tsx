import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  DEFAULT_DOME_RADIUS,
  formatAltitudeDeg,
  formatAzimuthDeg,
  isValidHorizonCoordinates,
} from '@astranet/shared';
import { HorizonDome } from './HorizonDome';
import { SelectionGuides } from './SelectionGuides';
import { CelestialObjectMarkers } from './CelestialObjectMarkers';
import type {
  BelowHorizonPolicy,
  CelestialHorizonProps,
  HorizontalCoordinates,
  HorizonObject,
} from './types';

const INITIAL_CAMERA_POSITION: [number, number, number] = [16.1, 12.0, 18.7];
const CAMERA_TARGET: [number, number, number] = [0, 1.8, 0];

export const CelestialHorizon: React.FC<CelestialHorizonProps> = ({
  objects,
  selectedObjectId = null,
  onSelectObject,
  observerLatitudeDeg,
  observerLongitudeDeg,
  belowHorizonPolicy: initialBelowHorizonPolicy = 'dimmed',
  enableDomeInspection = true,
  height = 300,
  className = '',
}) => {
  const orbitControlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedObjectId ?? (objects.length > 0 ? objects[0].id : null),
  );
  const [belowHorizonPolicy] = useState<BelowHorizonPolicy>(initialBelowHorizonPolicy);
  const [inspectedCoords, setInspectedCoords] = useState<HorizontalCoordinates | null>(null);

  // Filter valid objects with finite coordinates
  const validObjects = useMemo(
    () =>
      objects.filter((obj) =>
        isValidHorizonCoordinates({
          altitudeDeg: obj.altitudeDeg,
          azimuthDeg: obj.azimuthDeg,
        }),
      ),
    [objects],
  );

  const activeSelectedId = selectedObjectId !== undefined ? selectedObjectId : internalSelectedId;

  const selectedObject: HorizonObject | null = useMemo(() => {
    if (!activeSelectedId) return null;
    return validObjects.find((obj) => obj.id === activeSelectedId) ?? null;
  }, [validObjects, activeSelectedId]);

  const handleSelectObject = useCallback(
    (obj: HorizonObject | null) => {
      setInspectedCoords(null);
      if (selectedObjectId === undefined) {
        setInternalSelectedId((prev) => (prev === obj?.id ? null : obj ? obj.id : null));
      }
      onSelectObject?.(obj);
    },
    [onSelectObject, selectedObjectId],
  );

  const handleResetCamera = useCallback(() => {
    const controls = orbitControlsRef.current;
    if (!controls) return;
    controls.object.position.set(...INITIAL_CAMERA_POSITION);
    controls.target.set(...CAMERA_TARGET);
    controls.update();
  }, []);

  const observerLocationLabel = useMemo(() => {
    if (typeof observerLatitudeDeg !== 'number' || typeof observerLongitudeDeg !== 'number') {
      return 'LOCAL HORIZONTAL FRAME · TOPOCENTRIC';
    }
    const latDir = observerLatitudeDeg >= 0 ? 'N' : 'S';
    const lonDir = observerLongitudeDeg >= 0 ? 'E' : 'W';
    return `OBS ${Math.abs(observerLatitudeDeg).toFixed(2)}°${latDir}, ${Math.abs(
      observerLongitudeDeg,
    ).toFixed(2)}°${lonDir} · TOPOCENTRIC`;
  }, [observerLatitudeDeg, observerLongitudeDeg]);

  // Touchpad pinch-to-zoom & trackpad scroll gesture handler:
  // Allows natural touchpad pinch-to-zoom (WheelEvent with ctrlKey: true)
  // while preserving ordinary page scrolling when swiping with two fingers.
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const handleWheelCapture = (e: WheelEvent) => {
      // If it's a touchpad pinch-to-zoom or Ctrl/Cmd + scroll:
      // Allow OrbitControls to handle it and zoom centered on the model.
      if (e.ctrlKey || e.metaKey) {
        return;
      }

      // Ordinary two-finger trackpad or mouse scroll without modifier:
      // Stop the event before OrbitControls' listener intercepts and cancels it.
      // Do NOT preventDefault, so the webpage scrolls naturally down the page.
      e.stopImmediatePropagation();
    };

    // Safari on macOS native trackpad pinch gesture handlers
    let lastGestureScale = 1;
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      lastGestureScale = 1;
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const gestureEvent = e as unknown as { scale: number };
      const controls = orbitControlsRef.current;
      if (!controls) return;
      const factor = gestureEvent.scale / lastGestureScale;
      lastGestureScale = gestureEvent.scale;
      if (factor > 1) {
        controls.dollyIn(factor);
      } else if (factor < 1) {
        controls.dollyOut(1 / factor);
      }
      controls.update();
    };

    container.addEventListener('wheel', handleWheelCapture, { capture: true, passive: false });
    container.addEventListener('gesturestart', handleGestureStart, { passive: false });
    container.addEventListener('gesturechange', handleGestureChange, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheelCapture, { capture: true });
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
    };
  }, []);

  const viewportStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`relative w-full flex flex-col select-none ${className}`.trim()}
      aria-label={`Celestial Horizon 3D View${observerLocationLabel ? ` — ${observerLocationLabel}` : ''}`}
    >
      {/* ─── 3D Celestial Horizon Canvas Viewport (Transparent) ───────── */}
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden outline-none focus:outline-none"
        style={viewportStyle}
        onDoubleClick={handleResetCamera}
        title="Double-click to reset view"
      >
        {/* Floating Telemetry Readout Panel */}
        {selectedObject && (
          <div className="absolute top-3 right-3 z-10 w-64 sm:w-72 bg-black/85 backdrop-blur-sm border border-sky-800/60 rounded-sm p-3 pointer-events-auto">
            <div className="flex items-center justify-between gap-2 border-b border-sky-800/40 pb-2 mb-2">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedObject.color }}
                />
                <span className="font-jost text-xs font-semibold text-white uppercase tracking-wider truncate">
                  {selectedObject.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm shrink-0 ${
                    selectedObject.isAboveHorizon
                      ? 'bg-aurora/15 text-aurora border border-aurora/30'
                      : 'bg-sky-800/40 text-sky-400 border border-sky-700/50'
                  }`}
                >
                  {selectedObject.isAboveHorizon ? 'VISIBLE' : 'BELOW HORIZON'}
                </span>
                <button
                  type="button"
                  title="Deselect celestial object"
                  onClick={() => handleSelectObject(null)}
                  className="font-mono text-xs text-sky-400 hover:text-white px-1 leading-none cursor-pointer"
                  aria-label="Close telemetry readout"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono mb-2">
              <div className="bg-sky-950/60 rounded-sm p-1.5 border border-sky-800/40">
                <span className="font-jost text-[8px] uppercase tracking-wider text-sky-400 block font-medium">
                  ALTITUDE
                </span>
                <span
                  className={`text-xs font-medium ${
                    selectedObject.isAboveHorizon ? 'text-brass-300' : 'text-ember-400'
                  }`}
                >
                  {formatAltitudeDeg(selectedObject.altitudeDeg, 2)}
                </span>
              </div>

              <div className="bg-sky-950/60 rounded-sm p-1.5 border border-sky-800/40">
                <span className="font-jost text-[8px] uppercase tracking-wider text-sky-400 block font-medium">
                  AZIMUTH
                </span>
                <span className="text-xs font-medium text-brass-300">
                  {formatAzimuthDeg(selectedObject.azimuthDeg, 1, true)}
                </span>
              </div>
            </div>

            <p className="font-jost text-[11px] text-sky-300 leading-snug mb-1">
              {selectedObject.description}
            </p>

            {selectedObject.sourceNote && (
              <div className="font-mono text-[9px] text-sky-500 uppercase tracking-tight truncate">
                REF: {selectedObject.sourceNote}
              </div>
            )}

            {inspectedCoords && (
              <div className="mt-2 pt-1.5 border-t border-dashed border-sky-800/60 flex items-center justify-between font-mono text-[9px] text-brass-400">
                <span>
                  PROBE: {formatAltitudeDeg(inspectedCoords.altitudeDeg, 1)} /{' '}
                  {formatAzimuthDeg(inspectedCoords.azimuthDeg, 1, false)}
                </span>
                <button
                  type="button"
                  onClick={() => setInspectedCoords(null)}
                  className="text-sky-400 hover:text-white underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Canvas */}
        <Canvas
          dpr={[1, 2]}
          camera={{
            position: INITIAL_CAMERA_POSITION,
            fov: 38,
            near: 0.1,
            far: 200,
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(0x000000, 0);
            scene.background = null;
          }}
          style={{ background: 'transparent', outline: 'none' }}
        >
          <HorizonDome
            radius={DEFAULT_DOME_RADIUS}
            showLowerHemisphere={belowHorizonPolicy === 'dimmed'}
            enableDomeInspection={enableDomeInspection}
            inspectedCoords={inspectedCoords}
            onInspectCoordinates={setInspectedCoords}
          />

          <SelectionGuides selectedObject={selectedObject} radius={DEFAULT_DOME_RADIUS} />

          <CelestialObjectMarkers
            objects={validObjects}
            selectedObjectId={selectedObject?.id}
            belowHorizonPolicy={belowHorizonPolicy}
            radius={DEFAULT_DOME_RADIUS}
            onSelectObject={handleSelectObject}
          />

          <OrbitControls
            ref={orbitControlsRef}
            target={CAMERA_TARGET}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.65}
            zoomSpeed={0.8}
            enableZoom={true}
            minDistance={14}
            maxDistance={42}
            minPolarAngle={0.08}
            maxPolarAngle={belowHorizonPolicy === 'dimmed' ? Math.PI * 0.62 : Math.PI * 0.48}
          />
        </Canvas>
      </div>
    </div>
  );
};
