import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { degToRad, clamp } from '@astranet/shared';
import type { DailyBrief } from '@/lib/api';
import { DUR_CINEMATIC, DUR_REDUCED_MOTION_FADE, EASE_AMBIENT, EASE_CINEMATIC } from '@/lib/motion';
import { cssColorToken } from '@/lib/color';

/**
 * The Heliosphere Pulse — live solar wind made visible (WORKPLAN Phase 8:
 * "Heliosphere Pulse driven by live solar wind"; README: "solar wind
 * visualized as a visible pulse washing outward from the Sun").
 *
 * A faint brass wash expands radially across the sky dome from the Sun's
 * true position — `skyAnchor.data.sunAzimuthDeg`/`sunAltitudeDeg` (shared §4
 * engine, computed server-side; real geometry even below the horizon at
 * night, which is where the Sun is whenever stars are visible). This is the
 * same field `CelestialMarkers`' Sun marker reads, so the wash and the
 * marker dot always agree on where the Sun actually is — no independent
 * client-side recompute to drift out of sync with it. One wash cycle's
 * period is mapped from the live RTSW proton speed: faster wind, faster
 * pulse, clamped to §7.1's 4–20s ambient band.
 *
 * Honesty (API_SOURCES.md SWPC fallback): no solar wind speed, or no Sun
 * position yet (brief not loaded / skyAnchor unavailable) → no pulse.
 * Nothing here invents a baseline or a placeholder direction. An
 * unhealthy-but-present value renders at half opacity, mirroring §10's
 * dimmed-to-50% unavailable convention.
 *
 * Ambient object: not clickable, consumes none of §11's Rule-of-7 slots.
 * §7.6: under prefers-reduced-motion the loop never starts and the wash
 * stays invisible — an ambient effect frozen mid-expansion would read as a
 * rendering defect, not a calm state.
 */

interface HeliospherePulseProps {
  brief: DailyBrief | null;
  /** Live RTSW proton speed, km/s, or null when unavailable. */
  solarWindSpeedKmS: number | null;
  /** The SWPC fast-tier source's own health flag. */
  healthy: boolean;
}

/** Pulse shell radius — between the aurora shell (950) and the camera. */
const PULSE_RADIUS = 900;

/** Solar wind speed span mapped onto the pulse period (slow wind ~250, fast ~800 km/s). */
const WIND_SPEED_MIN_KMS = 250;
const WIND_SPEED_MAX_KMS = 800;

/** §7.1 ambient band: slowest wind → 20s per wash, fastest → 4s. */
const PULSE_PERIOD_MAX_S = 20;
const PULSE_PERIOD_MIN_S = 4;

/** Map live wind speed onto a wash period inside the ambient band. */
export function pulsePeriodSeconds(speedKmS: number): number {
  const t = clamp(
    (speedKmS - WIND_SPEED_MIN_KMS) / (WIND_SPEED_MAX_KMS - WIND_SPEED_MIN_KMS),
    0,
    1,
  );
  return PULSE_PERIOD_MAX_S - t * (PULSE_PERIOD_MAX_S - PULSE_PERIOD_MIN_S);
}

const vertexShader = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// uPhase 0→1 carries one wavefront from the Sun's direction (angular
// distance 0) to the anti-solar point (π). The wash weakens as it expands —
// the 1/r² nod that keeps the far sky from flashing as brightly as the
// near-Sun sky.
const fragmentShader = `
  uniform float uPhase;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  void main() {
    if (uOpacity <= 0.001) discard;

    float ang = acos(clamp(dot(vDir, uSunDir), -1.0, 1.0));
    float front = uPhase * 3.14159265;
    float d = ang - front;
    float sigma = radians(16.0);
    float wash = exp(-(d * d) / (2.0 * sigma * sigma));
    float fade = 1.0 - 0.65 * uPhase;

    gl_FragColor = vec4(uColor, 0.10 * uOpacity * wash * fade);
  }
`;

export function HeliospherePulse({
  brief,
  solarWindSpeedKmS,
  healthy,
}: HeliospherePulseProps): React.ReactElement {
  const uniforms = useRef({
    uPhase: { value: 0 },
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color(cssColorToken('--color-brass-500', '#9a8258')) },
    uSunDir: { value: new THREE.Vector3(0, -1, 0) },
  });
  const phaseTween = useRef<gsap.core.Tween | null>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(PULSE_RADIUS, 48, 24), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Same `skyAnchor.data` fields CelestialMarkers' Sun marker reads — one
  // source of truth for where the Sun actually is, null until the brief
  // resolves it.
  const sunAzimuthDeg = brief?.skyAnchor?.data?.sunAzimuthDeg ?? null;
  const sunAltitudeDeg = brief?.skyAnchor?.data?.sunAltitudeDeg ?? null;

  // True Sun direction, same az/alt→xyz mapping as StarField.
  useEffect(() => {
    if (sunAzimuthDeg === null || sunAltitudeDeg === null) return;
    const alt = degToRad(sunAltitudeDeg);
    const az = degToRad(sunAzimuthDeg);
    uniforms.current.uSunDir.value
      .set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az))
      .normalize();
  }, [sunAzimuthDeg, sunAltitudeDeg]);

  // The looping wash. Created once at the base (slowest) period; live speed
  // changes retime it via timeScale so a mid-wash update speeds the same
  // pulse up rather than restarting it with a visible jump.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tween = gsap.fromTo(
      uniforms.current.uPhase,
      { value: 0 },
      { value: 1, duration: PULSE_PERIOD_MAX_S, ease: EASE_AMBIENT, repeat: -1 },
    );
    phaseTween.current = tween;
    return () => {
      tween.kill();
      phaseTween.current = null;
    };
  }, []);

  // Live data → visibility and tempo.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const available =
      solarWindSpeedKmS !== null && sunAzimuthDeg !== null && sunAltitudeDeg !== null && !reduced;
    const targetOpacity = available ? (healthy ? 1 : 0.5) : 0;
    const opacityTween = gsap.to(uniforms.current.uOpacity, {
      value: targetOpacity,
      duration: reduced ? DUR_REDUCED_MOTION_FADE : DUR_CINEMATIC,
      ease: EASE_CINEMATIC,
      overwrite: 'auto',
    });

    if (available && phaseTween.current !== null) {
      phaseTween.current.timeScale(PULSE_PERIOD_MAX_S / pulsePeriodSeconds(solarWindSpeedKmS));
    }
    return () => {
      opacityTween.kill();
    };
  }, [solarWindSpeedKmS, healthy, sunAzimuthDeg, sunAltitudeDeg]);

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
