/**
 * Typed output types for the Open-Meteo client.
 */

export interface OpenMeteoHourlyData {
  time: string; // ISO 8601
  cloudCoverPercent: number;
  visibilityMeters: number;
}

export interface OpenMeteoData {
  latitude: number;
  longitude: number;
  hourly: OpenMeteoHourlyData[] | null;
  fetchedAt: string;
}

export const OPEN_METEO_FALLBACK: OpenMeteoData = {
  latitude: 0,
  longitude: 0,
  hourly: null,
  fetchedAt: new Date(0).toISOString(),
};
