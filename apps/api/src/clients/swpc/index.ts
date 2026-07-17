/**
 * Barrel export for the NOAA SWPC client.
 * Consumers import from '@astranet/api/clients/swpc' (or the relative path).
 */

export {
  fetchSwpcFast,
  fetchSwpcSlow,
  SWPC_FAST_FALLBACK,
  SWPC_SLOW_FALLBACK,
} from './swpc.client.js';
export type {
  SwpcFastData,
  SwpcSlowData,
  SwpcKpCurrent,
  SwpcKpObservedEntry,
  SwpcKpForecastEntry,
  SwpcSolarWindEntry,
  SwpcRtswPlasma,
  SwpcForecastStatus,
} from './swpc.types.js';
export {
  KpOneMinuteResponseSchema,
  KpObservedResponseSchema,
  KpForecastResponseSchema,
  SolarWindRawResponseSchema,
  SolarWindResponseSchema,
  RtswWindResponseSchema,
} from './swpc.schemas.js';
