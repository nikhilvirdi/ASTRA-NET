import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  julianDay,
  equatorialToHorizontal,
  localSiderealTimeDeg,
  starPointSize,
  starBrightness,
  colorTemperatureKelvin,
  degToRad,
  mod,
} from '@astranet/shared';
import { colorTemperatureToRGB } from '@/lib/color';

interface StarFieldProps {
  observerLat: number;
  observerLon: number;
  currentTime: Date;
}

const STAR_RADIUS = 1000;

const vertexShader = `
  attribute float size;
  attribute vec3 color;
  attribute float brightness;
  varying vec3 vColor;
  varying float vBrightness;
  void main() {
    vColor = color;
    vBrightness = brightness;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Multiply by a base factor, adjusted for distance to keep apparent size
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  void main() {
    // Make it circular
    vec2 xy = gl_PointCoord.xy - vec2(0.5);
    float ll = length(xy);
    if(ll > 0.5) discard;

    // Slight soft edge
    float alpha = smoothstep(0.5, 0.4, ll);
    // FORMULAS.md §2 brightness drives per-star opacity, so fainter stars are
    // genuinely dimmer — not merely smaller (which point size handles).
    gl_FragColor = vec4(vColor, alpha * vBrightness);
  }
`;

/**
 * Earth's rotation axis, expressed in this component's local horizontal
 * Cartesian frame (X=East, Y=Up, Z=South — see the position formulas below).
 * The celestial pole always sits at azimuth 0 (due north) and altitude equal
 * to the observer's latitude: negative (below the horizon) south of the
 * equator, where it's the *south* celestial pole — diametrically opposite,
 * at azimuth 180 and altitude -latitude — that is actually visible.
 */
function celestialPoleAxis(observerLatDeg: number): THREE.Vector3 {
  const latRad = degToRad(observerLatDeg);
  return new THREE.Vector3(0, Math.sin(latRad), -Math.cos(latRad));
}

/**
 * How far the whole sky has rigidly rotated about `celestialPoleAxis`
 * between `referenceTime` (when a star field was built) and `currentTime`.
 *
 * Exact, not an approximation: FORMULAS.md §3's alt/az transform depends on
 * time only through the hour angle H = LST - RA, and rotations about a
 * fixed axis compose by simple angle addition — so advancing every star by
 * the change in LST reproduces the full per-star `equatorialToHorizontal`
 * recomputation exactly. Verified empirically against that function across
 * four observers (both hemispheres, near-equator) and spans from 30 minutes
 * to 25 hours (crossing the 360deg LST wraparound): 0.000000deg of angular
 * error in every case (see `starfield-rotation.test.ts`).
 *
 * Negative sign: Earth's prograde rotation carries the sky face east to
 * west across the local sky, the opposite sense from a positive
 * right-hand-rule rotation about this axis.
 */
function siderealRotationAngleRad(referenceTime: Date, currentTime: Date): number {
  const deltaLstDeg = mod(
    localSiderealTimeDeg(julianDay(currentTime), 0) -
      localSiderealTimeDeg(julianDay(referenceTime), 0),
    360,
  );
  return -degToRad(deltaLstDeg);
}

interface BuiltStarField {
  geometry: THREE.BufferGeometry;
  /** The instant the geometry's positions were computed for — the epoch `siderealRotationAngleRad` measures forward from. */
  referenceTime: Date;
}

export function StarField({
  observerLat,
  observerLon,
  currentTime,
}: StarFieldProps): React.ReactElement | null {
  const [buffer, setBuffer] = useState<Float32Array | null>(null);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/data/stars.bin')
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        if (mounted) setBuffer(new Float32Array(buf));
      })
      .catch((err) => console.error('Failed to load stars.bin', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Built once per star catalog + observer location — deliberately NOT
  // rebuilt on every `currentTime` tick. The sky's apparent motion between
  // ticks is a single rigid rotation about Earth's axis (see
  // `siderealRotationAngleRad` above), not a change in any star's position
  // relative to any other, so recomputing all ~8,900 alt/az transforms from
  // scratch every 60s was both wasted CPU work and — because a freshly
  // constructed `THREE.BufferGeometry` replaced the old one on every tick
  // via the `geometry` prop, which bypasses R3F's automatic disposal of
  // declaratively-nested children — a GPU buffer leak. The rotation effect
  // below advances the whole field forward from `referenceTime` instead.
  const built = useMemo<BuiltStarField | null>(() => {
    if (!buffer) return null;

    const starCount = Math.floor(buffer.length / 5);
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const brightnesses = new Float32Array(starCount);

    const jd = julianDay(currentTime);

    // Count of stars actually written — some source rows are skipped (see
    // guards below), so the attributes are sliced to exactly this many at the
    // end. Writing by `i` instead would leave skipped slots zero-filled, which
    // would render phantom points at the origin.
    let w = 0;

    for (let i = 0; i < starCount; i++) {
      const idx = i * 5;
      const ra = buffer[idx];
      const dec = buffer[idx + 1];
      const distPc = buffer[idx + 2];
      const mag = buffer[idx + 3];
      const bv = buffer[idx + 4];

      // Guard the strided reads: a truncated/corrupt trailing record leaves
      // `undefined` slots. This also narrows each value from `number | undefined`
      // to `number` for the FORMULAS.md §2/§3 engine calls below.
      if (
        ra === undefined ||
        dec === undefined ||
        distPc === undefined ||
        mag === undefined ||
        bv === undefined
      ) {
        continue;
      }

      // The HYG catalog carries the Sun as its origin object (distance 0). It
      // is not a background star and would render as an oversized point at a
      // bogus fixed RA/Dec. Every real star has distance > 0 (bad-parallax
      // rows are sentineled to 100000 pc), so distance 0 uniquely identifies
      // it — a semantic filter, not an index/position assumption. The ingest
      // script excludes it too; this guards the already-built stars.bin.
      if (distPc === 0) {
        continue;
      }

      // 1. Transform coordinates (FORMULAS.md §3).
      const horiz = equatorialToHorizontal(ra, dec, observerLat, observerLon, jd);

      const rAlt = horiz.altitudeDeg * (Math.PI / 180);
      const rAz = horiz.azimuthDeg * (Math.PI / 180);

      // Spherical to Cartesian (Y up, -Z North).
      positions[w * 3] = STAR_RADIUS * Math.cos(rAlt) * Math.sin(rAz);
      positions[w * 3 + 1] = STAR_RADIUS * Math.sin(rAlt);
      positions[w * 3 + 2] = -STAR_RADIUS * Math.cos(rAlt) * Math.cos(rAz);

      // 2. Color mapping (B-V -> Kelvin -> RGB). stars.bin stores B-V directly,
      // so it goes straight to colorTemperatureKelvin (no bp_rp conversion).
      const kelvin = colorTemperatureKelvin(bv);
      const [r, g, b] = colorTemperatureToRGB(kelvin);
      colors[w * 3] = r;
      colors[w * 3 + 1] = g;
      colors[w * 3 + 2] = b;

      // 3. Point size and brightness (both FORMULAS.md §2). Size varies the
      // dot; brightness feeds per-star opacity in the shader.
      const baseSize = 4.0; // Baseline size for tuning
      sizes[w] = starPointSize(baseSize, mag);
      brightnesses[w] = starBrightness(mag);

      w++;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, w * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, w * 3), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes.subarray(0, w), 1));
    geo.setAttribute('brightness', new THREE.BufferAttribute(brightnesses.subarray(0, w), 1));
    return { geometry: geo, referenceTime: currentTime };
    // `currentTime` is intentionally excluded below: it seeds `referenceTime`
    // once, at build time, but must never trigger a rebuild — that's exactly
    // the leak/perf bug this fixes. Only a genuinely new star catalog or
    // observer location should reconstruct the geometry.
  }, [buffer, observerLat, observerLon]);

  // Dispose the previous geometry's GPU buffers before replacing/unmounting.
  // R3F's automatic disposal only manages declaratively-nested children; a
  // pre-built BufferGeometry passed via the `geometry` prop bypasses that.
  // This effect's cleanup closes over the specific `built` value from the
  // render that scheduled it, so it disposes exactly the geometry being
  // replaced — never the new one.
  useEffect(() => {
    return () => {
      built?.geometry.dispose();
    };
  }, [built]);

  // Advances the whole field to its position at `currentTime` by rotating
  // the point cloud rigidly about Earth's axis, rather than recomputing
  // every star (see `siderealRotationAngleRad` above).
  useEffect(() => {
    if (!built || !pointsRef.current) return;
    const axis = celestialPoleAxis(observerLat);
    const angleRad = siderealRotationAngleRad(built.referenceTime, currentTime);
    pointsRef.current.setRotationFromAxisAngle(axis, angleRad);
  }, [built, observerLat, currentTime]);

  if (!built) return null;

  return (
    <points ref={pointsRef} geometry={built.geometry}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
      />
    </points>
  );
}
