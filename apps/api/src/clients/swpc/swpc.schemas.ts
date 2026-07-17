/**
 * Zod schemas for NOAA SWPC (Space Weather Prediction Center) endpoints.
 *
 * All schemas are derived from live response shapes fetched 2026-07-15.
 * See DECISIONS.md entry "NOAA SWPC solar wind endpoint paths differ from API_SOURCES.md"
 * for why the documented paths in API_SOURCES.md were corrected.
 *
 * Endpoints used (tier per API_SOURCES.md's own Fast/Slow Tier sections):
 *   - /json/planetary_k_index_1m.json        (fast tier: 1-min estimated Kp)
 *   - /products/noaa-planetary-k-index.json   (slow tier: 3-hour observed Kp, 7-day history)
 *   - /products/noaa-planetary-k-index-forecast.json  (slow tier: 3-day Kp forecast)
 *   - /products/geospace/propagated-solar-wind-1-hour.json (slow tier: solar wind tuple array)
 *   - /json/rtsw/rtsw_wind_1m.json            (fast tier: 1-min RTSW plasma, speed, density)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1-minute Kp  (/json/planetary_k_index_1m.json)
// Real shape: [{time_tag, kp_index, estimated_kp, kp}, ...]
// ---------------------------------------------------------------------------
export const KpOneMinuteEntrySchema = z.object({
  time_tag: z.string(), // ISO-8601 local UTC string e.g. "2026-07-14T13:08:00"
  kp_index: z.number().int().min(0).max(9),
  estimated_kp: z.number().min(0).max(9),
  kp: z.string(), // e.g. "1Z", "1P", "0M" — integer + letter suffix
});

export const KpOneMinuteResponseSchema = z.array(KpOneMinuteEntrySchema);

export type KpOneMinuteEntry = z.infer<typeof KpOneMinuteEntrySchema>;
export type KpOneMinuteResponse = z.infer<typeof KpOneMinuteResponseSchema>;

// ---------------------------------------------------------------------------
// Observed 3-hour Kp  (/products/noaa-planetary-k-index.json)
// Real shape: [{time_tag, Kp, a_running, station_count}, ...]
// ---------------------------------------------------------------------------
export const KpObservedEntrySchema = z.object({
  time_tag: z.string(),
  Kp: z.number().min(0).max(9),
  a_running: z.number().int().min(0),
  station_count: z.number().int().min(0),
});

export const KpObservedResponseSchema = z.array(KpObservedEntrySchema);

export type KpObservedEntry = z.infer<typeof KpObservedEntrySchema>;
export type KpObservedResponse = z.infer<typeof KpObservedResponseSchema>;

// ---------------------------------------------------------------------------
// 3-day Kp forecast  (/products/noaa-planetary-k-index-forecast.json)
// Real shape: [{time_tag, kp, observed, noaa_scale}, ...]
// 'observed' field is: "observed" | "estimated" | "predicted"
// noaa_scale is nullable ("G1"–"G5" for Kp≥5, else null)
// ---------------------------------------------------------------------------
export const KpForecastStatusSchema = z.enum(['observed', 'estimated', 'predicted']);

export const KpForecastEntrySchema = z.object({
  time_tag: z.string(),
  kp: z.number().min(0).max(9),
  observed: KpForecastStatusSchema,
  noaa_scale: z.string().nullable(),
});

export const KpForecastResponseSchema = z.array(KpForecastEntrySchema);

export type KpForecastEntry = z.infer<typeof KpForecastEntrySchema>;
export type KpForecastResponse = z.infer<typeof KpForecastResponseSchema>;
export type KpForecastStatus = z.infer<typeof KpForecastStatusSchema>;

// ---------------------------------------------------------------------------
// Propagated solar wind  (/products/geospace/propagated-solar-wind-1-hour.json)
// Real shape: tuple array — first row is headers, rest are value tuples.
// Headers: ["time_tag","speed","density","temperature","bx","by","bz","bt","vx","vy","vz","propagated_time_tag"]
// ---------------------------------------------------------------------------

// Raw wire format — array of (string | number | null)[]
const SolarWindTupleSchema = z.array(z.union([z.string(), z.number(), z.null()]));
export const SolarWindRawResponseSchema = z.array(SolarWindTupleSchema);

// Parsed/normalised form after we convert the tuple array to objects
export const SolarWindEntrySchema = z.object({
  time_tag: z.string(),
  speed: z.number().nullable(), // km/s
  density: z.number().nullable(), // p/cm³
  temperature: z.number().nullable(), // K
  bx: z.number().nullable(), // nT
  by: z.number().nullable(), // nT
  bz: z.number().nullable(), // nT — southward (-) drives geomagnetic storms
  bt: z.number().nullable(), // nT — total field magnitude
  vx: z.number().nullable(),
  vy: z.number().nullable(),
  vz: z.number().nullable(),
  propagated_time_tag: z.string().nullable(),
});

export const SolarWindResponseSchema = z.array(SolarWindEntrySchema);

export type SolarWindEntry = z.infer<typeof SolarWindEntrySchema>;
export type SolarWindResponse = z.infer<typeof SolarWindResponseSchema>;

// ---------------------------------------------------------------------------
// RTSW 1-minute plasma  (/json/rtsw/rtsw_wind_1m.json)
// Real shape: [{time_tag, active, source, proton_speed, proton_density, ...}, ...]
// Many fields are nullable (especially alpha particle fields).
// We only validate the fields we actually use; extras are passthrough-ignored.
// ---------------------------------------------------------------------------
export const RtswWindEntrySchema = z
  .object({
    time_tag: z.string(),
    active: z.boolean(),
    source: z.string(), // "SOLAR1", "ACE", etc.
    proton_speed: z.number().nullable(),
    proton_temperature: z.number().nullable(),
    proton_density: z.number().nullable(),
    overall_quality: z.number().int().min(0).max(9),
  })
  .passthrough(); // ignore the many alpha/vx/vy fields we don't need

export const RtswWindResponseSchema = z.array(RtswWindEntrySchema);

export type RtswWindEntry = z.infer<typeof RtswWindEntrySchema>;
export type RtswWindResponse = z.infer<typeof RtswWindResponseSchema>;
