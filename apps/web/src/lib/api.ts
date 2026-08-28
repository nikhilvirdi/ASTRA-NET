import { useAppStore, type UserLocation } from '@/store';
import { API_BASE } from './config';

// ─── Types matching API /api/brief payload ───────────────────────────────────

export interface MoonCardData {
  altitudeDeg: number;
  azimuthDeg: number;
  phaseName: string;
  illuminatedFraction: number;
  phaseAngleDeg: number;
  nextRiseUtc: string | null;
  nextSetUtc: string | null;
}

export interface SkyAnchorCardData {
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  twilightPhase: 'day' | 'twilight' | 'night';
  isDarkEnoughForIssOrAurora: boolean;
  isDarkEnoughForFaintStars: boolean;
  jupiter: { azimuthDeg: number; altitudeDeg: number } | null;
  venus: { azimuthDeg: number; altitudeDeg: number } | null;
  mars: { azimuthDeg: number; altitudeDeg: number } | null;
  saturn: { azimuthDeg: number; altitudeDeg: number } | null;
  mercury: { azimuthDeg: number; altitudeDeg: number } | null;
  moon?: MoonCardData | null;
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

// ─── Types matching SSE /stream payload (fast tier only) ─────────────────────
// Mirrors apps/api/src/routes/stream.ts — ISS + SWPC solar wind/Kp. Slow-tier
// sources are deliberately absent from the stream's shape (§4 honesty rule).

/** Mirror of the poller store's per-source envelope. */
export interface StreamSourceState<T> {
  data: T | null;
  /** ISO-8601 timestamp of the last successful fetch — the freshness tag. */
  fetchedAt: string | null;
  healthy: boolean;
}

export interface StreamKpCurrent {
  timeTag: string;
  kpIndex: number;
  /** Continuous estimated Kp — the primary Kp used by FORMULAS.md §7. */
  estimatedKp: number;
  kpCode: string;
}

export interface StreamRtswPlasma {
  timeTag: string;
  source: string;
  protonSpeed: number | null; // km/s
  protonDensity: number | null; // p/cm³
  protonTemperature: number | null; // K
  overallQuality: number;
}

export interface StreamSwpcFastData {
  kpCurrent: StreamKpCurrent | null;
  rtswPlasma: StreamRtswPlasma | null;
  fetchedAt: string;
}

export interface StreamIssPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  azimuth: number;
  elevation: number;
  ra: number;
  dec: number;
  /** Unix timestamp in seconds. */
  timestamp: number;
  eclipsed: boolean;
}

/** Mirror of the N2YO client's N2yoPositionsData. */
export interface StreamIssData {
  satId: number;
  satName: string;
  positions: StreamIssPosition[] | null;
  fetchedAt: string;
}

export interface FastTierStreamPayload {
  iss: StreamSourceState<StreamIssData>;
  solarWind: StreamSourceState<StreamSwpcFastData>;
  /** When the SSE push was sent — NOT when data was fetched. Never conflate. */
  streamedAt: string;
}

// ─── Default Location Anchor ──────────────────────────────────────────────────
// Delhi, India — the site-wide default until a visitor sets their own
// location (DESIGN_SPEC.md §10). No account required: this is a plain
// client-side setting, not a saved-per-user value.
export const DEFAULT_OBSERVER_LOCATION: UserLocation = {
  lat: 28.6139,
  lon: 77.209,
  name: 'DELHI',
};

/**
 * Resolves effective location using fallback chain:
 * 1. Explicit store.location (set by the site-wide location switcher)
 * 2. Default Delhi coordinates
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
  const url = `${API_BASE}/api/brief?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch brief: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as DailyBrief;
}
