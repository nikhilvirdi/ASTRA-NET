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
// Jammu, India — explicit placeholder matching DESIGN_SPEC.md §10 & test suites
export const DEFAULT_OBSERVER_LOCATION: UserLocation = {
  lat: 32.73,
  lon: 74.87,
  name: 'JAMMU',
};

/**
 * Resolves effective location using fallback chain:
 * 1. Explicit store.location
 * 2. Default Jammu coordinates (32.73, 74.87)
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

  const res = await fetch(`/api/best-spot?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to fetch best spot payload: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as BestSpotPayload;
}

// ─── Phase 10 API Contracts (Sky Log, Settings, Locations, Accuracy, Delete Account) ───

export interface SkyLogEntryData {
  id: string;
  userId: string;
  eventType: string;
  timestamp: string;
  notes: string | null;
  source: 'manual' | 'auto';
  details: {
    kp?: number;
    cloudCoverPercent?: number;
    moonPhase?: string;
  } | null;
  createdAt: string;
}

export interface UserAlertsData {
  iss_pass: boolean;
  aurora: boolean;
  meteor_shower: boolean;
  neo_approach: boolean;
}

export interface DefaultLocationData {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface SettingsPayloadData {
  alerts: UserAlertsData;
  defaultLocation: DefaultLocationData | null;
  alertsDeliverable: boolean;
}

export interface SavedLocationData {
  id: string;
  userId: string;
  label: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

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

/** Fetches personal sky log entries from GET /api/sky-log */
export async function fetchSkyLog(limit = 100): Promise<SkyLogEntryData[]> {
  const res = await fetch(`/api/sky-log?limit=${limit}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Failed to fetch sky log: ${res.status}`);
  }
  return (await res.json()) as SkyLogEntryData[];
}

/** Creates a new manual sky log entry via POST /api/sky-log */
export async function createSkyLogEntry(data: {
  eventType: string;
  timestamp: string;
  notes?: string;
  details?: Record<string, unknown>;
}): Promise<SkyLogEntryData> {
  const res = await fetch('/api/sky-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create log entry: ${res.status}`);
  return (await res.json()) as SkyLogEntryData;
}

/** Deletes a sky log entry via DELETE /api/sky-log/:id */
export async function deleteSkyLogEntry(id: string): Promise<void> {
  const res = await fetch(`/api/sky-log/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to delete log entry: ${res.status}`);
}

/** Fetches user settings from GET /api/settings */
export async function fetchSettings(): Promise<SettingsPayloadData> {
  const res = await fetch('/api/settings', { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Failed to fetch settings: ${res.status}`);
  }
  return (await res.json()) as SettingsPayloadData;
}

/** Updates alert toggles via PUT /api/settings/alerts */
export async function updateAlertSettings(
  alerts: Partial<UserAlertsData>,
): Promise<UserAlertsData> {
  const res = await fetch('/api/settings/alerts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ alerts }),
  });
  if (!res.ok) throw new Error(`Failed to update alerts: ${res.status}`);
  const payload = (await res.json()) as { alerts: UserAlertsData };
  return payload.alerts;
}

/** Fetches saved locations from GET /api/locations */
export async function fetchLocations(): Promise<SavedLocationData[]> {
  const res = await fetch('/api/locations', { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Failed to fetch locations: ${res.status}`);
  }
  return (await res.json()) as SavedLocationData[];
}

/** Creates a saved location via POST /api/locations */
export async function createSavedLocation(data: {
  label: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}): Promise<SavedLocationData> {
  const res = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create location: ${res.status}`);
  return (await res.json()) as SavedLocationData;
}

/** Sets a location as the default override via PUT /api/locations/:id */
export async function setDefaultLocation(id: string): Promise<SavedLocationData> {
  const res = await fetch(`/api/locations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ isDefault: true }),
  });
  if (!res.ok) throw new Error(`Failed to set default location: ${res.status}`);
  return (await res.json()) as SavedLocationData;
}

/** Deletes a saved location via DELETE /api/locations/:id */
export async function deleteSavedLocation(id: string): Promise<void> {
  const res = await fetch(`/api/locations/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to delete location: ${res.status}`);
}

/** Permanently deletes user account & all associated data via DELETE /api/auth/account */
export async function deleteAccount(): Promise<void> {
  const res = await fetch('/api/auth/account', {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to delete account: ${res.status}`);
}

/** Fetches public accuracy & track record data from GET /api/accuracy */
export async function fetchAccuracy(): Promise<AccuracyPayloadData> {
  const res = await fetch('/api/accuracy');
  if (!res.ok) throw new Error(`Failed to fetch accuracy payload: ${res.status}`);
  return (await res.json()) as AccuracyPayloadData;
}
