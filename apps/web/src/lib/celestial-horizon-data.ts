import type { DailyBrief } from './api';
import type { IssLivePosition } from '@/hooks/useSpaceWeather';
import { computeIssTopocentricPosition } from './iss-position';
import { interpolatePassPosition } from './pass-interpolation';
import { visibleShowerRadiant } from './meteor-showers';
import {
  formatAltitudeDeg,
  formatAzimuthDeg,
  isValidHorizonCoordinates,
  normalizeAzimuthDeg,
} from '@astranet/shared';

export type CelestialCategory = 'sun' | 'moon' | 'planet' | 'satellite' | 'meteor';

export interface HorizonObject {
  id: string;
  name: string;
  category: CelestialCategory;
  altitudeDeg: number;
  azimuthDeg: number;
  magnitude: number;
  color: string;
  isAboveHorizon: boolean;
  subtitle: string;
  measurements: string;
  description: string;
  sourceNote?: string;
}

export interface ExtractHorizonObjectsOptions {
  brief: DailyBrief | null;
  issLivePosition?: IssLivePosition | null;
  currentTime?: Date;
  /** When true, retains objects with altitudeDeg < 0 for dimmed below-horizon tracking. Default: true */
  includeBelowHorizon?: boolean;
}

/**
 * Adapts DailyBrief data and real live ISS telemetry into standardized HorizonObject records.
 * Follows ASTRA-NET's strict honesty rules:
 * - No procedurally generated or fabricated celestial positions.
 * - If an upstream source or field is unavailable/null, its marker is omitted.
 * - Reuses existing coordinate algorithms (Meeus, JPL Horizons, satellite.js, IMO radiants).
 */
export function extractHorizonObjects(options: ExtractHorizonObjectsOptions): HorizonObject[] {
  const {
    brief,
    issLivePosition = null,
    currentTime = new Date(),
    includeBelowHorizon = true,
  } = options;
  if (!brief) return [];

  const objects: HorizonObject[] = [];
  const skyAnchor = brief.skyAnchor?.status === 'ok' ? brief.skyAnchor.data : null;

  // 1. Sun (Meeus algorithm via backend engine)
  if (
    skyAnchor &&
    Number.isFinite(skyAnchor.sunAltitudeDeg) &&
    Number.isFinite(skyAnchor.sunAzimuthDeg)
  ) {
    const alt = skyAnchor.sunAltitudeDeg;
    const az = normalizeAzimuthDeg(skyAnchor.sunAzimuthDeg);
    const above = alt >= 0;

    if (above || includeBelowHorizon) {
      objects.push({
        id: 'sun',
        name: 'Sun',
        category: 'sun',
        altitudeDeg: alt,
        azimuthDeg: az,
        magnitude: -26.74,
        color: '#d9a05b', // --color-solar
        isAboveHorizon: above,
        subtitle: `${skyAnchor.twilightPhase.toUpperCase()} PHASE`,
        measurements: `${formatAltitudeDeg(alt)} · ${formatAzimuthDeg(az)}`,
        description: `Primary star governing local ${skyAnchor.twilightPhase} lighting conditions.`,
        sourceNote: 'Meeus Ephemeris Engine',
      });
    }
  }

  // 2. Moon (Meeus algorithm via backend engine)
  if (
    skyAnchor?.moon &&
    Number.isFinite(skyAnchor.moon.altitudeDeg) &&
    Number.isFinite(skyAnchor.moon.azimuthDeg)
  ) {
    const moon = skyAnchor.moon;
    const alt = moon.altitudeDeg;
    const az = normalizeAzimuthDeg(moon.azimuthDeg);
    const above = alt >= 0;

    if (above || includeBelowHorizon) {
      const illumPct = Math.round(moon.illuminatedFraction * 100);
      const estMag = -12.7 + 2.5 * Math.log10(1 / Math.max(0.05, moon.illuminatedFraction));

      objects.push({
        id: 'moon',
        name: 'Moon',
        category: 'moon',
        altitudeDeg: alt,
        azimuthDeg: az,
        magnitude: Number(estMag.toFixed(1)),
        color: '#eef1f1', // --color-sky-100
        isAboveHorizon: above,
        subtitle: `${moon.phaseName} (${illumPct}%)`,
        measurements: `${formatAltitudeDeg(alt)} · ${formatAzimuthDeg(az)}`,
        description: `Natural satellite in ${moon.phaseName.toLowerCase()} phase with ${illumPct}% illuminated disc.`,
        sourceNote: 'Meeus Lunar Engine',
      });
    }
  }

  // 3. Major Planets (JPL Horizons via backend poller)
  const planetsConfig: Array<{
    id: string;
    name: string;
    color: string;
    mag: number;
    sub: string;
    desc: string;
    data: { altitudeDeg: number; azimuthDeg: number } | null | undefined;
  }> = [
    {
      id: 'venus',
      name: 'Venus',
      color: '#d6dcdc', // --color-sky-200
      mag: -4.4,
      sub: 'INFERIOR PLANET',
      desc: 'Brilliant second planet, cloaked in highly reflective sulfuric acid clouds.',
      data: skyAnchor?.venus,
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      color: '#c9b187', // --color-brass-300
      mag: -2.2,
      sub: 'GAS GIANT',
      desc: 'Largest planet in the solar system with vast atmospheric storm belts.',
      data: skyAnchor?.jupiter,
    },
    {
      id: 'mars',
      name: 'Mars',
      color: '#b08968', // --color-neo
      mag: -1.0,
      sub: 'TERRESTRIAL PLANET',
      desc: 'The Red Planet, featuring iron oxide surface regolith and frozen polar caps.',
      data: skyAnchor?.mars,
    },
    {
      id: 'saturn',
      name: 'Saturn',
      color: '#c9b187', // --color-brass-300
      mag: 0.5,
      sub: 'RINGED GIANT',
      desc: 'Extensive ice and dust ring system orbiting a golden-hued gas giant.',
      data: skyAnchor?.saturn,
    },
    {
      id: 'mercury',
      name: 'Mercury',
      color: '#a8b4bc', // --color-orbital
      mag: -0.5,
      sub: 'INMOST PLANET',
      desc: 'Smallest, innermost rocky planet orbiting tightly within the solar gravity well.',
      data: skyAnchor?.mercury,
    },
  ];

  for (const planet of planetsConfig) {
    if (
      planet.data &&
      isValidHorizonCoordinates({
        altitudeDeg: planet.data.altitudeDeg,
        azimuthDeg: planet.data.azimuthDeg,
      })
    ) {
      const alt = planet.data.altitudeDeg;
      const az = normalizeAzimuthDeg(planet.data.azimuthDeg);
      const above = alt >= 0;

      if (above || includeBelowHorizon) {
        objects.push({
          id: planet.id,
          name: planet.name,
          category: 'planet',
          altitudeDeg: alt,
          azimuthDeg: az,
          magnitude: planet.mag,
          color: planet.color,
          isAboveHorizon: above,
          subtitle: planet.sub,
          measurements: `${formatAltitudeDeg(alt)} · ${formatAzimuthDeg(az)}`,
          description: planet.desc,
          sourceNote: 'JPL Horizons Ephemeris',
        });
      }
    }
  }

  // 4. International Space Station (ISS)
  // Priority 1: Real-time geodetic position from N2YO stream computed via satellite.js topocentric angles
  // Priority 2: Predicted pass window interpolation for this observer
  let issTopocentric: { altitudeDeg: number; azimuthDeg: number; note: string } | null = null;

  if (issLivePosition && brief.observer) {
    const live = computeIssTopocentricPosition(
      issLivePosition.latitudeDeg,
      issLivePosition.longitudeDeg,
      issLivePosition.altitudeKm,
      brief.observer.latDeg,
      brief.observer.lonDeg,
    );
    issTopocentric = {
      altitudeDeg: live.altitudeDeg,
      azimuthDeg: normalizeAzimuthDeg(live.azimuthDeg),
      note: 'N2YO Live SSE Stream',
    };
  } else if (brief.iss?.status === 'ok' && brief.iss.data?.nextPass) {
    const pass = brief.iss.data.nextPass;
    const interpolated = interpolatePassPosition(pass, currentTime.getTime() / 1000);
    if (interpolated) {
      issTopocentric = {
        altitudeDeg: interpolated.altitudeDeg,
        azimuthDeg: normalizeAzimuthDeg(interpolated.azimuthDeg),
        note: `Pass Prediction (${pass.startAzimuthCompass} → ${pass.endAzimuthCompass})`,
      };
    }
  }

  if (
    issTopocentric &&
    isValidHorizonCoordinates({
      altitudeDeg: issTopocentric.altitudeDeg,
      azimuthDeg: issTopocentric.azimuthDeg,
    })
  ) {
    const alt = issTopocentric.altitudeDeg;
    const az = issTopocentric.azimuthDeg;
    const above = alt >= 0;

    if (above || includeBelowHorizon) {
      const mag =
        brief.iss?.status === 'ok' && brief.iss.data?.nextPass?.magnitude != null
          ? brief.iss.data.nextPass.magnitude
          : -2.0;

      objects.push({
        id: 'iss',
        name: 'ISS (Zarya)',
        category: 'satellite',
        altitudeDeg: alt,
        azimuthDeg: az,
        magnitude: mag,
        color: '#a8b4bc', // --color-orbital
        isAboveHorizon: above,
        subtitle: 'CREWED SPACE STATION',
        measurements: `${formatAltitudeDeg(alt)} · ${formatAzimuthDeg(az)}`,
        description:
          'Human orbital outpost traveling at ~27,600 km/h in Low Earth Orbit (~400 km altitude).',
        sourceNote: issTopocentric.note,
      });
    }
  }

  // 5. Active Meteor Shower Radiant
  if (brief.observer) {
    const activeRadiant = visibleShowerRadiant(
      currentTime,
      brief.observer.latDeg,
      brief.observer.lonDeg,
    );

    if (
      activeRadiant &&
      isValidHorizonCoordinates({
        altitudeDeg: activeRadiant.altitudeDeg,
        azimuthDeg: activeRadiant.azimuthDeg,
      })
    ) {
      const alt = activeRadiant.altitudeDeg;
      const az = normalizeAzimuthDeg(activeRadiant.azimuthDeg);
      const above = alt >= 0;

      if (above || includeBelowHorizon) {
        objects.push({
          id: `meteor-${activeRadiant.shower.id}`,
          name: `${activeRadiant.shower.name} Radiant`,
          category: 'meteor',
          altitudeDeg: alt,
          azimuthDeg: az,
          magnitude: 2.5,
          color: '#7fa88a', // --color-aurora
          isAboveHorizon: above,
          subtitle: `METEOR RADIANT · ZHR ${activeRadiant.shower.zhr}`,
          measurements: `${formatAltitudeDeg(alt)} · ${formatAzimuthDeg(az)}`,
          description: `Radiant point of active ${activeRadiant.shower.name} meteor stream. Expected rate: ~${activeRadiant.shower.zhr} meteors/hr.`,
          sourceNote: 'IMO Working List',
        });
      }
    }
  }

  return objects;
}
