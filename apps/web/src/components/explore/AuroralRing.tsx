import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  auroraVisibility,
  auroraStrengthToFactor,
  geomagneticLatitudeDeg,
  GEOMAG_POLE_LAT_DEG,
  GEOMAG_POLE_LON_DEG,
  degToRad,
} from '@astranet/shared';
import { DUR_CINEMATIC, DUR_REDUCED_MOTION_FADE, EASE_AMBIENT, EASE_CINEMATIC } from '@/lib/motion';
import { cssColorToken } from '@/lib/color';

/**
 * The Auroral Ring — the live aurora, driven by real Kp (WORKPLAN Phase 8:
 * "Auroral Ring driven by live OVATION/Kp").
 *
 * From the ground view this renders as an auroral glow band low on the sky
 * toward the observer's geomagnetic pole. Whether it appears at all, and how
 * far up the sky it reaches, comes from FORMULAS.md §7 via the shared engine
 * (`auroraVisibility` → §11's `auroraStrengthToFactor`) — never invented.
 * `kp === null` (source unavailable) renders nothing, per API_SOURCES.md's
 * SWPC fallback ("unavailable"), rather than a made-up baseline glow.
 *
 * Ambient object: not clickable, consumes none of §11's Rule-of-7 slots.
 *
 * Motion (§7.1/§7.6): intensity changes tween at cinematic expo.inOut —
 * atmosphere doesn't snap; curtain drift is a looping sine.inOut sway in the
 * ambient band. Under prefers-reduced-motion the drift loop never starts and
 * intensity changes collapse to the 200ms fade.
 */

interface AuroralRingProps {
  observerLat: number;
  observerLon: number;
  /** Live continuous Kp, or null when the source is unavailable. */
  kp: number | null;
}

/** Aurora shell radius — atmospheric, so inside (in front of) the 1000-unit star shell. */
const AURORA_RADIUS = 950;

/** One-way curtain-sway period, seconds — inside §7.1's 4–20s ambient band. */
const DRIFT_PERIOD_S = 14;

const vertexShader = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The band's placement derives from §7's outputs, not re-derived physics:
// uIntensity is auroraStrengthToFactor(strength) — 0 means "just visible on
// the horizon toward the pole," 1 means "deep inside the oval" (band spreads
// wide and climbs toward zenith). Everything else is presentation.
const fragmentShader = `
  uniform float uIntensity;
  uniform float uDrift;
  uniform vec3 uColor;
  uniform vec3 uPoleDir;
  varying vec3 vDir;

  void main() {
    if (uIntensity <= 0.001) discard;

    float alt = asin(clamp(vDir.y, -1.0, 1.0)); // altitude, radians
    if (alt < 0.0) discard;                     // below horizon

    // Azimuthal distance from the geomagnetic-pole bearing.
    vec3 flat_ = normalize(vec3(vDir.x, 0.0, vDir.z));
    float azDist = acos(clamp(dot(flat_, uPoleDir), -1.0, 1.0));
    float halfWidth = mix(radians(40.0), radians(180.0), uIntensity);
    float azFall = 1.0 - smoothstep(halfWidth * 0.45, halfWidth, azDist);

    // Vertical curtain: sharp-ish lower edge a few degrees up, decaying
    // toward a ceiling that climbs with intensity.
    float ceil_ = mix(radians(12.0), radians(75.0), uIntensity);
    float vert = smoothstep(radians(1.0), radians(6.0), alt)
               * (1.0 - smoothstep(ceil_ * 0.3, ceil_, alt));

    // Rays: two interfering sine bands over azimuth, swaying with uDrift.
    float az = atan(vDir.x, -vDir.z);
    float ray = 0.62
              + 0.38 * sin(az * 38.0 + uDrift * 2.6)
                     * sin(az * 15.0 - uDrift * 1.4 + 1.7);

    float alpha = (0.07 + 0.30 * sqrt(uIntensity)) * azFall * vert * ray;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Initial great-circle bearing (radians, clockwise from North) from the
 * observer to the geomagnetic pole of the observer's own geomagnetic
 * hemisphere — aurora borealis looks toward the north geomagnetic pole,
 * australis toward its antipode. Placement math for rendering only; the
 * visibility physics stays in the shared §7 engine.
 */
export function bearingToGeomagneticPoleRad(observerLat: number, observerLon: number): number {
  const northern = geomagneticLatitudeDeg(observerLat, observerLon) >= 0;
  const poleLat = northern ? GEOMAG_POLE_LAT_DEG : -GEOMAG_POLE_LAT_DEG;
  const poleLon = northern ? GEOMAG_POLE_LON_DEG : GEOMAG_POLE_LON_DEG + 180;

  const phi1 = degToRad(observerLat);
  const phi2 = degToRad(poleLat);
  const dLon = degToRad(poleLon - observerLon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

export function AuroralRing({
  observerLat,
  observerLon,
  kp,
}: AuroralRingProps): React.ReactElement {
  const uniforms = useRef({
    uIntensity: { value: 0 },
    uDrift: { value: 0 },
    uColor: { value: new THREE.Color(cssColorToken('--color-aurora', '#7fa88a')) },
    uPoleDir: { value: new THREE.Vector3(0, 0, -1) },
  });

  const geometry = useMemo(() => new THREE.SphereGeometry(AURORA_RADIUS, 64, 32), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Bearing toward the geomagnetic pole, mapped into scene space the same way
  // StarField maps azimuth (+X east, -Z north).
  useEffect(() => {
    const b = bearingToGeomagneticPoleRad(observerLat, observerLon);
    uniforms.current.uPoleDir.value.set(Math.sin(b), 0, -Math.cos(b));
  }, [observerLat, observerLon]);

  // Live Kp → §7 visibility → §11 strength factor → tweened intensity.
  useEffect(() => {
    let target = 0;
    if (kp !== null) {
      const vis = auroraVisibility(observerLat, observerLon, kp);
      target = vis.visible ? auroraStrengthToFactor(vis.strength) : 0;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = gsap.to(uniforms.current.uIntensity, {
      value: target,
      duration: reduced ? DUR_REDUCED_MOTION_FADE : DUR_CINEMATIC,
      ease: EASE_CINEMATIC,
      overwrite: 'auto',
    });
    return () => {
      tween.kill();
    };
  }, [kp, observerLat, observerLon]);

  // Ambient curtain sway — §7.6: never starts under prefers-reduced-motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tween = gsap.to(uniforms.current.uDrift, {
      value: 1,
      duration: DRIFT_PERIOD_S,
      ease: EASE_AMBIENT,
      yoyo: true,
      repeat: -1,
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <mesh geometry={geometry} renderOrder={1}>
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
