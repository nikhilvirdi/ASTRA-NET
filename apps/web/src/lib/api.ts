import { useAppStore, type UserLocation } from '@/store';

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
  const url = `/api/brief?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch brief: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as DailyBrief;
}

// ─── Best-Spot-Tonight (/api/best-spot) payload types ───────────────────────

export interface BestSpotClarity {
  factor: number | null;
  cloudCoverPercent: number | null;
  forecastTime: string | null;
  available: boolean;
}

export interface BestSpotDarkness {
  factor: number;
  bortleClass: number;
}

export interface BestSpotTravel {
  factor: number;
  distanceKm: number;
  bearingDeg: number | null;
  compass: string | null;
  travelMinutes: number | null;
}

export interface BestSpotAurora {
  factor: number;
  strengthDeg: number;
  visible: boolean;
  kp: number;
}

export interface BestSpotSite {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
  rank: number;
  score: number;
  clarity: BestSpotClarity;
  darkness: BestSpotDarkness;
  travel: BestSpotTravel;
  aurora: BestSpotAurora | null;
}

export interface BestSpotRanking {
  basis: 'clarity-darkness-travel' | 'darkness-travel';
  clarityAvailable: boolean;
  auroraApplied: boolean;
  note: string | null;
}

export interface BestSpotPayload {
  observer: {
    latDeg: number;
    lonDeg: number;
  };
  generatedAt: string;
  targetTime: string;
  status: 'ok' | 'unavailable';
  ranking: BestSpotRanking;
  sites: BestSpotSite[];
}

export type BestSpotEventFilter = 'all' | 'aurora' | 'meteor' | 'iss';

/**
 * Fetches candidate observation sites ranked by clarity x darkness x travel from /api/best-spot
 */
export async function fetchBestSpot(
  lat: number,
  lon: number,
  event: BestSpotEventFilter = 'all',
  at?: string,
): Promise<BestSpotPayload> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  if (event !== 'all') params.set('event', event);
  if (at) params.set('at', at);

  const res = await fetch(`/api/best-spot?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch best spot payload: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as BestSpotPayload;
}

// ─── Accuracy (/api/accuracy) ─────────────────────────────────────────────────

export interface AccuracyPointData {
  targetTime: string;
  predictedKp: number;
  actualKp: number;
  hit: boolean;
}

export interface AccuracyHitRateData {
  hits: number;
  trials: number;
  rate: number;
  rawRate: number | null;
  prior: {
    hits: number;
    trials: number;
  };
}

export interface AccuracyPayloadData {
  generatedAt: string;
  series: AccuracyPointData[];
  hitRate: AccuracyHitRateData;
  empty: boolean;
}

/** Fetches public accuracy & track record data from GET /api/accuracy */
export async function fetchAccuracy(): Promise<AccuracyPayloadData> {
  const res = await fetch('/api/accuracy');
  if (!res.ok) throw new Error(`Failed to fetch accuracy payload: ${res.status}`);
  return (await res.json()) as AccuracyPayloadData;
}

// ─── Phase 11 API Contracts (Shareable Sky Card /api/share) ──────────────────

export interface ShareObserverData {
  latDeg: number;
  lonDeg: number;
  label: string;
}

export interface ShareSkyData {
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  twilightPhase: 'day' | 'twilight' | 'night';
  twilightBand: 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';
  twilightValue: number;
  surfaceHex: string;
}

export interface ShareFactData {
  label: string;
  value: string;
}

export interface ShareMarkerData {
  id: string;
  label: string;
  sublabel: string;
  type: 'sun' | 'moon' | 'planet' | 'iss';
  azimuthDeg: number;
  altitudeDeg: number;
}

export interface ShareAvailabilityData {
  brief: 'ok' | 'unavailable';
  skyAnchor: 'ok' | 'unavailable';
  iss: 'ok' | 'unavailable';
  spaceWeather: 'ok' | 'unavailable';
  neoImagery: 'ok' | 'unavailable';
}

export interface ShareSnapshotData {
  schemaVersion: number;
  id: string;
  createdAt: string;
  capturedAt: string;
  observer: ShareObserverData;
  sky: ShareSkyData;
  headline: string;
  facts: ShareFactData[];
  horizon: {
    markers: ShareMarkerData[];
  };
  availability: ShareAvailabilityData;
}

export interface CreateShareResponseData {
  id: string;
  shareUrl: string;
  ogImageUrl: string;
  snapshot: ShareSnapshotData;
}

/** Fetches a public share card snapshot from GET /api/share/:id */
export async function fetchShareSnapshot(id: string): Promise<ShareSnapshotData> {
  const res = await fetch(`/api/share/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('NOT_FOUND');
    throw new Error(`Failed to fetch share card: ${res.status}`);
  }
  return (await res.json()) as ShareSnapshotData;
}

/** Creates a share card snapshot from current observer coordinates via POST /api/share */
export async function createShareSnapshot(
  lat: number,
  lon: number,
): Promise<CreateShareResponseData> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) throw new Error(`Failed to create share card: ${res.status}`);
  return (await res.json()) as CreateShareResponseData;
}
