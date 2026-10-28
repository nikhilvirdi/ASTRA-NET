import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  buildAltitudeArcPoints,
  buildAltitudeRingPoints,
  cartesianToHorizontal,
  DEFAULT_DOME_RADIUS,
  formatAltitudeDeg,
  formatAzimuthDeg,
  horizontalToCartesian,
} from '@astranet/shared';
import type { HorizontalCoordinates } from './types';

interface HorizonDomeProps {
  radius?: number;
  showLowerHemisphere: boolean;
  enableDomeInspection: boolean;
  inspectedCoords: HorizontalCoordinates | null;
  onInspectCoordinates: (coords: HorizontalCoordinates | null) => void;
}

const CARDINALS = [
  { label: 'N', az: 0, primary: true, isNorth: true },
  { label: 'NE', az: 45, primary: false },
  { label: 'E', az: 90, primary: true },
  { label: 'SE', az: 135, primary: false },
  { label: 'S', az: 180, primary: true },
  { label: 'SW', az: 225, primary: false },
  { label: 'W', az: 270, primary: true },
  { label: 'NW', az: 315, primary: false },
];

function pointsToGeometry(points: [number, number, number][]): THREE.BufferGeometry {
  const flat = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt) {
      flat[i * 3] = pt[0];
      flat[i * 3 + 1] = pt[1];
      flat[i * 3 + 2] = pt[2];
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(flat, 3));
  return geom;
}

export const HorizonDome: React.FC<HorizonDomeProps> = ({
  radius = DEFAULT_DOME_RADIUS,
  showLowerHemisphere,
  enableDomeInspection,
  inspectedCoords,
  onInspectCoordinates,
}) => {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Build static geometries
  const geometries = useMemo(() => {
    // 1. Primary Horizon Ring (Alt = 0°)
    const horizonRing = pointsToGeometry(buildAltitudeRingPoints(0, radius, 128));

    // 2. Concentric planar reference rings on horizon
    const innerRing1 = pointsToGeometry(buildAltitudeRingPoints(0, radius * 0.35, 64));
    const innerRing2 = pointsToGeometry(buildAltitudeRingPoints(0, radius * 0.7, 96));

    // 3. Upper altitude rings (+30°, +60°)
    const alt30Ring = pointsToGeometry(buildAltitudeRingPoints(30, radius, 96));
    const alt60Ring = pointsToGeometry(buildAltitudeRingPoints(60, radius, 96));

    // 4. Lower altitude ring (-30°)
    const altMinus30Ring = pointsToGeometry(buildAltitudeRingPoints(-30, radius, 72));

    // 5. Meridians (N-S and E-W)
    const meridianNS = pointsToGeometry(
      buildAltitudeArcPoints(0, 0, 90, radius, 48).concat(
        buildAltitudeArcPoints(180, 90, 0, radius, 48),
      ),
    );
    const meridianEW = pointsToGeometry(
      buildAltitudeArcPoints(90, 0, 90, radius, 48).concat(
        buildAltitudeArcPoints(270, 90, 0, radius, 48),
      ),
    );

    // 6. Intercardinal meridians (NE-SW and NW-SE)
    const meridianNESW = pointsToGeometry(
      buildAltitudeArcPoints(45, 0, 90, radius, 36).concat(
        buildAltitudeArcPoints(225, 90, 0, radius, 36),
      ),
    );
    const meridianNWSE = pointsToGeometry(
      buildAltitudeArcPoints(315, 0, 90, radius, 36).concat(
        buildAltitudeArcPoints(135, 90, 0, radius, 36),
      ),
    );

    // 7. Horizon degree tick marks every 10° around the rim
    const ticks: number[] = [];
    // Crosshair axes
    ticks.push(0, 0, -radius, 0, 0, radius);
    ticks.push(-radius, 0, 0, radius, 0, 0);
    // Vertical zenith plumb line
    ticks.push(0, 0, 0, 0, radius, 0);

    for (let deg = 0; deg < 360; deg += 10) {
      const isMajor = deg % 30 === 0;
      const innerR = isMajor ? radius * 0.94 : radius * 0.97;
      const p1 = horizontalToCartesian(0, deg, innerR);
      const p2 = horizontalToCartesian(0, deg, radius);
      ticks.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    }

    const ticksGeometry = new THREE.BufferGeometry();
    ticksGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ticks), 3));

    return {
      horizonRing,
      innerRing1,
      innerRing2,
      alt30Ring,
      alt60Ring,
      altMinus30Ring,
      meridianNS,
      meridianEW,
      meridianNESW,
      meridianNWSE,
      ticksGeometry,
    };
  }, [radius]);

  const lines = useMemo(() => {
    return {
      horizonRing: new THREE.Line(
        geometries.horizonRing,
        new THREE.LineBasicMaterial({ color: '#c9b187', transparent: true, opacity: 0.45 }),
      ),
      innerRing1: new THREE.Line(
        geometries.innerRing1,
        new THREE.LineBasicMaterial({ color: '#2a3434', transparent: true, opacity: 0.2 }),
      ),
      innerRing2: new THREE.Line(
        geometries.innerRing2,
        new THREE.LineBasicMaterial({ color: '#2a3434', transparent: true, opacity: 0.2 }),
      ),
      alt30Ring: new THREE.Line(
        geometries.alt30Ring,
        new THREE.LineBasicMaterial({ color: '#2a3434', transparent: true, opacity: 0.25 }),
      ),
      alt60Ring: new THREE.Line(
        geometries.alt60Ring,
        new THREE.LineBasicMaterial({ color: '#2a3434', transparent: true, opacity: 0.25 }),
      ),
      altMinus30Ring: new THREE.Line(
        geometries.altMinus30Ring,
        new THREE.LineBasicMaterial({ color: '#1c2424', transparent: true, opacity: 0.15 }),
      ),
      meridianNS: new THREE.Line(
        geometries.meridianNS,
        new THREE.LineBasicMaterial({ color: '#2a3434', transparent: true, opacity: 0.3 }),
      ),
      meridianEW: new THREE.Line(
        geometries.meridianEW,
        new THREE.LineBasicMaterial({ color: '#2a3434', transparent: true, opacity: 0.3 }),
      ),
      meridianNESW: new THREE.Line(
        geometries.meridianNESW,
        new THREE.LineBasicMaterial({ color: '#1c2424', transparent: true, opacity: 0.15 }),
      ),
      meridianNWSE: new THREE.Line(
        geometries.meridianNWSE,
        new THREE.LineBasicMaterial({ color: '#1c2424', transparent: true, opacity: 0.15 }),
      ),
    };
  }, [geometries]);

  // Clean up geometries and materials on unmount
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((geom) => geom.dispose());
      Object.values(lines).forEach((line) => {
        if (Array.isArray(line.material)) {
          line.material.forEach((m: THREE.Material) => {
            m.dispose();
          });
        } else {
          line.material.dispose();
        }
      });
    };
  }, [geometries, lines]);

  const inspectedPos = useMemo(() => {
    if (!inspectedCoords) return null;
    return horizontalToCartesian(inspectedCoords.altitudeDeg, inspectedCoords.azimuthDeg, radius);
  }, [inspectedCoords, radius]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!enableDomeInspection || !pointerDownPos.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    pointerDownPos.current = null;

    // Reject camera drag, only respond to stationary click
    if (Math.hypot(dx, dy) < 5) {
      e.stopPropagation();
      const coords = cartesianToHorizontal(e.point.x, e.point.y, e.point.z);
      onInspectCoordinates(coords);
    }
  };

  return (
    <group name="horizon-dome">
      {/* 1. Invisible Raycast Upper Celestial Hemisphere Shell */}
      <mesh
        onPointerDown={enableDomeInspection ? handlePointerDown : undefined}
        onPointerUp={enableDomeInspection ? handlePointerUp : undefined}
      >
        <sphereGeometry
          args={[radius, 48, 24, 0, Math.PI * 2, 0, showLowerHemisphere ? Math.PI : Math.PI / 2]}
        />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* 2. Horizon Ring (Alt = 0°) — restrained brass calibration ring */}
      <primitive object={lines.horizonRing} />

      {/* 4. Concentric planar reference rings */}
      <primitive object={lines.innerRing1} />
      <primitive object={lines.innerRing2} />

      {/* 5. Upper Altitude Rings (+30°, +60°) — subdued hairline gridlines */}
      <primitive object={lines.alt30Ring} />
      <primitive object={lines.alt60Ring} />

      {/* 6. Lower Altitude Ring (-30°) when enabled */}
      {showLowerHemisphere && <primitive object={lines.altMinus30Ring} />}

      {/* 7. Principal Meridian Arcs */}
      <primitive object={lines.meridianNS} />
      <primitive object={lines.meridianEW} />

      {/* 8. Intercardinal Meridian Arcs */}
      <primitive object={lines.meridianNESW} />
      <primitive object={lines.meridianNWSE} />

      {/* 9. Horizon Ticks, Crosshairs & Zenith Axis */}
      <lineSegments geometry={geometries.ticksGeometry}>
        <lineBasicMaterial color="#2a3434" transparent opacity={0.35} />
      </lineSegments>

      {/* 10. Observer Origin Marker (0, 0, 0) */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#c9b187" />
      </mesh>

      {/* 11. Zenith Marker (+90° Altitude) */}
      <group position={[0, radius, 0]}>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#c9b187" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.22, 24]} />
          <meshBasicMaterial color="#9a8258" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[0, 0.42, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-black/90 border border-sky-800/60 whitespace-nowrap">
            <span className="font-jost text-[9px] uppercase tracking-wider text-brass-400 font-medium">
              ZENITH
            </span>
            <span className="font-mono text-[8px] text-sky-400">+90°</span>
          </div>
        </Html>
      </group>

      {/* 12. Altitude Degree Badges on North Meridian (+30°, +60°) */}
      {[30, 60].map((alt) => {
        const pos = horizontalToCartesian(alt, 0, radius);
        return (
          <Html key={`alt-badge-${alt}`} position={pos} center style={{ pointerEvents: 'none' }}>
            <span className="px-1 py-0.2 rounded-sm bg-black/80 font-mono text-[8px] text-brass-500/70 border border-sky-800/40">
              +{alt}°
            </span>
          </Html>
        );
      })}

      {/* 13. Compass Cardinal & Intercardinal Labels around Horizon */}
      {CARDINALS.map((cardinal) => {
        const labelR = cardinal.primary ? radius * 1.1 : radius * 1.07;
        const pos = horizontalToCartesian(0, cardinal.az, labelR);
        const rimPos = horizontalToCartesian(0, cardinal.az, radius);

        return (
          <group key={cardinal.label}>
            {cardinal.primary && (
              <mesh position={rimPos}>
                <sphereGeometry args={[0.07, 12, 12]} />
                <meshBasicMaterial color={cardinal.isNorth ? '#c9b187' : '#9a8258'} />
              </mesh>
            )}
            <Html position={pos} center style={{ pointerEvents: 'none' }}>
              <div className="flex flex-col items-center leading-tight">
                <span
                  className={`font-jost text-center ${
                    cardinal.isNorth
                      ? 'text-xs text-brass-400 font-semibold tracking-wider'
                      : cardinal.primary
                        ? 'text-[11px] text-brass-500/90 font-medium tracking-wider'
                        : 'text-[9px] text-sky-500 font-normal tracking-wide'
                  }`}
                >
                  {cardinal.label}
                </span>
                <span className="font-mono text-[8px] text-sky-500/80">
                  {formatAzimuthDeg(cardinal.az, 0, false)}
                </span>
              </div>
            </Html>
          </group>
        );
      })}

      {/* 14. Inspected Arbitrary Dome Point Marker */}
      {inspectedCoords && inspectedPos && (
        <group position={inspectedPos}>
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="#c9b187" wireframe />
          </mesh>
          <Html position={[0, 0.42, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-black/90 border border-brass-500/50 font-mono text-[9px] text-brass-300 whitespace-nowrap">
              <span className="font-jost uppercase tracking-wider text-brass-400 font-medium">
                PROBE
              </span>
              <span>
                {formatAltitudeDeg(inspectedCoords.altitudeDeg, 1)} ·{' '}
                {formatAzimuthDeg(inspectedCoords.azimuthDeg, 1, false)}
              </span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
