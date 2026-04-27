import { create } from 'zustand';

export interface FlareEvent {
  flrID: string;
  beginTime: string;
  peakTime: string;
  endTime: string | null;
  classType: string;
  sourceLocation: string;
  activeRegionNum: number;
  linkedCMEs: string[];
}

export interface CmeData {
  speed: number;
  arrivalTime: string;
  isEarthDirected: boolean;
  type: string;
  source: string;
  window: string;
  confidence: string;
}

interface SolarState {
  kp: number;
  bz: number;
  speed: number;
  density: number;
  temperature: number;
  protonFlux: number;
  xrayFlux: number;
  adityaScore: number;
  scoreBreakdown: { kpContrib: number, flareBonus: number, cmeInbound: number, cmeLessThan24h: number };
  gScale: string;
  flares: FlareEvent[];
  cme: CmeData | null;
}

export const useSolarStore = create<SolarState>(() => ({
  kp: 0,
  bz: 0,
  speed: 0,
  density: 0,
  temperature: 0,
  protonFlux: 0,
  xrayFlux: 0,
  adityaScore: 0,
  scoreBreakdown: { kpContrib: 0, flareBonus: 0, cmeInbound: 0, cmeLessThan24h: 0 },
  gScale: 'G0',
  flares: [],
  cme: null
}));
