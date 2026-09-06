import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  type ConstellationData,
  buildConstellationLinePositions,
  computeVisibleConstellationLabels,
  celestialPoleAxis,
  siderealRotationAngleRad,
} from '@/lib/constellation-lines';
import { cssColorToken } from '@/lib/color';
import { DiegeticText, JOST_BOLD_FONT_URL } from './DiegeticText';

interface ConstellationLinesProps {
  observerLat: number;
  observerLon: number;
  currentTime: Date;
  visible?: boolean;
}

interface BuiltConstellationGeometry {
  geometry: THREE.BufferGeometry;
  referenceTime: Date;
}

export function ConstellationLines({
  observerLat,
  observerLon,
  currentTime,
  visible = true,
}: ConstellationLinesProps): React.ReactElement | null {
  const [data, setData] = useState<ConstellationData[] | null>(null);
  const lineSegmentsRef = useRef<THREE.LineSegments>(null);

  // Fetch static constellation figures JSON once
  useEffect(() => {
    let mounted = true;
    fetch('/data/constellations.json')
      .then((res) => res.json())
      .then((json: ConstellationData[]) => {
        if (mounted) setData(json);
      })
      .catch((err) => console.error('Failed to load constellations.json', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Subtle line color matching SkyDome's horizon line convention (--color-sky-600 / #3e4a4a)
  const lineColor = useMemo(() => cssColorToken('--color-sky-600', '#3e4a4a'), []);

  // Built once per catalog + observer location — matches StarField.tsx.
  // Rigorous single-draw-call LineSegments geometry for all 88 IAU constellations.
  const built = useMemo<BuiltConstellationGeometry | null>(() => {
    if (!data) return null;

    const positions = buildConstellationLinePositions(data, observerLat, observerLon, currentTime);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, referenceTime: currentTime };
  }, [data, observerLat, observerLon]);

  // GPU buffer cleanup
  useEffect(() => {
    return () => {
      built?.geometry.dispose();
    };
  }, [built]);

  // Rotate entire constellation wireframe in lockstep with StarField.tsx
  useEffect(() => {
    if (!built || !lineSegmentsRef.current) return;
    const axis = celestialPoleAxis(observerLat);
    const axisVec = new THREE.Vector3(axis.x, axis.y, axis.z);
    const angleRad = siderealRotationAngleRad(built.referenceTime, currentTime);
    lineSegmentsRef.current.setRotationFromAxisAngle(axisVec, angleRad);
  }, [built, observerLat, currentTime]);

  // Floating labels: compute only for constellations currently at least partially above horizon.
  // Positioned in scene units facing the observer, matching ClusterMarker in CelestialMarkers.tsx.
  const visibleLabels = useMemo(() => {
    if (!data || !visible) return [];
    return computeVisibleConstellationLabels(data, observerLat, observerLon, currentTime);
  }, [data, observerLat, observerLon, currentTime, visible]);

  if (!visible || !built) return null;

  return (
    <group>
      {/* 1 single draw call for all constellation lines across the sky */}
      <lineSegments ref={lineSegmentsRef} geometry={built.geometry}>
        <lineBasicMaterial color={lineColor} transparent={true} opacity={0.4} depthWrite={false} />
      </lineSegments>

      {/* Floating labels for constellations currently above the horizon */}
      {visibleLabels.map((l) => (
        <DiegeticText
          key={l.id}
          text={l.name.toUpperCase()}
          position={l.position}
          fontSize={12}
          fontUrl={JOST_BOLD_FONT_URL}
          colorToken="--color-sky-200"
          colorFallback="#d6dcdc"
          opacity={0.65}
        />
      ))}
    </group>
  );
}
