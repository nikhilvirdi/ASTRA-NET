import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import type { DailyBrief } from '@/lib/api';
import { interpolatePassPosition } from '@/lib/pass-interpolation';
import {
  aggregateSkyObjects,
  drillFovDeg,
  fovToZoomLevel,
  isAboveHorizon,
  type ClusterRenderable,
  type ShellRenderable,
  type SkyObjectInput,
  type SkyRenderable,
  type ZoomLevel,
} from '@/lib/semantic-zoom';
import {
  resolveSatelliteFeed,
  simSatCountFromSearch,
  simulatedSatellites,
} from '@/lib/dev-sim-satellites';
import { useSatellites } from '@/hooks/useSatellites';
import {
  DUR_REDUCED_MOTION_FADE,
  DUR_TRANSITION,
  DUR_TRANSITION_MS,
  EASE_TRANSITION,
} from '@/lib/motion';
import { cssColorToken } from '@/lib/color';
import { DiegeticText } from './DiegeticText';

export interface CelestialObject {
  id: string;
  name: string;
  type: 'iss' | 'jupiter' | 'venus' | 'mars' | 'saturn' | 'mercury' | 'moon' | 'sun' | 'satellite';
  azimuthDeg: number;
  altitudeDeg: number;
  color: string;
  sentence: string;
  measurements: string;
  linkText: string;
  linkHref: string;
}

export interface ScreenPos {
  x: number;
  y: number;
  inView: boolean;
  azimuthDeg?: number;
  altitudeDeg?: number;
}

/** A semantic-zoom drill-in request (cluster/shell click). */
export interface DrillTarget {
  id: string;
  azimuthDeg: number;
  altitudeDeg: number;
  fovDeg: number;
}

interface CelestialMarkersProps {
  brief: DailyBrief | null;
  /** Scene clock from ExplorePage — drives the ISS along its pass window. */
  currentTime: Date;
  selectedId: string | null;
  onSelect: (obj: CelestialObject | null) => void;
  onUpdateScreenPos?: (posMap: Record<string, ScreenPos>) => void;
  /** Cluster/shell click → cinematic zoom-in one level (semantic zoom). */
  onDrill?: (target: DrillTarget) => void;
}

const MARKER_RADIUS = 950;

/** Marker lifecycle for the §7.1 transition-class crossfade between regimes. */
type MarkerPhase = 'live' | 'out';

// --color-orbital — satellites/aggregates; --color-brass-300 — tether lines.
const ORBITAL_COLOR = '#A8B4BC';
const BRASS_LINE_COLOR = '#C9B187';

function altAzToVector3(altDeg: number, azDeg: number, radius = MARKER_RADIUS): THREE.Vector3 {
  const rAlt = altDeg * (Math.PI / 180);
  const rAz = azDeg * (Math.PI / 180);
  const x = radius * Math.cos(rAlt) * Math.sin(rAz);
  const y = radius * Math.sin(rAlt);
  const z = -radius * Math.cos(rAlt) * Math.cos(rAz);
  return new THREE.Vector3(x, y, z);
}

function fadeDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? DUR_REDUCED_MOTION_FADE
    : DUR_TRANSITION;
}

/**
 * Drives a set of materials' opacities through mount fade-in / regime
 * fade-out. Each entry maps a material ref to its full-phase opacity.
 */
function useMarkerFade(
  phase: MarkerPhase,
  entries: { ref: React.RefObject<THREE.Material | null>; base: number }[],
): void {
  const fade = useRef({ value: 0 });
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    const tween = gsap.to(fade.current, {
      value: phase === 'out' ? 0 : 1,
      duration: fadeDuration(),
      ease: EASE_TRANSITION,
      onUpdate: () => {
        for (const { ref, base } of entriesRef.current) {
          if (ref.current !== null) ref.current.opacity = base * fade.current.value;
        }
      },
    });
    return () => {
      tween.kill();
    };
  }, [phase]);
}

// ─── Individual marker (unchanged interaction, now with regime crossfade) ───

function IndividualMarker({
  obj,
  isSelected,
  phase,
  onSelect,
}: {
  obj: CelestialObject;
  isSelected: boolean;
  phase: MarkerPhase;
  onSelect: (obj: CelestialObject | null) => void;
}): React.ReactElement {
  const wireMat = useRef<THREE.MeshBasicMaterial>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  useMarkerFade(phase, [
    { ref: wireMat, base: 0.7 },
    { ref: coreMat, base: 1 },
  ]);

  const pos = altAzToVector3(obj.altitudeDeg, obj.azimuthDeg);
  const interactive = phase === 'live';

  return (
    <group position={pos}>
      {/* Outer gimbals / halo */}
      <mesh
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (!interactive) return;
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          onSelect(isSelected ? null : obj);
        }}
      >
        <sphereGeometry args={[isSelected ? 18 : 12, 16, 16]} />
        <meshBasicMaterial
          ref={wireMat}
          color={obj.color}
          wireframe={true}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Solid central core */}
      <mesh>
        <sphereGeometry args={[6, 12, 12]} />
        <meshBasicMaterial ref={coreMat} color={obj.color} transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ─── Constellation-shaped cluster (§11: satellites merge into clusters) ─────

function ClusterMarker({
  cluster,
  zoomLevel,
  phase,
  onDrill,
}: {
  cluster: ClusterRenderable;
  zoomLevel: ZoomLevel;
  phase: MarkerPhase;
  onDrill?: (target: DrillTarget) => void;
}): React.ReactElement {
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  // One material shared by every member dot so the whole glyph fades as one.
  const dotMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ORBITAL_COLOR, transparent: true, opacity: 0 }),
    [],
  );
  useEffect(() => () => dotMaterial.dispose(), [dotMaterial]);
  const dotMatRef = useRef<THREE.Material>(dotMaterial);
  useMarkerFade(phase, [
    { ref: coreMat, base: 0.7 },
    { ref: dotMatRef, base: 0.8 },
    { ref: lineMat, base: 0.35 },
  ]);

  const centroidPos = useMemo(
    () => altAzToVector3(cluster.altitudeDeg, cluster.azimuthDeg),
    [cluster.altitudeDeg, cluster.azimuthDeg],
  );

  // The constellation glyph: hairlines from the clickable core out to each
  // member's real position — the shape IS the real geometry, not an icon.
  const lineGeometry = useMemo(() => {
    const positions = new Float32Array(cluster.members.length * 6);
    cluster.members.forEach((m, i) => {
      const p = altAzToVector3(m.altitudeDeg, m.azimuthDeg);
      positions.set([centroidPos.x, centroidPos.y, centroidPos.z, p.x, p.y, p.z], i * 6);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [cluster.members, centroidPos]);
  useEffect(() => () => lineGeometry.dispose(), [lineGeometry]);

  const interactive = phase === 'live';
  const handleDrill = (): void => {
    onDrill?.({
      id: cluster.id,
      azimuthDeg: cluster.azimuthDeg,
      altitudeDeg: cluster.altitudeDeg,
      fovDeg: drillFovDeg(zoomLevel),
    });
  };

  return (
    <group>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial ref={lineMat} color={BRASS_LINE_COLOR} transparent opacity={0} />
      </lineSegments>

      {/* Member dots at their real positions — ambient, not clickable. */}
      {cluster.members.map((m) => (
        <mesh key={m.id} position={altAzToVector3(m.altitudeDeg, m.azimuthDeg)}>
          <sphereGeometry args={[3.5, 8, 8]} />
          <primitive object={dotMaterial} attach="material" />
        </mesh>
      ))}

      {/* The one clickable: drill in a zoom level, resolving the cluster. */}
      <mesh
        position={centroidPos}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (!interactive) return;
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          handleDrill();
        }}
      >
        <octahedronGeometry args={[14, 0]} />
        <meshBasicMaterial ref={coreMat} color={ORBITAL_COLOR} wireframe transparent opacity={0} />
      </mesh>

      {phase === 'live' && (
        <DiegeticText
          text={`${cluster.members.length} SATELLITES`}
          position={[centroidPos.x, centroidPos.y - 34, centroidPos.z]}
          fontSize={14}
          opacity={0.7}
        />
      )}
    </group>
  );
}

// ─── Orbital shell glow (§11: "then into a single orbital shell glow") ──────

const SHELL_RADIUS = 930;

const shellVertexShader = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A soft band of light hugging the sky at low altitude, all the way around
// the compass — the LEO shell seen from inside it. Same treatment family as
// the Heliosphere Pulse: additive, per-fragment Gaussian falloff, so no
// geometry (facets, vertices, edges) is ever visible — it reads as glow,
// not as a shape (the §11 wording is "orbital shell GLOW").
const shellFragmentShader = `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec3 vDir;

  void main() {
    if (uOpacity <= 0.001) discard;
    float alt = asin(clamp(vDir.y, -1.0, 1.0));
    float d = alt - radians(22.0);
    float sigma = radians(14.0);
    float band = exp(-(d * d) / (2.0 * sigma * sigma));
    gl_FragColor = vec4(uColor, 0.12 * uOpacity * band);
  }
`;

function ShellMarker({
  shell,
  zoomLevel,
  phase,
  onDrill,
}: {
  shell: ShellRenderable;
  zoomLevel: ZoomLevel;
  phase: MarkerPhase;
  onDrill?: (target: DrillTarget) => void;
}): React.ReactElement {
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const coreSolidMat = useRef<THREE.MeshBasicMaterial>(null);
  useMarkerFade(phase, [
    { ref: coreMat, base: 0.7 },
    { ref: coreSolidMat, base: 1 },
  ]);

  // The glow fades through its shader uniform (a ShaderMaterial's .opacity
  // does nothing), mirroring useMarkerFade's timing.
  const glowUniforms = useRef({
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color(cssColorToken('--color-orbital', ORBITAL_COLOR)) },
  });
  useEffect(() => {
    const tween = gsap.to(glowUniforms.current.uOpacity, {
      value: phase === 'out' ? 0 : 1,
      duration: fadeDuration(),
      ease: EASE_TRANSITION,
    });
    return () => {
      tween.kill();
    };
  }, [phase]);

  const corePos = altAzToVector3(shell.altitudeDeg, shell.azimuthDeg);
  const interactive = phase === 'live';
  const handleDrill = (): void => {
    onDrill?.({
      id: shell.id,
      azimuthDeg: shell.azimuthDeg,
      altitudeDeg: shell.altitudeDeg,
      fovDeg: drillFovDeg(zoomLevel),
    });
  };

  return (
    <group>
      {/* The glow itself — whole-sky, ambient, edgeless; no handlers, so it
          never intercepts clicks meant for markers behind it. */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[SHELL_RADIUS, 48, 24]} />
        <shaderMaterial
          vertexShader={shellVertexShader}
          fragmentShader={shellFragmentShader}
          uniforms={glowUniforms.current}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* The single clickable handle — same small-sphere marker vocabulary
          as every other clickable, so only the glow reads as "the shell". */}
      <group position={corePos}>
        <mesh
          onPointerOver={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            if (!interactive) return;
            document.body.style.cursor = 'auto';
          }}
          onClick={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            handleDrill();
          }}
        >
          <sphereGeometry args={[12, 16, 16]} />
          <meshBasicMaterial
            ref={coreMat}
            color={ORBITAL_COLOR}
            wireframe
            transparent
            opacity={0}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[5, 12, 12]} />
          <meshBasicMaterial ref={coreSolidMat} color={ORBITAL_COLOR} transparent opacity={0} />
        </mesh>
      </group>

      {/* Two separate labels, stacked above/below the handle with explicit
          offsets. Never a single string with a '·' separator: troika lays
          out the self-hosted TTF itself with no per-glyph fallback, and the
          U+00B7 layout collapse made the two halves render on top of each
          other (the DOM never shows this — browsers substitute glyphs). */}
      {phase === 'live' && (
        <>
          <DiegeticText
            text="ORBITAL SHELL"
            position={[corePos.x, corePos.y + 34, corePos.z]}
            fontSize={14}
            opacity={0.7}
          />
          <DiegeticText
            text={`${shell.count} SATELLITES`}
            position={[corePos.x, corePos.y - 34, corePos.z]}
            fontSize={14}
            opacity={0.7}
          />
        </>
      )}
    </group>
  );
}

// ─── The marker layer ───────────────────────────────────────────────────────

function renderableKey(r: SkyRenderable): string {
  return r.kind === 'object' ? r.object.id : r.id;
}

export function CelestialMarkers({
  brief,
  currentTime,
  selectedId,
  onSelect,
  onUpdateScreenPos,
  onDrill,
}: CelestialMarkersProps): React.ReactElement | null {
  const { camera, gl } = useThree();

  // Extract objects from Brief payload (Rule of 7 compliant, max 4 objects)
  const objects = useMemo<CelestialObject[]>(() => {
    if (!brief) return [];
    const list: CelestialObject[] = [];

    // 1. ISS Marker — position interpolated along the next visible pass via
    // the shared `@/lib/pass-interpolation` (same source as the Horizon
    // Band); outside the pass window there is no real position, so no marker.
    // The pass itself is already sunlit/dark-sky filtered server-side (N2YO's
    // visual-pass semantics), but interpolation can still land below the
    // horizon right at a pass's start/end edge, so the same horizon check
    // applies here as everywhere else.
    const issPass = brief.iss?.status === 'ok' ? brief.iss.data?.nextPass : null;
    if (issPass) {
      const pos = interpolatePassPosition(issPass, currentTime.getTime() / 1000);
      if (pos && isAboveHorizon(pos.altitudeDeg)) {
        list.push({
          id: 'iss',
          name: 'ISS (ZARYA)',
          type: 'iss',
          azimuthDeg: pos.azimuthDeg,
          altitudeDeg: pos.altitudeDeg,
          color: '#A8B4BC', // --color-orbital
          sentence:
            'Seven people are inside, moving at 27,600 km/h. It laps your city every 90 minutes.',
          measurements: `ALT: ${pos.altitudeDeg.toFixed(0)}° · PASS: ${issPass.startAzimuthCompass} → ${issPass.maxAzimuthCompass} · MAG: ${issPass.magnitude}`,
          linkText: 'View ISS Transit Details',
          linkHref: '/',
        });
      }
    }

    // 2. Jupiter Marker — real altitude, no floor. (A prior `Math.max(2, ...)`
    // floor here silently kept Jupiter's marker pinned just above the ground
    // at all times, which is what let it render as a bright clickable object
    // even tens of degrees below the true horizon — see DECISIONS.md.)
    if (
      brief.skyAnchor?.data?.jupiter &&
      isAboveHorizon(brief.skyAnchor.data.jupiter.altitudeDeg)
    ) {
      const jup = brief.skyAnchor.data.jupiter;
      list.push({
        id: 'jupiter',
        name: 'JUPITER',
        type: 'jupiter',
        azimuthDeg: jup.azimuthDeg,
        altitudeDeg: jup.altitudeDeg,
        color: '#C9B187', // --color-brass-300
        sentence:
          "The solar system's largest planet, glowing brightly in tonight's celestial field.",
        measurements: `ALT: ${jup.altitudeDeg.toFixed(1)}° · AZ: ${jup.azimuthDeg.toFixed(1)}°`,
        linkText: 'Explore Sky Anchor Data',
        linkHref: '/',
      });
    }

    // 3. Venus Marker — real altitude, no floor.
    if (brief.skyAnchor?.data?.venus && isAboveHorizon(brief.skyAnchor.data.venus.altitudeDeg)) {
      const ven = brief.skyAnchor.data.venus;
      list.push({
        id: 'venus',
        name: 'VENUS',
        type: 'venus',
        azimuthDeg: ven.azimuthDeg,
        altitudeDeg: ven.altitudeDeg,
        color: '#D6DCDC', // --color-sky-200 (brilliant silver-white, distinct from Sun's --color-solar)
        sentence: 'The brightest planet in Earth’s sky, shrouded in dense heat-trapping clouds.',
        measurements: `ALT: ${ven.altitudeDeg.toFixed(1)}° · AZ: ${ven.azimuthDeg.toFixed(1)}°`,
        linkText: 'Explore Sky Anchor Data',
        linkHref: '/',
      });
    }

    // 4. Mars Marker — real altitude, no floor.
    if (brief.skyAnchor?.data?.mars && isAboveHorizon(brief.skyAnchor.data.mars.altitudeDeg)) {
      const mar = brief.skyAnchor.data.mars;
      list.push({
        id: 'mars',
        name: 'MARS',
        type: 'mars',
        azimuthDeg: mar.azimuthDeg,
        altitudeDeg: mar.altitudeDeg,
        color: '#B08968', // --color-neo (dusty rust rock)
        sentence: 'The Red Planet, an iron-rich desert world with thin atmosphere and polar caps.',
        measurements: `ALT: ${mar.altitudeDeg.toFixed(1)}° · AZ: ${mar.azimuthDeg.toFixed(1)}°`,
        linkText: 'Explore Sky Anchor Data',
        linkHref: '/',
      });
    }

    // 5. Saturn Marker — real altitude, no floor.
    if (brief.skyAnchor?.data?.saturn && isAboveHorizon(brief.skyAnchor.data.saturn.altitudeDeg)) {
      const sat = brief.skyAnchor.data.saturn;
      list.push({
        id: 'saturn',
        name: 'SATURN',
        type: 'saturn',
        azimuthDeg: sat.azimuthDeg,
        altitudeDeg: sat.altitudeDeg,
        color: '#C9B187', // --color-brass-300 (pale brass ringed giant)
        sentence:
          'The ringed jewel of the solar system, surrounded by ice particles and dozens of moons.',
        measurements: `ALT: ${sat.altitudeDeg.toFixed(1)}° · AZ: ${sat.azimuthDeg.toFixed(1)}°`,
        linkText: 'Explore Sky Anchor Data',
        linkHref: '/',
      });
    }

    // 6. Mercury Marker — real altitude, no floor.
    if (
      brief.skyAnchor?.data?.mercury &&
      isAboveHorizon(brief.skyAnchor.data.mercury.altitudeDeg)
    ) {
      const mer = brief.skyAnchor.data.mercury;
      list.push({
        id: 'mercury',
        name: 'MERCURY',
        type: 'mercury',
        azimuthDeg: mer.azimuthDeg,
        altitudeDeg: mer.altitudeDeg,
        color: '#A8B4BC', // --color-orbital (cool metallic grey)
        sentence: 'The innermost planet, orbiting rapidly through extreme solar temperatures.',
        measurements: `ALT: ${mer.altitudeDeg.toFixed(1)}° · AZ: ${mer.azimuthDeg.toFixed(1)}°`,
        linkText: 'Explore Sky Anchor Data',
        linkHref: '/',
      });
    }

    // 7. Moon Marker — real altitude, no floor.
    if (brief.skyAnchor?.data?.moon && isAboveHorizon(brief.skyAnchor.data.moon.altitudeDeg)) {
      const moon = brief.skyAnchor.data.moon;
      const pct = (moon.illuminatedFraction * 100).toFixed(0);
      list.push({
        id: 'moon',
        name: 'MOON',
        type: 'moon',
        azimuthDeg: moon.azimuthDeg,
        altitudeDeg: moon.altitudeDeg,
        color: '#EEF1F1', // --color-sky-100 (luminous pale moonlight, distinct from all other bodies)
        sentence: `Earth’s natural satellite in ${moon.phaseName} phase (${pct}% illuminated).`,
        measurements: `ALT: ${moon.altitudeDeg.toFixed(1)}° · AZ: ${moon.azimuthDeg.toFixed(1)}° · PHASE: ${moon.phaseName.toUpperCase()}`,
        linkText: 'Explore Sky Anchor Data',
        linkHref: '/',
      });
    }

    // 8. Sun Marker — real azimuth (shared §4 engine, exposed on
    // `skyAnchor.data.sunAzimuthDeg`); the due-South placeholder this used to
    // carry is retired now that the backend field exists (see DECISIONS.md).
    if (brief.skyAnchor?.data && isAboveHorizon(brief.skyAnchor.data.sunAltitudeDeg)) {
      const sunAlt = brief.skyAnchor.data.sunAltitudeDeg;
      const sunAz = brief.skyAnchor.data.sunAzimuthDeg;
      list.push({
        id: 'sun',
        name: 'SUN',
        type: 'sun',
        azimuthDeg: sunAz,
        altitudeDeg: sunAlt,
        color: '#D9A05B', // --color-solar
        sentence: `The primary star governing your location's ${brief.skyAnchor.data.twilightPhase} state.`,
        measurements: `ALT: ${sunAlt.toFixed(1)}° · PHASE: ${brief.skyAnchor.data.twilightPhase.toUpperCase()}`,
        linkText: 'View Solar Activity',
        linkHref: '/',
      });
    }

    // NO NEO marker: NeoWs provides no position data (only diameter and miss
    // distance, FORMULAS.md §10), so there is no real sky position to plot.
    // NEO info stays text-only — same stance as the Phase 7 Horizon Band
    // removal (see DECISIONS.md).

    return list;
  }, [brief, currentTime]);

  const realSats = useSatellites();

  // DEV-only simulated satellite population (?simSats=N) so the semantic
  // zoom's cluster/shell regimes can be exercised visually.
  const simObjects = useMemo<CelestialObject[]>(() => {
    const count = simSatCountFromSearch(window.location.search);
    return simulatedSatellites(count).map((s, i) => ({
      id: s.id,
      name: `SIM SAT ${String(i).padStart(2, '0')}`,
      type: 'satellite',
      azimuthDeg: s.azimuthDeg,
      altitudeDeg: s.altitudeDeg,
      color: ORBITAL_COLOR,
      sentence: 'Simulated satellite — a dev-build test object, not a real spacecraft.',
      measurements: `ALT: ${s.altitudeDeg.toFixed(1)}° · AZ: ${s.azimuthDeg.toFixed(1)}° · SIMULATED`,
      linkText: 'Semantic Zoom Dev Rig',
      linkHref: '/',
    }));
  }, []);

  const satelliteObjects = useMemo<CelestialObject[]>(() => {
    const real: CelestialObject[] = realSats.map((s) => ({
      id: s.id,
      name: s.name,
      type: 'satellite',
      azimuthDeg: s.azimuthDeg,
      altitudeDeg: s.altitudeDeg,
      color: ORBITAL_COLOR,
      sentence: 'Live satellite telemetry, continuously tracked in orbit.',
      measurements: `ALT: ${s.altitudeDeg.toFixed(1)}° · AZ: ${s.azimuthDeg.toFixed(1)}°`,
      linkText: 'View Orbit Details',
      linkHref: '/',
    }));
    return resolveSatelliteFeed(window.location.search, simObjects, real);
  }, [simObjects, realSats]);

  const allObjects = useMemo<CelestialObject[]>(
    () => [...objects, ...satelliteObjects],
    [objects, satelliteObjects],
  );

  const richById = useMemo(() => {
    return new Map(allObjects.map((o) => [o.id, o]));
  }, [allObjects]);

  // ── Semantic zoom: discrete level from live FOV, aggregation on change ──
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(() =>
    camera instanceof THREE.PerspectiveCamera ? fovToZoomLevel(camera.fov) : 1,
  );

  const skyInputs = useMemo<SkyObjectInput[]>(() => {
    const kindOf = (type: CelestialObject['type']): SkyObjectInput['kind'] => {
      if (type === 'iss' || type === 'satellite') return 'satellite';
      if (type === 'sun') return 'sun';
      return 'planet';
    };
    return allObjects.map((o) => ({
      id: o.id,
      kind: kindOf(o.type),
      azimuthDeg: o.azimuthDeg,
      altitudeDeg: o.altitudeDeg,
      // The ISS is pinned: hero object of §11's opening sequence and camera
      // lock — it never merges into a cluster.
      pinned: o.type === 'iss',
    }));
  }, [allObjects]);

  const aggregation = useMemo(
    () => aggregateSkyObjects(skyInputs, zoomLevel),
    [skyInputs, zoomLevel],
  );

  // ── §7.1 transition-class crossfade between regimes: renderables that
  // left the aggregation stay mounted briefly, fading out. ──
  const prevRenderables = useRef<SkyRenderable[]>([]);
  const [leaving, setLeaving] = useState<SkyRenderable[]>([]);
  useEffect(() => {
    const liveKeys = new Set(aggregation.renderables.map(renderableKey));
    const gone = prevRenderables.current.filter((r) => !liveKeys.has(renderableKey(r)));
    prevRenderables.current = aggregation.renderables;
    if (gone.length === 0) return;
    setLeaving((old) => {
      const goneKeys = new Set(gone.map(renderableKey));
      return [
        ...old.filter((r) => !liveKeys.has(renderableKey(r)) && !goneKeys.has(renderableKey(r))),
        ...gone,
      ];
    });
    const timer = window.setTimeout(() => setLeaving([]), DUR_TRANSITION_MS + 80);
    return () => window.clearTimeout(timer);
  }, [aggregation]);

  // Individually-rendered clickables (the only markers with tether panels).
  const liveIndividuals = useMemo(() => {
    return aggregation.renderables
      .filter((r): r is Extract<SkyRenderable, { kind: 'object' }> => r.kind === 'object')
      .map((r) => richById.get(r.object.id))
      .filter((o): o is CelestialObject => o !== undefined);
  }, [aggregation, richById]);

  // Track and update screen coordinates + zoom level on frame renders
  const vec = useRef(new THREE.Vector3());
  useFrame(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const level = fovToZoomLevel(camera.fov);
      if (level !== zoomLevel) setZoomLevel(level);
    }

    if (!onUpdateScreenPos || liveIndividuals.length === 0) return;

    const width = gl.domElement.clientWidth;
    const height = gl.domElement.clientHeight;
    const posMap: Record<string, ScreenPos> = {};

    liveIndividuals.forEach((obj) => {
      const v = altAzToVector3(obj.altitudeDeg, obj.azimuthDeg);
      vec.current.copy(v);
      vec.current.project(camera);

      const inView = vec.current.z < 1 && vec.current.z > -1;
      const screenX = ((vec.current.x + 1) * width) / 2;
      const screenY = ((-vec.current.y + 1) * height) / 2;

      posMap[obj.id] = {
        x: screenX,
        y: screenY,
        inView,
        azimuthDeg: obj.azimuthDeg,
        altitudeDeg: obj.altitudeDeg,
      };
    });

    onUpdateScreenPos(posMap);
  });

  const renderOne = (r: SkyRenderable, phase: MarkerPhase): React.ReactElement | null => {
    const key = `${phase}:${renderableKey(r)}`;
    if (r.kind === 'object') {
      const rich = richById.get(r.object.id);
      if (!rich) return null;
      return (
        <IndividualMarker
          key={key}
          obj={rich}
          isSelected={selectedId === rich.id}
          phase={phase}
          onSelect={onSelect}
        />
      );
    }
    if (r.kind === 'cluster') {
      return (
        <ClusterMarker
          key={key}
          cluster={r}
          zoomLevel={zoomLevel}
          phase={phase}
          onDrill={onDrill}
        />
      );
    }
    return (
      <ShellMarker key={key} shell={r} zoomLevel={zoomLevel} phase={phase} onDrill={onDrill} />
    );
  };

  const liveKeys = new Set(aggregation.renderables.map(renderableKey));

  return (
    <group>
      {aggregation.renderables.map((r) => renderOne(r, 'live'))}
      {leaving.filter((r) => !liveKeys.has(renderableKey(r))).map((r) => renderOne(r, 'out'))}
    </group>
  );
}
