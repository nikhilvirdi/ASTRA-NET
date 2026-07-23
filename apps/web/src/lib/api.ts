import { useAppStore, type UserLocation } from '@/store';

// ─── Types matching API /api/brief payload ───────────────────────────────────

export interface SkyAnchorCardData {
  sunAltitudeDeg: number;
  twilightPhase: 'day' | 'twilight' | 'night';
  isDarkEnoughForIssOrAurora: boolean;
  isDarkEnoughForFaintStars: boolean;
  jupiter: { azimuthDeg: number; altitudeDeg: number } | null;
}

export interface IssPositionField {
  latitude: number;
  longitude: number;
  altitude: number;
  timestampUtc: number;
  fetchedAt: string | null;
  healthy: boolean;
}

export interface IssNextPassField {
  startUtc: number;
  maxUtc: number;
  endUtc: number;
  maxElevationDeg: number;
  magnitude: number;
  durationSeconds: number;
  // Where on the horizon the pass starts/peaks/ends — the only real ISS
  // azimuths the backend exposes (`iss-card.ts`'s IssNextPassField). There is
  // no per-instant azimuth on the position field; the Horizon Band
  // interpolates across these three points over the pass's own timeline.
  startAzimuthDeg: number;
  startAzimuthCompass: string;
  maxAzimuthDeg: number;
  maxAzimuthCompass: string;
  endAzimuthDeg: number;
  endAzimuthCompass: string;
}

export interface IssCardData {
  position: IssPositionField | null;
  nextPass: IssNextPassField | null;
}

export interface SolarLineFields {
  headline: string;
  live: {
    speedKmS: number | null;
    kp: number | null;
    fetchedAt: string | null;
    healthy: boolean;
  };
  forecast: {
    kp: number | null;
    status: string | null;
    fetchedAt: string | null;
    healthy: boolean;
  };
}

export type ConfidenceBand = 'HIGH' | 'MODERATE' | 'LOW';

export interface AuroraCardData {
  kpPredicted: number;
  kpForecastStatus: string;
  kpForecastTimeTag: string;
  visible: boolean;
  strengthDeg: number;
  strengthFactor: number;
  geomagneticLatitudeDeg: number;
  auroraOvalBoundaryDeg: number;
  hasActiveCme: boolean;
  cmeArrivalTime: string | null;
  cmeActivityId: string | null;
  confidence: number | null;
  confidenceBand: ConfidenceBand | null;
  factors: { lead: number; agreement: number; history: number } | null;
  leadHours: number | null;
}

export interface SpaceWeatherCardData {
  solarLine: SolarLineFields;
  aurora: AuroraCardData | null;
}

export interface NeoField {
  id: string;
  name: string;
  nasaJplUrl: string;
  isPotentiallyHazardous: boolean;
  diameterKm: number | null;
  closeApproachDate: string;
  missDistanceKm: number;
  missDistanceLunarDistances: number;
  velocityKmS: number;
}

export interface ImageryField {
  tileUrl: string;
  layer: string;
  date: string;
}

export interface NeoImageryCardData {
  neo: NeoField | null;
  imagery: ImageryField | null;
}

export interface BriefCard<T> {
  status: 'ok' | 'unavailable';
  data: T | null;
}

export interface DailyBrief {
  observer: { latDeg: number; lonDeg: number };
  generatedAt: string;
  status: 'ok' | 'unavailable';
  skyAnchor: BriefCard<SkyAnchorCardData>;
  iss: BriefCard<IssCardData>;
  spaceWeather: BriefCard<SpaceWeatherCardData>;
  neoImagery: BriefCard<NeoImageryCardData>;
  learningMoment: string;
}

// ─── Default Location Anchor ──────────────────────────────────────────────────
// Srinagar, India — explicit placeholder matching DESIGN_SPEC.md §10 & test suites
export const DEFAULT_OBSERVER_LOCATION: UserLocation = {
  lat: 34.08,
  lon: 74.8,
  name: 'SRINAGAR',
};

/**
 * Resolves effective location using fallback chain:
 * 1. Explicit store.location
 * 2. Default Srinagar coordinates (34.08, 74.80)
 */
export function getEffectiveLocation(): UserLocation {
  const storeLocation = useAppStore.getState().location;
  if (storeLocation) return storeLocation;
  return DEFAULT_OBSERVER_LOCATION;
}

/**
 * Fetches the Daily Brief from /api/brief
 */
export async function fetchBrief(lat: number, lon: number): Promise<DailyBrief> {
  const url = `/api/brief?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to fetch brief: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as DailyBrief;
}
