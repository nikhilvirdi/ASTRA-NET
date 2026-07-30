# ASTRANET — Data Model

Plain-English overview of the data model and the reasoning behind it. **`prisma/schema.prisma` is the real source of truth** — this document explains the _why_, not the exact field syntax. When the two disagree, the Prisma schema wins and this doc should be updated.

Guiding principles (from `ARCHITECTURE.md`): single Postgres, no second datastore; JSONB for genuinely fluid data; cache as a table, not Redis; **no account system** — nothing in this schema identifies a visitor.

---

## Overview

Three models, all independent of one another:

```
Prediction     (global — every aurora prediction the Causal Engine makes)
ShareCard      (public — a frozen, anonymous snapshot of a Brief moment)
Cache          (standalone — TTL'd upstream payloads)
```

There is intentionally nothing else. ASTRANET originally had `User`, `Session`, `Location`, and `SkyLogEntry` models backing a custom-JWT account system; that system was removed entirely by explicit human decision (see `DECISIONS.md`), and those four models and their migration-level cascades were dropped along with it — not deprecated in place, actually gone from the schema. Location, the Personal Sky Log, and alert preferences are now plain client-side state (browser `localStorage`, `apps/web/src/store`), never sent to or stored by the backend.

---

## Prediction

Every aurora prediction the Causal Engine makes, stored so it can later be scored — the backbone of the honesty/accuracy loop (`ARCHITECTURE.md` §6, `FORMULAS.md` §8–§9).

- `made_at` (when predicted), `target_time` (when the event was predicted to occur).
- `predicted_kp`, `confidence` (the C value + band), and a JSONB `context` blob (which CME, the observer's geomagnetic latitude, lead time, the factor breakdown).
- `actual_kp` (nullable) + a `scored` flag — filled in later by the daily accuracy job.
- Derived `hit` boolean once scored (`|predicted - actual| <= 1`, §9).

**Global, not per-user:** there is no account system, so a row is written for every qualifying Brief request with an active CME — not gated on who's looking, since there's no "who" to gate on. `/api/accuracy`'s public track record and the Causal Engine's own `f_hist` factor both read the whole table with no ownership filter. This was already true in practice before the account system was removed (`DECISIONS.md`, 2026-07-22 — the aggregation was global even while the row carried a since-removed `userId`), so removing the column changed nothing about how the numbers are computed.

**Why store every prediction:** the `/accuracy` page and `f_hist` both depend on a real, growing track record. Without persisting predictions, "we track how right we are" would be an empty claim. The daily job reads unscored, elapsed predictions, fetches observed Kp, and writes back `actual_kp`/`hit` — that closed loop is what feeds `hits`/`trials` back into confidence. This table is small but it's the product's integrity made concrete.

---

## ShareCard

A frozen, self-contained snapshot of a Brief moment, served publicly at `/share/:id` (`ARCHITECTURE.md` §8, WORKPLAN.md Phase 11).

- `id` is a random URL-safe token (9 bytes from `node:crypto`, base64url) rather than `@default(cuid())` — this row is world-readable by anyone holding the id and carries the observer's coordinates, so ids must not be enumerable or time-ordered.
- `capturedAt`, `latitude`, `longitude` denormalized alongside the full `snapshot` JSONB blob, so simple queries don't need to parse the blob.

**Why no owner field:** every visitor is anonymous — there is no account for a card to belong to. A card is a standalone public artifact from the moment it's created, not something anyone can later delete via an account (it does not need to be, since it identifies no one).

---

## Cache

Standalone TTL store for upstream API payloads — the "no Redis" decision (`ARCHITECTURE.md` §3 B).

- A key (source + query signature), a JSONB `value`, and an `expires_at` timestamp.
- Cleaned on read (expired row → miss → refetch) plus a periodic sweep.

**Why a table, not Redis:** the cache needs are modest (slow-tier payloads, N2YO visual-pass responses, Open-Meteo per-cell results), Postgres JSONB + a TTL column covers it with zero extra infrastructure, and it survives restarts. Redis's free tiers are stingy and add an operational component for no real gain here. If a genuine high-throughput caching need ever appears, this is the one place a second datastore could later be justified — but not preemptively.

---

## What's Deliberately NOT Modeled

- **Accounts, sessions, or any per-visitor identity** — removed entirely; there is no login (`ARCHITECTURE.md` §3 G, `DECISIONS.md`).
- **Location, the Personal Sky Log, and alert preferences** — client-side state only (`apps/web/src/store`, persisted to `localStorage`). The server never sees them and has no table for them.
- **Live telemetry / poller state** — lives in memory, rebuilt on boot, never persisted (`ARCHITECTURE.md` §4). The DB stores the accuracy record and share cards, not the live feed.
- **Deep-sky / cosmological objects** — horizon features, not in scope (`NOTES.md`).
- **Analytics / event tracking tables** — not part of the core product; add only if a real need appears.
- **Soft-delete flags** — nothing in this schema identifies anyone to delete-on-request in the first place; a visitor's local "clear local data" action is a client-side operation, not a server-side one.

---

## Indexing & Access Notes (for implementation)

- Index the common query paths: `Prediction(scored, target_time)` for the accuracy job, `Cache(expires_at)` for the sweep.
- **No per-user isolation exists to enforce** — every row in every table here is either global (`Prediction`) or already public by design (`ShareCard`). There is no "another user's rows" concept for an endpoint to accidentally leak.
