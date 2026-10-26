import React, { useState } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { DEFAULT_DOME_RADIUS, formatAltitudeDeg, horizontalToCartesian } from '@astranet/shared';
import type { BelowHorizonPolicy, HorizonObject } from './types';

interface CelestialObjectMarkersProps {
  objects: HorizonObject[];
  selectedObjectId?: string | null;
  belowHorizonPolicy: BelowHorizonPolicy;
  radius?: number;
  onSelectObject: (object: HorizonObject) => void;
}

function getMarkerRadius(obj: HorizonObject, isSelected: boolean): number {
  let base = 0.22;
  if (typeof obj.magnitude === 'number' && Number.isFinite(obj.magnitude)) {
    // Sized by apparent magnitude: brighter = larger, capped nicely
    const clampedMag = Math.max(-5, Math.min(5, obj.magnitude));
    base = 0.26 - clampedMag * 0.012;
  }
  return isSelected ? base * 1.3 : base;
}

export const CelestialObjectMarkers: React.FC<CelestialObjectMarkersProps> = ({
  objects,
  selectedObjectId,
  belowHorizonPolicy,
  radius = DEFAULT_DOME_RADIUS,
  onSelectObject,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const visibleObjects = objects.filter((obj) => {
    if (belowHorizonPolicy === 'hidden' && obj.altitudeDeg < 0) {
      return false;
    }
    return true;
  });

  return (
    <group name="celestial-object-markers">
      {visibleObjects.map((obj) => {
        const isSelected = obj.id === selectedObjectId;
        const isHovered = obj.id === hoveredId;
        const isAboveHorizon = obj.altitudeDeg >= 0;
        const pos = horizontalToCartesian(obj.altitudeDeg, obj.azimuthDeg, radius);
        const markerRadius = getMarkerRadius(obj, isSelected);

        const displayColor = isAboveHorizon ? obj.color : '#627070';

        const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHoveredId(obj.id);
          document.body.style.cursor = 'pointer';
        };

        const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHoveredId((prev) => (prev === obj.id ? null : prev));
          document.body.style.cursor = 'auto';
        };

        const handleClick = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelectObject(obj);
        };

        return (
          <group key={obj.id} position={pos}>
            {/* 1. Expanded Invisible Hit Sphere for Touch & Click Accessibility */}
            <mesh
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={handleClick}
            >
              <sphereGeometry args={[0.45, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* 2. Core Celestial Sphere (preserves category color) */}
            <mesh>
              <sphereGeometry args={[markerRadius, 24, 24]} />
              <meshBasicMaterial
                color={displayColor}
                transparent={!isAboveHorizon}
                opacity={isAboveHorizon ? 1 : 0.35}
              />
            </mesh>

            {/* 3. Subtle Calibration Reticle Halo on Hover/Selection */}
            {(isSelected || isHovered) && (
              <mesh>
                <sphereGeometry args={[markerRadius * 1.6, 16, 16]} />
                <meshBasicMaterial
                  color="#c9b187"
                  wireframe
                  transparent
                  opacity={isSelected ? 0.6 : 0.25}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* 4. Floating Label Badge */}
            <Html position={[0, markerRadius + 0.36, 0]} center style={{ pointerEvents: 'none' }}>
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm whitespace-nowrap transition-colors duration-150 ${
                  isSelected
                    ? 'bg-black/95 border border-brass-400/80 text-white'
                    : isHovered
                      ? 'bg-black/90 border border-sky-700/80 text-sky-200'
                      : 'bg-black/75 border border-sky-800/40 text-sky-300'
                } ${!isAboveHorizon ? 'opacity-50' : ''}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: obj.color }}
                />
                <span className="font-jost text-[10px] font-medium uppercase tracking-wider">
                  {obj.name}
                </span>
                {(isSelected || isHovered) && (
                  <span className="font-mono text-[9px] text-brass-400 ml-0.5">
                    {formatAltitudeDeg(obj.altitudeDeg, 1)}
                  </span>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
