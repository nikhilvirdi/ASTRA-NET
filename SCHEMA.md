# ASTRANET — Data Model

Plain-English overview of the data model and the reasoning behind it. **`prisma/schema.prisma` is the real source of truth** — this document explains the *why*, not the exact field syntax. When the two disagree, the Prisma schema wins and this doc should be updated.

Guiding principles (from `ARCHITECTURE.md`): single Postgres, no second datastore; JSONB for genuinely fluid data; cache as a table, not Redis; per-user isolation enforced in the API layer.

---

## Overview

Six core models:

```
User ──1:N── Session          (auth / refresh-token rotation)
User ──1:N── Location         (saved places, one default)
User ──1:N── SkyLogEntry      (what the user has witnessed)
User ──1:N── Prediction       (aurora predictions made for this user's context)
                Cache          (standalone: TTL'd upstream payloads)
```

Only four things are truly relational and user-owned (User, Session, Location, SkyLog, Prediction). Cache is independent. There is intentionally nothing else — no over-modeling for features that don't exist yet.

---

## User

The account. Holds identity and auth material only.

- Email + Argon2 password hash (nullable hash for OAuth-only users).
- Optional Google OAuth identifier, so a Google login links to the same User rather than creating a duplicate.
- Timestamps.

**Why:** kept deliberately thin. Preferences that will grow over time (alert toggles, etc.) live as a JSONB `settings` blob on the User rather than as a wide set of columns — these are read/written together and their shape will evolve, which is exactly the JSONB use case. No migration needed every time a new toggle is added.

**Delete-my-data:** deleting a User cascades to their Sessions, Locations, SkyLogEntries, and Predictions. Deletion means real removal (`ARCHITECTURE.md` §7), so cascade is the intended behavior, not soft-delete flags.

---

## Session

Backs the custom JWT refresh flow (`ARCHITECTURE.md` §3 G).

- Belongs to a User.
- Stores the **hashed** refresh token (never plaintext), issue/expiry timestamps, and enough context (user agent / created-at) to reason about active sessions.
- Rotated on every refresh: the old row is invalidated and a new one written.

**Why a table and not stateless JWT-only:** storing refresh tokens hashed makes them **revocable** — logout, "log out everywhere," and compromise response all become simple row deletes. A purely stateless refresh token can't be revoked before expiry. This is the reason the access token is short-lived (15 min) and the refresh token is the thing we track.

---

## Location

A place the user cares about.

- Belongs to a User.
- Latitude, longitude, a human label ("Home", "Parents' place").
- A `isDefault` flag — exactly one default per user (enforced in the API layer on write).

**Why:** the Daily Brief and alerts are location-scoped. People split time between places or want to check somewhere else's sky, so locations are first-class rows, not a single field on User. Latitude/longitude feed directly into the pure engines (`FORMULAS.md` §3, §5, §7) — they are the personalization key for the whole product.

---

## SkyLogEntry

The Personal Sky Log — what the user has actually witnessed.

- Belongs to a User.
- An event type (ISS pass, aurora night, meteor shower, NEO approach…), a timestamp, and a **JSONB `details` blob** capturing whatever that event type needs (magnitude, duration, Kp at the time, notes).
- A source flag: auto-logged (system detected a pass the user was alerted to) vs. manually added.

**Why JSONB for details:** different event types carry different data. Modeling each as its own table or a giant sparse column set would be over-engineering for a log that's read as a timeline. The blob keeps entries flexible while the queryable fields (user, type, timestamp) stay as real indexed columns. This is the polyglot-in-one-database move — structure where you query, flexibility where you don't.

---

## Prediction

Every aurora prediction the Causal Engine makes, stored so it can later be scored — the backbone of the honesty/accuracy loop (`ARCHITECTURE.md` §6, `FORMULAS.md` §8–§9).

- Belongs to a User (predictions are made for a user's location context).
- `made_at` (when predicted), `target_time` (when the event was predicted to occur).
- `predicted_kp`, `confidence` (the C value + band), and a JSONB `context` blob (which CME, user's geomagnetic latitude, lead time, the factor breakdown).
- `actual_kp` (nullable) + a `scored` flag — filled in later by the daily accuracy job.
- Derived `hit` boolean once scored (`|predicted - actual| <= 1`, §9).

**Why store every prediction:** the `/accuracy` page and the Causal Engine's history factor (`f_hist`, §8) both depend on a real, growing track record. Without persisting predictions, "we track how right we are" would be an empty claim. The daily job reads unscored, elapsed predictions, fetches observed Kp, and writes back `actual_kp`/`hit` — that closed loop is what feeds `hits`/`trials` back into confidence. This table is small but it's the product's integrity made concrete.

---

## Cache

Standalone TTL store for upstream API payloads — the "no Redis" decision (`ARCHITECTURE.md` §3 B).

- A key (source + query signature), a JSONB `value`, and an `expires_at` timestamp.
- Cleaned on read (expired row → miss → refetch) plus a periodic sweep.

**Why a table, not Redis:** the cache needs are modest (slow-tier payloads, Open-Meteo per-cell results), Postgres JSONB + a TTL column covers it with zero extra infrastructure, and it survives restarts. Redis's free tiers are stingy and add an operational component for no real gain here. If a genuine high-throughput caching need ever appears, this is the one place a second datastore could later be justified — but not preemptively.

---

## What's Deliberately NOT Modeled

- **Live telemetry / poller state** — lives in memory, rebuilt on boot, never persisted (`ARCHITECTURE.md` §4). The DB stores durable user data and the accuracy record, not the live feed.
- **Deep-sky / cosmological objects** — horizon features, not in scope (`NOTES.md`).
- **Analytics / event tracking tables** — not part of the core product; add only if a real need appears.
- **Soft-delete flags** — deletion is real deletion (§7), so we cascade instead.

---

## Indexing & Access Notes (for implementation)

- Index the foreign keys and the common query paths: `Location(userId)`, `SkyLogEntry(userId, timestamp)`, `Prediction(userId)`, `Prediction(scored, target_time)` for the accuracy job, `Cache(expires_at)` for the sweep, `Session(hashedToken)` for refresh lookup.
- **Per-user isolation is enforced in the API layer** (there's no Row Level Security since we dropped Supabase) — every query for user-owned rows must be scoped by the authenticated `userId`. No endpoint may read another user's rows.
