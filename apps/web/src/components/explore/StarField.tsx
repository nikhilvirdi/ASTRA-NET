import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  julianDay,
  equatorialToHorizontal,
  starPointSize,
  starBrightness,
  colorTemperatureKelvin,
} from '@astranet/shared';
import { colorTemperatureToRGB } from '@/lib/color';
import { isAboveHorizon } from '@/lib/semantic-zoom';

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

export function StarField({
  observerLat,
  observerLon,
  currentTime,
}: StarFieldProps): React.ReactElement | null {
  const [buffer, setBuffer] = useState<Float32Array | null>(null);

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

  const geometry = useMemo(() => {
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
      if (!isAboveHorizon(horiz.altitudeDeg)) {
        continue;
      }

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
    return geo;
  }, [buffer, observerLat, observerLon, currentTime]);

  if (!geometry) return null;

  return (
    <points geometry={geometry}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
      />
    </points>
  );
}
