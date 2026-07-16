/**
 * Typed output types for the N2YO client.
 */

export interface N2yoPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  azimuth: number;
  elevation: number;
  ra: number;
  dec: number;
  timestamp: number; // Unix timestamp in seconds
  eclipsed: boolean;
}

export interface N2yoVisualPass {
  startAzimuth: number;
  startAzimuthCompass: string;
  startElevation: number;
  startUtc: number; // Unix timestamp in seconds
  maxAzimuth: number;
  maxAzimuthCompass: string;
  maxElevation: number;
  maxUtc: number;
  endAzimuth: number;
  endAzimuthCompass: string;
  endElevation: number;
  endUtc: number;
  magnitude: number;
  duration: number; // seconds
}

export interface N2yoPositionsData {
  satId: number;
  satName: string;
  positions: N2yoPosition[] | null;
  fetchedAt: string;
}

export interface N2yoVisualPassesData {
  satId: number;
  satName: string;
  passes: N2yoVisualPass[] | null;
  fetchedAt: string;
}

export const N2YO_POSITIONS_FALLBACK: N2yoPositionsData = {
  satId: 0,
  satName: 'Unknown',
  positions: null,
  fetchedAt: new Date(0).toISOString(),
};

export const N2YO_VISUAL_PASSES_FALLBACK: N2yoVisualPassesData = {
  satId: 0,
  satName: 'Unknown',
  passes: null,
  fetchedAt: new Date(0).toISOString(),
};
