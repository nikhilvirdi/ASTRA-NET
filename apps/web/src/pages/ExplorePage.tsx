import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAppStore } from '@/store';
import { getEffectiveLocation } from '@/lib/api';
import { StarField } from '@/components/explore/StarField';
import { SkyDome } from '@/components/explore/SkyDome';

export function ExplorePage(): React.ReactElement {
  const setNavVisible = useAppStore((s) => s.setNavVisible);

  // Time state to allow future scrubbing
  const [sceneTime, setSceneTime] = useState(new Date());

  useEffect(() => {
    // Keep time updated, runs once per minute to match the "LOCAL" time format
    const interval = setInterval(() => setSceneTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // On unmount, restore nav visibility (leaving /explore)
  useEffect(() => {
    return () => setNavVisible(true);
  }, [setNavVisible]);

  const loc = getEffectiveLocation();
  const latStr = `${Math.abs(loc.lat).toFixed(2)}°${loc.lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(loc.lon).toFixed(2)}°${loc.lon >= 0 ? 'E' : 'W'}`;
  const timeStr = sceneTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const overlayText = `${latStr} ${lonStr} · ${timeStr} LOCAL`;

  return (
    <div
      id="main-content"
      className="fixed inset-0 bg-sky-950 flex flex-col"
      aria-label="Explorable Universe — 3D scene"
    >
      {/* DESIGN_SPEC.md §11 - Opening sequence static overlay */}
      <div className="absolute top-8 left-0 right-0 z-10 text-center pointer-events-none">
        <p className="type-micro text-sky-200 uppercase tracking-widest">{overlayText}</p>
      </div>

      <Canvas
        camera={{
          position: [0, 0, 0],
          rotation: [Math.PI / 8, 0, 0], // look slightly up (~22.5 deg)
          fov: 60,
        }}
      >
        <StarField observerLat={loc.lat} observerLon={loc.lon} currentTime={sceneTime} />
        <SkyDome />
      </Canvas>
    </div>
  );
}
