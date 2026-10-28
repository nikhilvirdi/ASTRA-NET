import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  clampAltitudeDeg,
  DEFAULT_DOME_RADIUS,
  formatAltitudeDeg,
  formatAzimuthDeg,
  horizontalToCartesian,
  horizontalToHorizonProjection,
  lerpAzimuthDeg,
  normalizeAzimuthDeg,
} from '@astranet/shared';
import type { HorizonObject } from './types';

interface SelectionGuidesProps {
  selectedObject: HorizonObject | null;
  radius?: number;
}

const ALT_ARC_SEGMENTS = 48;
const AZ_ARC_SEGMENTS = 64;

export const SelectionGuides: React.FC<SelectionGuidesProps> = ({
  selectedObject,
  radius = DEFAULT_DOME_RADIUS,
}) => {
  const animatedCoords = useRef<{
    alt: number;
    az: number;
    initialized: boolean;
  }>({
    alt: 0,
    az: 0,
    initialized: false,
  });

  const altArcLineRef = useRef<THREE.Line>(null);
  const azArcLineRef = useRef<THREE.Line>(null);
  const vectorsLineRef = useRef<THREE.LineSegments>(null);
  const azSectorMeshRef = useRef<THREE.Mesh>(null);

  // Pre-allocate mutable BufferGeometries to prevent per-frame allocations
  const { altArcGeometry, azArcGeometry, vectorsGeometry, azSectorGeometry } = useMemo(() => {
    const altArcGeom = new THREE.BufferGeometry();
    altArcGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((ALT_ARC_SEGMENTS + 1) * 3), 3),
    );

    const azArcGeom = new THREE.BufferGeometry();
    azArcGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((AZ_ARC_SEGMENTS + 1) * 3), 3),
    );

    // 4 Line segments (8 vertices):
    // Seg 0: Observer (0,0,0) -> Object (x,y,z)
    // Seg 1: Observer (0,0,0) -> Horizon Rim along Azimuth
    // Seg 2: Observer (0,0,0) -> North Horizon Rim (0°)
    // Seg 3: Object (x,y,z) -> Ground XZ projection (x,0,z) plumb line
    const vecGeom = new THREE.BufferGeometry();
    vecGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));

    // Triangle fan sector in the horizon plane
    const sectorGeom = new THREE.BufferGeometry();
    sectorGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(AZ_ARC_SEGMENTS * 3 * 3), 3),
    );

    return {
      altArcGeometry: altArcGeom,
      azArcGeometry: azArcGeom,
      vectorsGeometry: vecGeom,
      azSectorGeometry: sectorGeom,
    };
  }, []);

  useEffect(() => {
    return () => {
      altArcGeometry.dispose();
      azArcGeometry.dispose();
      vectorsGeometry.dispose();
      azSectorGeometry.dispose();
    };
  }, [altArcGeometry, azArcGeometry, vectorsGeometry, azSectorGeometry]);

  useEffect(() => {
    if (!selectedObject) {
      animatedCoords.current.initialized = false;
    }
  }, [selectedObject]);

  useFrame((_, delta) => {
    if (!selectedObject) return;

    const targetAlt = clampAltitudeDeg(selectedObject.altitudeDeg);
    const targetAz = normalizeAzimuthDeg(selectedObject.azimuthDeg);

    let changed = false;
    if (!animatedCoords.current.initialized) {
      animatedCoords.current.alt = targetAlt;
      animatedCoords.current.az = targetAz;
      animatedCoords.current.initialized = true;
      changed = true;
    } else {
      const smoothing = 1 - Math.exp(-14 * Math.min(delta, 0.1));
      const nextAlt =
        animatedCoords.current.alt + (targetAlt - animatedCoords.current.alt) * smoothing;
      const nextAz = lerpAzimuthDeg(animatedCoords.current.az, targetAz, smoothing);

      if (
        Math.abs(nextAlt - animatedCoords.current.alt) > 1e-4 ||
        Math.abs(nextAz - animatedCoords.current.az) > 1e-4
      ) {
        changed = true;
      }

      animatedCoords.current.alt = nextAlt;
      animatedCoords.current.az = nextAz;
    }

    if (!changed) return;

    const curAlt = animatedCoords.current.alt;
    const curAz = animatedCoords.current.az;

    // 1. Update Altitude Arc along dome surface from Horizon (0°) to curAlt
    const altPosAttr = altArcGeometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= ALT_ARC_SEGMENTS; i++) {
      const u = i / ALT_ARC_SEGMENTS;
      const a = curAlt * u;
      const [x, y, z] = horizontalToCartesian(a, curAz, radius);
      altPosAttr.setXYZ(i, x, y, z);
    }
    altPosAttr.needsUpdate = true;

    // Only compute line distances when coordinates moved, avoiding heavy per-frame overhead
    if (altArcLineRef.current) {
      altArcLineRef.current.computeLineDistances();
    }

    // 2. Update Azimuth Arc & Sector on Horizon Plane (Y = 0) from North (0°) to curAz
    const azArcRadius = radius * 0.42;
    const azPosAttr = azArcGeometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= AZ_ARC_SEGMENTS; i++) {
      const u = i / AZ_ARC_SEGMENTS;
      const az = curAz * u;
      const [x, , z] = horizontalToCartesian(0, az, azArcRadius);
      azPosAttr.setXYZ(i, x, 0.015, z);
    }
    azPosAttr.needsUpdate = true;

    const sectorPosAttr = azSectorGeometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < AZ_ARC_SEGMENTS; i++) {
      const az0 = (i / AZ_ARC_SEGMENTS) * curAz;
      const az1 = ((i + 1) / AZ_ARC_SEGMENTS) * curAz;
      const p0 = horizontalToCartesian(0, az0, azArcRadius);
      const p1 = horizontalToCartesian(0, az1, azArcRadius);

      const baseIdx = i * 3;
      sectorPosAttr.setXYZ(baseIdx, 0, 0.01, 0);
      sectorPosAttr.setXYZ(baseIdx + 1, p0[0], 0.01, p0[2]);
      sectorPosAttr.setXYZ(baseIdx + 2, p1[0], 0.01, p1[2]);
    }
    sectorPosAttr.needsUpdate = true;

    // 3. Update Coordinate Vectors
    const vecPosAttr = vectorsGeometry.getAttribute('position') as THREE.BufferAttribute;
    const objPos = horizontalToCartesian(curAlt, curAz, radius);
    const rimPos = horizontalToCartesian(0, curAz, radius);
    const northRefPos = horizontalToCartesian(0, 0, azArcRadius * 1.15);
    const planarProj = horizontalToHorizonProjection(curAlt, curAz, radius, false);

    // Segment 0: Observer (0,0,0) -> Object
    vecPosAttr.setXYZ(0, 0, 0, 0);
    vecPosAttr.setXYZ(1, objPos[0], objPos[1], objPos[2]);

    // Segment 1: Observer (0,0,0) -> Horizon Rim along Azimuth
    vecPosAttr.setXYZ(2, 0, 0, 0);
    vecPosAttr.setXYZ(3, rimPos[0], rimPos[1], rimPos[2]);

    // Segment 2: Observer (0,0,0) -> North Reference Ray
    vecPosAttr.setXYZ(4, 0, 0, 0);
    vecPosAttr.setXYZ(5, northRefPos[0], 0.015, northRefPos[2]);

    // Segment 3: Vertical plumb line from Object to Ground Plane
    vecPosAttr.setXYZ(6, objPos[0], objPos[1], objPos[2]);
    vecPosAttr.setXYZ(7, planarProj[0], 0, planarProj[2]);

    vecPosAttr.needsUpdate = true;
  });

  const isAboveHorizon =
    selectedObject?.altitudeDeg !== undefined && selectedObject.altitudeDeg >= 0;
  const guideColor = isAboveHorizon ? '#c9b187' : '#e0614c'; // --color-brass-300 or --color-ember-400

  const lines = useMemo(() => {
    const altLine = new THREE.Line(
      altArcGeometry,
      new THREE.LineDashedMaterial({
        color: guideColor,
        dashSize: 0.3,
        gapSize: 0.2,
        transparent: true,
        opacity: 0.8,
      }),
    );
    const azLine = new THREE.Line(
      azArcGeometry,
      new THREE.LineBasicMaterial({ color: guideColor, transparent: true, opacity: 0.7 }),
    );
    return { altLine, azLine };
  }, [altArcGeometry, azArcGeometry, guideColor]);

  useEffect(() => {
    return () => {
      lines.altLine.material.dispose();
      lines.azLine.material.dispose();
    };
  }, [lines]);

  if (!selectedObject) return null;

  // Anchor midpoints for badges
  const altMid = horizontalToCartesian(
    selectedObject.altitudeDeg * 0.5,
    selectedObject.azimuthDeg,
    radius * 1.05,
  );
  const normAz = normalizeAzimuthDeg(selectedObject.azimuthDeg);
  const azMid = horizontalToCartesian(0, normAz * 0.5, radius * 0.48);
  const horizonFoot = horizontalToCartesian(0, selectedObject.azimuthDeg, radius);

  return (
    <group name="selection-guides">
      {/* 1. Dashed Altitude Meridian Arc along Dome Surface */}
      <primitive ref={altArcLineRef} object={lines.altLine} />

      {/* 2. Clockwise Azimuth Arc on Horizon Plane */}
      <primitive ref={azArcLineRef} object={lines.azLine} />

      {/* 3. Subdued Shaded Azimuth Sector on Horizon Plane */}
      <mesh ref={azSectorMeshRef} geometry={azSectorGeometry}>
        <meshBasicMaterial
          color={guideColor}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Coordinate Rays & Vertical Plumb Line */}
      <lineSegments ref={vectorsLineRef} geometry={vectorsGeometry}>
        <lineBasicMaterial color={guideColor} transparent opacity={0.35} />
      </lineSegments>

      {/* 5. Horizon Foot Node (Alt 0°, Az = target) */}
      <mesh position={horizonFoot}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={guideColor} />
      </mesh>

      {/* 6. Altitude Callout Badge */}
      <Html position={altMid} center style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-black/90 border border-brass-500/50 font-mono text-[9px] whitespace-nowrap">
          <span className="font-jost text-[8px] uppercase tracking-wider text-sky-400 font-medium">
            ALT
          </span>
          <span
            className={isAboveHorizon ? 'text-brass-300 font-medium' : 'text-ember-400 font-medium'}
          >
            {formatAltitudeDeg(selectedObject.altitudeDeg, 1)}
          </span>
        </div>
      </Html>

      {/* 7. Azimuth Callout Badge */}
      <Html position={[azMid[0], 0.25, azMid[2]]} center style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-black/90 border border-brass-500/50 font-mono text-[9px] text-brass-300 whitespace-nowrap">
          <span className="font-jost text-[8px] uppercase tracking-wider text-sky-400 font-medium">
            AZ
          </span>
          <span className="font-medium">
            {formatAzimuthDeg(selectedObject.azimuthDeg, 1, false)}
          </span>
        </div>
      </Html>
    </group>
  );
};
