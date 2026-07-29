/**
 * Zod schemas for `/api/share` (WORKPLAN.md Phase 11).
 *
 * Same both-ways discipline as `best-spot.schemas.ts`: query/body params
 * are untrusted client input, and the response is validated on the way out
 * because it is the contract `apps/web` will be written against.
 *
 * This endpoint adds a third boundary the others do not have. A snapshot is
 * read back out of Postgres JSONB, possibly months after it was written and
 * possibly by a *later* build of this server — so the stored blob is
 * untrusted input too, and is parsed through the same schema on read. That
 * is what makes "self-contained" a checkable property rather than a claim:
 * a row that no longer satisfies the schema is reported as a 404-equivalent
 * failure instead of being half-rendered.
 */

import { z } from 'zod';

/**
 * Bumped whenever a stored snapshot's shape changes incompatibly. Old
 * rows keep their original version, so a future reader can migrate them
 * deliberately rather than discovering the difference by crashing.
 */
export const SHARE_SNAPSHOT_SCHEMA_VERSION = 1;

/** Rejects NaN/Infinity, which `z.number()` alone permits and JSON renders as `null`. */
const finite = () => z.number().finite();

/**
 * 12 URL-safe characters from `crypto.randomBytes(9)`. Deliberately not
 * `cuid()` like every other model's id: a share card is world-readable by
 * anyone holding its id and carries the observer's coordinates, so ids
 * must not be guessable or enumerable.
 */
export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
export const ShareIdSchema = z.string().regex(SHARE_ID_PATTERN);

export const ShareObserverSchema = z
  .object({
    latDeg: finite().min(-90).max(90),
    lonDeg: finite().min(-180).max(180),
    /**
     * An honest derived coordinate label ("51.51°N 0.13°W"), never a place
     * name: ARCHITECTURE.md names no geocoder, and Phase 9 already
     * established that inventing plausible place names is fabricated data.
     */
    label: z.string().min(1),
  })
  .strict();

/**
 * Everything the twilight-accurate render needs, resolved once at capture
 * time. `surfaceHex` is stored rather than recomputed on read so the card,
 * the OG image, and any future client can never disagree about the color
 * of a moment that has already passed.
 */
export const ShareSkySchema = z
  .object({
    sunAltitudeDeg: finite().min(-90).max(90),
    sunAzimuthDeg: finite().min(0).lt(360),
    /** FORMULAS.md §4's three-way split, as the Brief already reports it. */
    twilightPhase: z.enum(['day', 'twilight', 'night']),
    /** DESIGN_SPEC.md §2's five-phase table. */
    twilightBand: z.enum(['day', 'civil', 'nautical', 'astronomical', 'night']),
    twilightValue: finite().min(0).max(3),
    surfaceHex: z.string().regex(/^#[0-9A-F]{6}$/),
  })
  .strict();

/**
 * One of DESIGN_SPEC.md §17's "three key measurements". Both halves are
 * pre-formatted strings: the value carries its unit (Part VII —
 * "Measurements always carry units. Always.") and is formatted once,
 * server-side, so the JSON card and the rasterized OG image cannot render
 * the same measurement two different ways.
 */
export const ShareFactSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict();

export const ShareMarkerSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    sublabel: z.string().min(1),
    type: z.enum(['sun', 'moon', 'planet', 'iss']),
    azimuthDeg: finite().min(0).lt(360),
    altitudeDeg: finite().min(-90).max(90),
  })
  .strict();

/**
 * What was and was not reachable at capture time, carried forward so a
 * card viewed later can be honest about it (ARCHITECTURE.md §5). A card
 * made during a DONKI outage should not read as though space weather was
 * simply quiet.
 */
export const ShareAvailabilitySchema = z
  .object({
    brief: z.enum(['ok', 'unavailable']),
    skyAnchor: z.enum(['ok', 'unavailable']),
    iss: z.enum(['ok', 'unavailable']),
    spaceWeather: z.enum(['ok', 'unavailable']),
    neoImagery: z.enum(['ok', 'unavailable']),
  })
  .strict();

export const ShareSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SHARE_SNAPSHOT_SCHEMA_VERSION),
    id: ShareIdSchema,
    /** When the card was generated. */
    createdAt: z.string().datetime(),
    /** The Brief moment the card freezes — `DailyBrief.generatedAt`. */
    capturedAt: z.string().datetime(),
    observer: ShareObserverSchema,
    sky: ShareSkySchema,
    headline: z.string().min(1),
    /**
     * §17 asks for three. Fewer is allowed only because a total upstream
     * outage should still produce a card rather than a 500; in practice
     * the Sky Anchor card cannot fail (it is pure math), so three always
     * resolve. Never more than three — that would be a different design.
     */
    facts: z.array(ShareFactSchema).max(3),
    horizon: z
      .object({
        markers: z.array(ShareMarkerSchema),
      })
      .strict(),
    availability: ShareAvailabilitySchema,
  })
  .strict();

export type ShareSnapshot = z.infer<typeof ShareSnapshotSchema>;
export type ShareObserver = z.infer<typeof ShareObserverSchema>;
export type ShareSky = z.infer<typeof ShareSkySchema>;
export type ShareFact = z.infer<typeof ShareFactSchema>;
export type ShareMarker = z.infer<typeof ShareMarkerSchema>;

/**
 * `POST /api/share` body. Only the observer position — the server rebuilds
 * the Brief itself rather than accepting a client-supplied payload, which
 * would be both unverifiable and forgeable (a shared card is a public
 * claim about the sky, so it has to be one this server made).
 */
export const CreateShareBodySchema = z
  .object({
    lat: z.coerce.number().finite().min(-90).max(90),
    lon: z.coerce.number().finite().min(-180).max(180),
  })
  .strict();

export const CreateShareResponseSchema = z
  .object({
    id: ShareIdSchema,
    /** Where the card lives for a human, ready to paste. */
    shareUrl: z.string().url(),
    /** The 1200x630 PNG, absolute because OG consumers require it. */
    ogImageUrl: z.string().url(),
    snapshot: ShareSnapshotSchema,
  })
  .strict();
