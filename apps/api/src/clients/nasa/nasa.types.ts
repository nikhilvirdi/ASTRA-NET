export interface DonkiCmeAnalysis {
  isMostAccurate: boolean;
  time21_5: string | null;
  latitude: number | null;
  longitude: number | null;
  halfAngle: number | null;
  speed: number | null; // km/s
  type: string | null;
}

export interface DonkiCmeEvent {
  activityId: string;
  startTime: string | null;
  note: string | null;
  link: string | null;
  analyses: DonkiCmeAnalysis[];
}

export interface DonkiFlrEvent {
  flrId: string;
  beginTime: string | null;
  peakTime: string | null;
  endTime: string | null;
  classType: string | null;
  sourceLocation: string | null;
  link: string | null;
}

export interface NasaDonkiData {
  cmes: DonkiCmeEvent[] | null;
  flares: DonkiFlrEvent[] | null;
  fetchedAt: string;
}

export interface NeowsCloseApproach {
  date: string;
  epochDate: number;
  velocityKmS: number;
  missDistanceKm: number;
  orbitingBody: string;
}

export interface NeowsObject {
  id: string;
  name: string;
  nasaJplUrl: string;
  absoluteMagnitudeH: number | null;
  estimatedDiameterMinKm: number;
  estimatedDiameterMaxKm: number;
  isPotentiallyHazardous: boolean;
  isSentryObject: boolean;
  closeApproaches: NeowsCloseApproach[];
}

export interface NasaNeowsData {
  elementCount: number;
  objects: NeowsObject[] | null;
  fetchedAt: string;
}

export const NASA_DONKI_FALLBACK: NasaDonkiData = {
  cmes: null,
  flares: null,
  fetchedAt: new Date(0).toISOString(),
};

export const NASA_NEOWS_FALLBACK: NasaNeowsData = {
  elementCount: 0,
  objects: null,
  fetchedAt: new Date(0).toISOString(),
};
