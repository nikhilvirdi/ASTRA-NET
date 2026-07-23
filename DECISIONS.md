# DECISIONS.md

Short log of real decisions made on ASTRANET, with a one-line "why." Purpose: six weeks in, don't re-litigate a settled call. New entries go at the bottom, newest last, each dated.

**When to add an entry:** any deviation from a locked doc, any new dependency/service, any time an agent flags something in `FORMULAS.md`/`ARCHITECTURE.md`/`SCHEMA.md` that seems wrong. Log the concern here before changing anything.

---

## 2026-07-14 — Project scope: merge original + 34-feature ASTRANET concepts

**Why:** original idea was too plain, the 34-feature version was spectacle with no return-loop. Merged into one product built around personalization + causal explanation, with deep-sky features deferred to `NOTES.md`.

## 2026-07-14 — No versioning / no phased "V1, V2"

**Why:** building the complete, final-scope product from the start — phases in `WORKPLAN.md` are build order, not feature-completeness tiers.

## 2026-07-14 — Cut Constellation Symphony, Apollo Echoes, Fluid Time Machine, Magnetic Shield Stress Test

**Why:** visually impressive but none feed the personalization/return loop. Parked in `NOTES.md`.

## 2026-07-14 — Real-time: two-tier polling, not pure SSE-everywhere or pure cron

**Why:** fast tier (30–60s, ISS/solar wind) needs to feel live; slow tier (5–15min, DONKI/NeoWs/imagery) doesn't need more. Being honest about which is which (live pulse vs. "updated Xm ago") matters more than faking uniform real-time.

## 2026-07-14 — No MongoDB; single Postgres with JSONB

**Why:** dual-database was unjustified — no query pattern that Postgres + JSONB can't serve. One less system to operate, one less free-tier pause to babysit.

## 2026-07-14 — Causal Engine confidence = three multiplicative factors (lead × agreement × history)

**Why:** avoids a fabricated "vibes" percentage; each factor is independently reasoned and testable. See `FORMULAS.md` §8.

## 2026-07-14 — Dropped Supabase; self-hosted PostgreSQL via Docker

**Why:** removes the 7-day free-tier pause entirely; user prefers full control and already runs Docker locally.

## 2026-07-14 — Auth: custom JWT (access + rotated refresh), not Supabase Auth

**Why:** direct consequence of dropping Supabase. Refresh tokens stored hashed in `Session` table for revocability. Google OAuth 2.0 added as an additive path, not a dependency.

## 2026-07-14 — Backend hosting: always-on VPS (Hetzner or Oracle Free ARM), not Render free tier

**Why:** self-hosted Postgres can't live on Render's free web service; owning a box also removes Render's 15-min spin-down/cold-start problem and makes the poller a simple long-running process instead of a GitHub-Actions-cron workaround.

## 2026-07-14 — ORM: Prisma, not Drizzle

**Why:** user's existing familiarity; equivalent capability for this project's needs.

## 2026-07-14 — Project name kept: ASTRANET

**Why:** three rounds of refinement built real name equity; renaming now would be restart-disguised-as-progress. Backronym updated instead (see next entry).

## 2026-07-14 — Backronym changed: "Adaptive Sky Telemetry and Realtime Analysis Network"

**Why:** original expansion ("...Atlas Network") implied comprehensive celestial cataloging — exactly what was cut. New expansion matches what the product actually is: adaptive, personalized, analytical.

## 2026-07-14 — Skipped `ROADMAP.md` as a separate file

**Why:** fully redundant with `WORKPLAN.md`, which already owns milestone order and the `Current Phase` marker.

## 2026-07-14 — Dropped `TECH_STACK.md` as a separate doc

**Why:** overlapped `ARCHITECTURE.md` §2 and the README badges; decided not to maintain two sources of truth for stack info. `ARCHITECTURE.md` is authoritative.

## 2026-07-14 — Data-integrity: `prisma/schema.prisma` found truncated, rewritten to match `SCHEMA.md`

**Why:** a pre-Phase-0 repo audit found the schema file cut off mid-declaration inside the `Prediction` model — missing the rest of `Prediction` (`actualKp`, `scored`, `hit`, its indexes) and the entire `Cache` model. Root cause not determined (likely an interrupted write during initial scaffolding); flagged rather than silently patched since Phase 5/6 work would otherwise have built on a schema missing the accuracy-loop and cache tables without anyone noticing until migration. Rewritten in full against `SCHEMA.md` §Prediction/§Cache and verified at 87 lines (was 66). No downstream code depended on it yet, so no migration cleanup was needed — caught before Phase 6.

## 2026-07-14 — Data-integrity: encoding check on `ARCHITECTURE.md` / `FORMULAS.md` — clean, no action taken

**Why:** same audit asked to check for mojibake (wrong-encoding save) in the ARCHITECTURE.md §1 box-drawing system diagram and the Greek letters (φ, λ, θ) in FORMULAS.md §3/§7, given the schema truncation raised suspicion about file-write integrity generally. Verified via `file` (reports valid UTF-8 for both) and a targeted grep for common mojibake byte patterns (none found) plus presence-count of the actual glyphs (9 Greek letters in FORMULAS.md, 29 box-drawing chars in ARCHITECTURE.md). Logging the clean result so this isn't re-checked from scratch later.

## 2026-07-14 — Husky pinned to v9+ (no `_/husky.sh` shim)

**Why:** `.husky/pre-commit` still had the Husky v8-style shim line (`. "$(dirname -- "$0")/_/husky.sh"`) left over from scaffolding, which errors at commit time under Husky v9+ (the shim file no longer exists in v9's install layout). Since Phase 0 tooling installs Husky fresh, pinned `package.json` to `husky@^9.1.7` (latest at time of writing) and simplified `pre-commit` to just `npx lint-staged`, matching v9's format.

## 2026-07-14 — Pinned Prisma to v6.x, not v7

**Why:** Prisma 7 removed inline datasource `url`, requiring `prisma.config.ts` + a driver adapter (`@prisma/adapter-pg`). New breaking-change surface with no benefit for this project's needs. v6 matches `SCHEMA.md`/`ARCHITECTURE.md` as written with zero schema changes required. Declared `prisma@^6` in `apps/api` devDependencies and `@prisma/client@^6` in `apps/api` dependencies. Schema verified: `url = env("DATABASE_URL")` intact, no `prisma.config.ts`, no adapter references anywhere in the repo.

## 2026-07-15 — Postgres container moved to host port 5433 (not 5432)

**Why:** local machine already had a native Windows service, `postgresql-x64-18` (PostgreSQL Server 18, PID 7392), bound to `5432:5432` on boot — confirmed unrelated to our `docker-compose.yml` (our stack's other containers, `redflag-postgres`/`redflag-redis`, were already on 5434/6380 from a different project, ruling those out too). Rather than stop or reconfigure a pre-existing native service unrelated to ASTRANET, remapped only our container's host-side port: `docker-compose.yml` postgres service `"5432:5432"` → `"5433:5432"` (container-internal port unchanged), and updated `DATABASE_URL` in both `.env` and `.env.example` to `localhost:5433`. Verified end-to-end: `docker compose up -d` → `astranet-postgres` healthy on `5433`; `npx prisma migrate dev --name init` applied cleanly against it.

## 2026-07-15 — NOAA SWPC solar wind endpoint paths differ from API_SOURCES.md

**Why:** Before writing Phase 1 SWPC client code, fetched all documented endpoints live to confirm real response shapes. Found that the paths assumed in `API_SOURCES.md` (`/products/solar-wind/mag-7-day.json`, `/products/solar-wind/plasma-7-day.json`, and the `*-1-day.json` variants) all return HTTP 404 — they no longer exist. Confirmed live working endpoints are:

- **1-minute Kp (fast tier):** `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json` — JSON array of `{time_tag, kp_index, estimated_kp, kp}` objects.
- **Observed Kp (3-hour, 7-day history):** `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` — JSON array of `{time_tag, Kp, a_running, station_count}` objects.
- **Kp forecast (3-day, observed + predicted):** `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` — JSON array of `{time_tag, kp, observed, noaa_scale}` objects; `observed` field is `"observed"` | `"estimated"` | `"predicted"`.
- **Propagated solar wind (speed/density/B-field, 1-minute):** `https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json` — **tuple array**: first element is the header row (`["time_tag","speed","density","temperature","bx","by","bz","bt","vx","vy","vz","propagated_time_tag"]`), subsequent elements are value tuples.
- **Real-time solar wind plasma (RTSW, 1-minute):** `https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json` — JSON array of objects with `{time_tag, active, source, proton_speed, proton_density, proton_temperature, ...}` fields; many nullable.

`API_SOURCES.md` updated to reflect the corrected endpoints. No changes to `ARCHITECTURE.md` or `SCHEMA.md` — these are implementation-level URL corrections only.

## 2026-07-15 — Phase 2, §2: blackbody T_kelvin → RGB mapping left unimplemented (RESOLVED — see 2026-07-15 "Phase 2 gaps resolved" below)

**Why:** `FORMULAS.md` §2 specifies the Ballesteros B-V → `T_kelvin` formula in full (implemented exactly in `packages/shared/src/engines/star-position.ts`), then says "Then map `T_kelvin` → blackbody RGB" with no formula, curve, or constants given. There is no canonical single formula for this (common approximations — Tanner Helland's piecewise fit, Mitchell Charity's lookup table — disagree with each other at the ±5-10% level and none is named in the frozen doc). Implementing one would mean inventing a constant set that isn't frozen anywhere, which `FORMULAS.md`'s preamble explicitly forbids. `colorTemperatureKelvin()` is implemented and tested up to `T_kelvin`; the RGB step stops there with a code comment pointing here. Flagging to the human rather than picking an interpretation — needs either an explicit formula added to `FORMULAS.md`, or an explicit decision that this mapping belongs in `apps/web` (e.g. via a small rendering-side lookup) rather than the shared pure-math engine.

## 2026-07-15 — Phase 2, §11: aurora-strength → [0,1] normalization left unspecified (RESOLVED — see 2026-07-15 "Phase 2 gaps resolved" below)

**Why:** `FORMULAS.md` §11 says the aurora-nights multiplier comes "from §7 `strength`, normalized to [0,1]" but §7's `strength = |λ_m| - (λ_b - margin_deg)` is an unbounded degree value (realistically roughly -90..+90, no fixed ceiling), and no normalization formula (e.g. a clamp range, a saturation curve) is given anywhere. `packages/shared/src/engines/best-spot.ts` implements the fully-specified multiplicative score (`clarity * darkness * travel`) and a separate `bestSpotScoreAurora(score, auroraFactorNormalized)` that takes an already-normalized `[0,1]` factor as an explicit parameter — the multiplication itself is exact per §11, but normalizing raw `strength` into `[0,1]` is deliberately left to the caller rather than invented here. Flagging to the human for the missing normalization rule.

## 2026-07-15 — Phase 2, §8: Causal Engine composite signature adds `observerLonDeg`

**Why:** the task brief describing Phase 2 asked for the Causal Engine as one pure `(events, forecast, userLat, now) -> prediction` function. `FORMULAS.md` §8's confidence math itself (`f_lead * f_agree * f_hist`) needs none of that — it's implemented as-is in `predictAuroraConfidence(event, forecast, now)` with no location input at all, matching the frozen formula exactly. But folding in §7 aurora _visibility_ for a specific observer (which the brief's 4-arg composite implies, since otherwise `userLat` has no use) requires §7's geomagnetic-latitude dipole transform, `sin(λ_m) = sin(φ)sin(φ_p) + cos(φ)cos(φ_p)cos(θ-θ_p)`, which needs observer longitude `θ` as well as latitude `φ` — a lat-only signature cannot compute it. Added `observerLonDeg` as an explicit 5th-positional-equivalent parameter in `predictAuroraForObserver(event, forecast, observerLatDeg, observerLonDeg, now)` rather than silently dropping longitude or fabricating a lat-only approximation of geomagnetic latitude. Also narrowed "events" (plural in the brief) to a single `CmeEvent` — §8's formulas (`t_remaining`, `Kp_cme`) are inherently single-event with no specified rule for selecting among several, so picking one is an invented policy the frozen doc doesn't define; the brief's plural was read as informal phrasing, not a data-shape requirement. Flagging both choices for confirmation rather than treating them as settled.

## 2026-07-15 — Phase 2 gaps resolved: §2 RGB stays out of `packages/shared`; §11 aurora-strength normalization ratified

**Why:** Human ratified both flagged Phase 2 gaps as final decisions and updated `FORMULAS.md` directly (not left as open questions).

- **§2 RGB:** `T_kelvin` → RGB is confirmed as a rendering-side concern, not a shared-engine one. `FORMULAS.md` §2 now states explicitly that this belongs in `apps/web` using Tanner Helland's blackbody-to-RGB approximation, built when Phase 8 (Explorable Universe) needs it. No `packages/shared` code change — `star-position.ts`'s contract correctly already stops at `T_kelvin`.
- **§11 aurora-strength normalization:** `FORMULAS.md` §11 now defines `AURORA_STRENGTH_SATURATION_DEG = 20` and `aurora_factor = clamp(strength_deg / 20, 0, 1)`. Implemented as `auroraStrengthToFactor()` in `packages/shared/src/engines/aurora.ts` (not `best-spot.ts` — it transforms `aurora.ts`'s own `strength` output). Per the same FORMULAS.md update, `score_aurora` must only be computed when aurora is actually visible that night (§7 `canSeeAurora` true) — plain `score` is used otherwise, so a clamped-to-0 factor never wrongly zeroes an otherwise-good site. That composition (choosing `score` vs `score_aurora` per night) is deferred to Phase 9's Best-Spot Finder; `best-spot.ts` itself is unchanged.
- Also ratified as final (no changes needed): the `observerLonDeg`/single-`CmeEvent` design of `predictAuroraForObserver` from the prior entry above.

## 2026-07-15 — Static datasets (Phase 1) fixed: both ingest scripts were broken, both tests were silently passing on missing fixtures

**Why:** Antigravity's `PROGRESS.md` entry claimed the two static datasets (bright-star catalog, light-pollution atlas) were "ingested," but neither `.bin` file existed — `stars.client.test.ts` and `light-pollution.client.test.ts` both detected the missing fixture, `console.warn`'d, and returned early, which vitest reports as a pass. That's a false-positive test, worse than no test. Taken over as a one-time exception (everything else in Phase 1 — the 7 API clients — remains untouched and correctly Antigravity's).

1. **Tests fixed first:** both now `throw` on a missing `.bin` instead of skip-and-pass. Confirmed both hard-fail before either ingest script was touched.
2. **`ingest-stars.js`:** the HYG-Database GitHub repo is archived; `master`/`hygdata_v3.csv` no longer resolves the intended data. Switched to the archived repo's still-served raw path, `main/hyg/CURRENT/hygdata_v41.csv`. This CSV version provides `dist` directly in parsecs (not raw parallax), with bad/missing-parallax stars sentineled by HYG itself at `dist=100000` (100 kpc) — matching `FORMULAS.md` §1's own 100 kpc shell convention, confirmed not a coincidence. Binary output now stores `dist_pc` raw (no parallax inversion, no row-dropping); `ci` is HYG's native B-V, so `bvFromGaiaBpRp()` (Gaia-specific) is correctly not applied. `packages/shared/src/engines/star-position.ts`'s `starCartesianPosition()` already accepts `distancePc` directly, so this aligns with the existing engine contract without any engine change.
3. **`ingest-light-pollution.js`:** was crashing — `maxMemoryUsageInMB limit exceeded by at least 184MB` decoding `BlackMarble_2016_3km.jpg` (13500x6750, NASA's smallest _science-grade_ tier for this composite, but still >1GB of jpeg-js working memory to decode). Raising Jimp's memory ceiling would have forced through an oversized decode for no benefit — the target output is only a 3600x1800 (0.1°) grid. Found NASA publishes a `01deg` variant of the same 2016 Black Marble composite already at exactly 3600x1800 (`.../144000/144898/BlackMarble_2016_01deg.jpg`, ~780KB) — used that instead; no resize needed, no memory-limit workaround needed.
4. **Confirmed and documented (both `API_SOURCES.md` and here):** this is a rendered poster-image JPEG, not calibrated VIIRS radiance data (Jimp can't decode Black Marble's GeoTIFF/HDF5 science products). Bortle values are a **luma-approximation**, not a physically calibrated radiance measurement — fine for relative darkness ranking in Best-Spot scoring, not a scientific claim.

Both `.bin` files regenerated and both static-dataset tests pass for real (Sirius found at `dist_pc ≈ 2.64`, B-V `< 0.1`; NYC/Cherry-Springs/ocean Bortle values resolve as expected). `PROGRESS.md`'s prior false "done" entry corrected.

**Update, 2026-07-16 — the `TS6307` fixture gap flagged below as unfixed is now resolved.** `npm run typecheck` (`tsc --build --pretty`, CI's actual gate) never ran clean even after the 2026-07-16 ESLint fixes — `@typescript-eslint/parser`'s type-aware linting doesn't enforce a composite project's file-list completeness the way `tsc --build` does, so ESLint passing gave false confidence. Root cause: `apps/api/tsconfig.json`'s `"include": ["src"]` doesn't pull in `.json` files under composite/build mode — a bare directory pattern only expands to the default TS/TSX/D.TS extensions, not JSON, even with `resolveJsonModule: true`. Fixed by widening to `"include": ["src", "src/**/*.json"]`. All 9 `TS6307` errors (across celestrak/jpl-horizons/n2yo/nasa/swpc fixture imports) are gone as of this fix. The remaining `noUncheckedIndexedAccess` errors on the same clients are addressed separately below.

**Also found while verifying "lint/format clean" (part of every task's Definition of Done per `WORKPLAN.md`):** `@types/node` was missing from the entire repo (root `node_modules/@types` had no `node` entry) — every file importing `node:fs`/`node:path`/`node:url`, or using `fetch`/`AbortController`/`setTimeout`/`console`/`global`, typechecked those as `error`/`any`, which cascades into `@typescript-eslint/no-unsafe-*` failures under type-aware linting. Confirmed pre-existing and not scoped to this task: reproduced identically on `apps/api/scratch.js` and (via a stash of this session's changes) on `tsc --noEmit` before any of these fixes existed — it would have blocked Antigravity's own Phase-1 client commits too, and blocks CI's `install → lint → typecheck → test` gate for any node-touching file, not just the static-dataset ones. Fixed at the root (`package.json` devDependencies, `"@types/node": "^20.14.0"`, `npm install`) since it's a pure tooling/dependency gap with zero client-logic changes — no other agent's files were edited. `tsc --noEmit` now resolves node/fetch/global types correctly repo-wide; the two static-dataset files' own remaining `noUncheckedIndexedAccess` "possibly undefined" errors (typed-array index reads) were fixed with `!` non-null assertions, safe here since both are bounds-checked before the read. Not fixed (genuinely out of scope, pre-existing in files this task doesn't own): the `noUncheckedIndexedAccess` errors already present in Antigravity's `n2yo`/`nasa`/`open-meteo`/`swpc` client and test files, the `TS6307` fixture-file-not-in-tsconfig-`include` errors on several of those same clients, and the fact that `.js` files under `apps/api/scripts/` (including pre-existing `scratch.js`) aren't covered by any tsconfig `include`, so `eslint apps/api/scripts/*.js` fails to type-parse — harmless for this task (lint-staged's pre-commit pattern is `*.{ts,tsx}` only, so `.js` scripts aren't commit-gated) but will surface in a full `npm run lint` / CI run. Flagging both for whoever closes Phase 1's Definition of Done.

## 2026-07-16 — One-time --no-verify commit to prevent data loss

**Why:** Antigravity's 7 Phase 1 API clients had never been committed since being written, discovered only when the pre-commit hook (first real run against this code) caught 38 genuine ESLint errors (require-await, no-explicit-any, unsafe error-typed member access, unused vars). Given the acute risk of losing uncommitted work vs. the standing rule against bypassing the lint gate, committed once with --no-verify to preserve the code, with fixing all 38 errors as the immediate next task before Phase 1 can be considered closed. This is not a standing exception — the gate re-applies normally on the next commit.

## 2026-07-16 — Fast-tier poller: ISS NORAD ID and reference observer point

**Why:** `apps/api/src/poller/fast-tier.ts` needs concrete parameters for `fetchN2yoPositions` that no doc (`ARCHITECTURE.md`, `API_SOURCES.md`) specifies. Two calls made, neither an invented constant/threshold in the `FORMULAS.md` sense — both are either a real-world fact or a deliberately neutral placeholder:

- **`satId: 25544`** — the ISS's actual NORAD catalog number. Not invented; this is the real, fixed, public identifier for the ISS, same as CelesTrak/N2YO/every other satellite tracker uses.
- **Reference observer `{ lat: 0, lng: 0, alt: 0 }` ("Null Island")** — N2YO's `/positions` endpoint requires an observer point to compute azimuth/elevation/eclipsed, but the store's `iss` entry only needs the ISS's own lat/long/altitude, which the endpoint returns observer-independent regardless of what observer point is passed. A fixed, neutral observer avoids biasing toward any real location (e.g. picking a "default city" would implicitly favor that region) for data this phase doesn't consume the observer-relative fields of. `seconds: 1` — a single current-position sample, not a trajectory, since the store holds "latest," not a time series.

If a future phase needs real azimuth/elevation for a specific viewer (e.g. an overfly alert), that's a separate, per-user call with the user's actual location — not a reason to change the poller's global ISS-position parameters.

## 2026-07-16 — Slow-tier poller: DONKI/NeoWs date windows, Horizons scoped to the Sun only, GIBS date offset by one day

**Why:** `apps/api/src/poller/slow-tier.ts` needs concrete request parameters for three network clients that no doc pins down:

- **DONKI 7-day lookback** (`startDate` = now-7d, `endDate` = today): a bounded recent-activity window, not the full mission history — matches the slow tier's purpose ("no new CME predictions" fallback language in `API_SOURCES.md` implies "recent" events, not an archive).
- **NeoWs today → +7 days**: not invented — NeoWs's `/feed` endpoint itself enforces a 7-day max span per request (documented in `API_SOURCES.md`'s NeoWs entry as "~1000 req/hr" but the 7-day span is NASA's own API constraint, not a poller choice); forward-looking since NEO close-approaches are inherently a future-event feed.
- **JPL Horizons scoped to the Sun only** (`command: '10'`, geocentric `500@399`): the poller's `PollerState.horizons` is a single `SourceState<HorizonsData>` slot (`store.ts`), not per-body — `fetchHorizons` itself only fetches one body per call. Rather than inventing a multi-body store shape or a fixed list of "the" planets not specified anywhere, scoped this tick to the one body every later phase already needs regardless of scene content: the Sun, for twilight/lighting calculations (`ARCHITECTURE.md` §8's Ground Truth Sky Anchor, Sun-position twilight checks in `packages/shared`). If Phase 8's Explorable Universe later needs per-planet positions live from the poller (vs. computed client-side via `packages/shared`'s engines), that's a store-shape change to flag then, not a reason to guess a planet list now.
- **GIBS layer date = yesterday, not today** (`now - 1 day`): GIBS's daily composite mosaics for `VIIRS_SNPP_CorrectedReflectance_TrueColor` are not fully assembled until the day after acquisition — a same-day request risks a blank or partial tile for the entire current UTC day, which would be a visible regression for a "the scene never breaks" fallback (`API_SOURCES.md`'s GIBS entry). Not sourced from any doc in this repo; flagging here in case it needs revisiting once the frontend actually renders a GIBS tile and can confirm the real cutover behavior for this specific layer.

## 2026-07-17 — Fixed: SWPC client was silently promoting slow-tier data into the fast tier

**Why:** During Phase 3 close-out `/phase-check`, found that Phase 1's `fetchSwpc()` (Antigravity) fetched all five SWPC products — including the three `API_SOURCES.md` explicitly files under "Slow Tier" (observed Kp history, 3-day forecast, propagated solar wind) — in one call, and `fast-tier.ts` was the only loop that ever called it, every 45s. This directly violated `ARCHITECTURE.md` §4's explicit rule ("never promote a slow source into the fast tier") and `WORKPLAN.md` Phase 3's agent expectations, which this same close-out task asked to verify. `swpc.schemas.ts`'s own header comment also mislabeled the propagated-solar-wind endpoint as "fast tier," which is likely how the mistake happened — corrected that comment too.

Practical risk was low (SWPC is keyless/no rate limit, so nothing was breaking, and the over-fetched data was still honestly fresh, not stale-but-mislabeled) but it's a direct rule violation, not a rounding error, so flagged to the human rather than silently deciding. Chose the real fix over logging an accepted deviation:

- Split `fetchSwpc()` into `fetchSwpcFast()` (1-min Kp + RTSW plasma) and `fetchSwpcSlow()` (observed Kp history + 3-day forecast + propagated solar wind), each returning its own type (`SwpcFastData` / `SwpcSlowData`) instead of one combined `SwpcData`. The removed `SwpcData`/`SWPC_FALLBACK` had no consumers outside `apps/api` (confirmed via a full-repo grep before removing).
- Split the poller store's single `solarWind` slot into `solarWind` (fast, written only by `fast-tier.ts`) and a new `spaceWeatherForecast` slot (slow, written only by `slow-tier.ts`), each with its own independent health/freshness tracking — this was the part that actually closes the gap, since a shared slot written by both tiers would have let the fast tier's more-frequent writes silently overwrite the slow tier's freshness intent anyway.
- `slow-tier.ts`'s SWPC-slow write follows the same total-failure-preserves-previous / partial-failure-still-healthy pattern already established for DONKI and the fast-tier's own SWPC handling, for consistency.
- Added an orchestration-level regression test (`phase3-orchestration.test.ts`) asserting the fast-tier loop's client set has no `fetchSwpcSlow` property and vice versa, so this can't silently regress by one loop's client wiring drifting back together.

## 2026-07-17 — [BACKFILLED] Phase 4: CME speed-error placeholder, active-CME selection policy, Sky Anchor's server-side scope

**These three entries are backfilled** — written during this session's Phase 4 verification pass, after discovering that the three commits that actually made these decisions (`01d43df`, `84062e6`, `4a38512`, all dated 2026-07-17 earlier the same day) never logged them here despite their code comments explicitly claiming "flagged in DECISIONS.md" / "logged in DECISIONS.md" / "See DECISIONS.md". That claim was false at the time those commits were made. Recording that gap honestly rather than presenting these as if they'd been logged when the decision was actually made — anyone reading this log later reconstructing project history should know these were reasoned about at commit time but only written down now.

**CME speed-error placeholder (`space-weather-card.ts`):** DONKI does not publish a measured speed uncertainty per CME analysis, and `FORMULAS.md` §6 says only "propagate ±error in v0" without pinning a value. `CME_SPEED_ERROR_FRACTION = 0.1` (10% of `v0`) is used as `predictCmeArrival`'s `v0ErrorKmS` input — an invented placeholder, not a formula substitution, since no frozen constant covers it. Needs a better source (e.g. DONKI's own analysis confidence fields, if any exist) or an explicit ratification into `FORMULAS.md` §6.

**Active-CME selection policy (`space-weather-card.ts`'s `selectActiveCme`):** `FORMULAS.md` §8 is inherently single-event (one `v0`, one arrival time) with no rule for picking among multiple concurrent DONKI CMEs. Policy chosen: among CMEs with a usable analysis speed, take the most recent by `startTime` whose DBM-solved arrival (§6) is still in the future — an event whose predicted arrival has already passed is treated as stale, not "active," and skipped. This is the same class of gap as the 2026-07-15 entry above (`observerLonDeg`/single-`CmeEvent` in `predictAuroraForObserver`'s design), applied at the card-composition layer this time rather than inside the engine itself.

**Sky Anchor's server-side scope (`sky-anchor-card.ts`):** Deliberately scoped to the Sun-position engine only (twilight phase, sun altitude), not the bright-star catalog binary (`apps/web/public/data/stars.bin`). That file is a frontend-only asset shipped via jsDelivr per `ARCHITECTURE.md` §9 — loading it server-side to enrich the Brief's Sky Anchor card would be a new backend data dependency not named in `ARCHITECTURE.md`, and Sky Anchor's whole value in the degradation contract (§5, "always works") comes from being pure math with zero I/O. Not revisited without an explicit architecture change.

## 2026-07-17 — Phase 5: `jose` over `jsonwebtoken`

**Why:** promise-native, strong TS types, fits the codebase's strict-ESM style; `jsonwebtoken`'s callback-oriented API doesn't.

## 2026-07-17 — Phase 5: refresh token is an opaque random value hashed with SHA-256, not a JWT hashed with Argon2

**Why:** two related but separate calls, made building `refresh-token.ts`.

**Not a JWT:** `ARCHITECTURE.md` §3 G's "custom JWT auth" names the _access_ token; the refresh token's actual trust boundary is a `Session` row lookup (its stored hash must match, and the row must be unexpired/unrevoked), not a cryptographic signature — that DB hit happens regardless of the token's format, since revocation is the entire reason `SCHEMA.md`'s Session table exists over a stateless-JWT-only refresh design. A signed/parseable JWT structure (algorithm negotiation, duplicated expiry — once in the token's `exp` claim, once in the row's `expiresAt`) would add real complexity for zero additional security. Implemented instead as 32 bytes (256 bits) of `node:crypto` CSPRNG output, base64url-encoded — no new dependency, since `node:crypto` is a Node built-in.

**SHA-256, not Argon2, for the hash stored in `Session.hashedRefreshToken`:** Argon2 (`password.ts`) is a deliberately slow KDF whose entire purpose is resisting brute-force against a _low-entropy, human-guessable_ secret (a password). A refresh token is already 256 bits of CSPRNG output — there is nothing to brute-force — so a slow KDF on every refresh would only add latency with no corresponding security gain. A fast cryptographic hash (SHA-256) is the correct tool for hashing an already-high-entropy value for equality comparison. Comparison itself (`refreshTokenMatches`) uses `crypto.timingSafeEqual`, not a variable-time string compare, so byte-by-byte early-exit timing can't leak partial-match information.

## 2026-07-22 — Phase 5: Prisma Client is a factory with an injected `DATABASE_URL`, connected fail-fast at boot

**Why:** three small calls made building `apps/api/src/db/client.ts`, the project's first real DB connection.

**Factory, not module-level singleton:** `poller/store.ts` is a module-level singleton, but a Prisma Client owns a connection pool with a real lifecycle (`$connect`/`$disconnect`) — integration tests need to create and tear down their own instance, and routes receive theirs via dependency injection (the `BriefRouteDeps` shape) rather than importing shared mutable state.

**`DATABASE_URL` injected as a parameter, not read inside the module:** same "no hidden globals" discipline as the engines' injected `now` (WORKPLAN.md rule #4). Only the composition root (`index.ts`) reads the environment, via the same `requireEnv` used for API keys — one consistent failure message for any missing env var.

**Fail-fast `$connect()` at boot, before pollers/listener:** Prisma connects lazily on first query by default; with Postgres down that boots an app whose every DB-backed route 500s later instead of failing visibly now. Chosen behavior (verified live against a dead port): log a short error naming host/port only — never the connection string, which contains credentials — and exit 1 before any poller or the HTTP listener starts.

## 2026-07-22 — Session continuity gap: login/logout/refresh were never actually built, despite being reported as working

**Why logged:** a human message opened this session describing "signup and login confirmed working, 198/198 tests passing" and asked to continue with logout/refresh/guard. Before trusting that, checked `routes/auth.ts` directly (only `POST /api/auth/signup` existed) and grepped the repo for any `prisma.session.create` (none — the only `prisma.session` reference anywhere was a row-count check in `db/client.test.ts`). The 198-test figure exactly matched `PROGRESS.md`'s own prior entry for the signup-route commit alone (`27 files/198 tests`), with no login entry logged since. Flagged to the human rather than silently building logout/refresh against a login that didn't exist (they'd have had no Session row to ever operate on); human chose "build login first." Root cause of the discrepancy wasn't determined (likely a prior session's context not carrying forward) and wasn't investigated further since the fix — build the missing piece — was the same regardless of cause.

## 2026-07-22 — Phase 5: `cookie` package added as a direct dependency

**Why:** `login`/`logout`/`refresh` all need to read the incoming refresh-token cookie, and Express 5 (like Express 4) does not parse the `Cookie` request header on its own — that's what `cookie-parser` middleware conventionally exists for. Rather than add the full `cookie-parser` middleware (a global app-wide dependency for a need scoped to three routes) or hand-roll header parsing (reinventing quoting/encoding edge cases `cookie` already handles correctly), added the `cookie` package directly — it was already resolved in `node_modules` as an `express` transitive dependency (used internally by `res.cookie`/`res.clearCookie` for serialization), so this adds no new supply-chain surface, only a direct `import { parse } from 'cookie'` for the read side. `@types/cookie` added as a devDependency since the package ships no bundled types.

## 2026-07-22 — Phase 5: login's generic-401 covers "no such user" and "wrong password" identically; logout is cookie-driven, not access-token-gated

**Why:** two related design calls made building `routes/auth.ts`'s login/logout.

**Login's single 401 message:** returning a different status/message for "no account with this email" vs. "wrong password for a real account" would let an attacker enumerate registered emails one guess at a time. Both cases — including an OAuth-only account with a null `passwordHash` — return the identical `{ error: 'invalid email or password' }`, and `verifyPassword` is never even called when there's no hash to check against (short-circuited, not a wasted/faked call).

**Logout keyed on the refresh cookie, not `verifyAccessToken`:** the access token is deliberately short-lived (15 min, `ARCHITECTURE.md` §3 G) specifically so the refresh token is the thing that matters for session state. Gating logout behind a valid access token would mean a client whose access token already expired (a very normal case — they left the tab open past 15 minutes) couldn't log out without first refreshing, which is backwards. Logout's authority is possession of the httpOnly refresh cookie itself — revoking the session that cookie names — not proof of current identity via the access token.

## 2026-07-22 — Phase 5: Google OAuth callback design (fragment handoff, email-based account linking, additive config)

**Why:** three related calls made building `GET /api/auth/google` and its callback — no doc specifies any of these at the implementation level.

**Access token travels in the redirect's URL fragment, not a query string or JSON body:** Google's redirect lands the browser on our callback via a real GET navigation with no way to read a JSON response body — the callback's own response must itself be another redirect (or a rendered page, which doesn't exist yet — no frontend). A query-string token would be logged in server access logs and browser history; a fragment (`#accessToken=...`) is never transmitted to any server by the browser, only readable by client-side JS — the standard low-infrastructure pattern for handing a token to an SPA with no established session-storage mechanism yet. The refresh token still goes through the same httpOnly cookie every other route uses, unaffected by this choice.

**`findOrCreateGoogleUser` links by email, not just by `googleId`:** `SCHEMA.md`'s User model already anticipates "a Google login links to the same User rather than creating a duplicate," but doesn't say how to find that User on first Google login. Chosen: search by `googleId` OR `email`; if found via email only (an existing password-based account, or in principle a previously-differently-linked one), update that row's `googleId` rather than creating a second account for the same person. Safe specifically because `verifyGoogleIdToken` only ever returns an `email_verified: true` address (see the client's own header comment) — trusting an unverified email for account linking would let one person claim another's password-based account by registering a matching-but-unowned address with Google.

**Google OAuth env vars read optionally, not via `requireEnv`:** `ARCHITECTURE.md` §3 G is explicit that OAuth is additive, "never a prerequisite." Making `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` (plus `WEB_ORIGIN`, needed for the post-flow redirect) required at boot would mean the entire API — including every non-OAuth auth route — fails to start until a human registers a Google Cloud OAuth app. Instead: read optionally, log one warning if any are missing, and the two Google routes 404 with a clear message rather than existing in a half-configured state. Verified live: the built app boots normally with none of the four set.

**Known limitation, not a decision:** unlike every other Phase 5 piece, this one has not been verified end-to-end against Google's real servers — that requires an actual registered OAuth app (Client ID/Secret) and a human clicking through Google's real consent screen, neither available in this environment. The code-exchange and ID-token-verification logic are tested against mocked network calls / a locally-generated key pair (`google-oauth.client.test.ts`), and the route/DB/user-linking logic is tested with those two calls injected as fakes (`auth.test.ts`) — but nothing here has touched Google's actual OAuth service. Flagged in `PROGRESS.md` as an open item, not rounded up to "done."

## 2026-07-22 — Phase 6: Cache periodic-sweep interval set to 10 minutes

**Why:** `SCHEMA.md`/`ARCHITECTURE.md` §3.B require a periodic sweep alongside cleanup-on-read, but neither pins a cadence. Chose `CACHE_SWEEP_INTERVAL_MS = 10 * 60 * 1000` (`apps/api/src/cache/store.ts`) — matches the slow-tier poller's own interval, since the cache's primary documented use is slow-tier upstream payloads (SCHEMA.md's own example: "Open-Meteo per-cell results"), so rows that outlive their read window become sweepable roughly as often as new slow-tier data would replace them anyway. Not a `FORMULAS.md` constant (no formula governs it), so treated as an implementation default rather than something requiring ratification — revisit if a future cache consumer needs a materially different TTL/sweep relationship.

## 2026-07-22 — Phase 6 Task 4: f_hist history is GLOBAL, not per-user

**Why:** Initially built per-user (each user's own hits/trials feeding their own Brief's confidence), reasoning from `Prediction.userId` being a required FK. Human corrected this: `ARCHITECTURE.md` §8's page table lists `/accuracy` as **public**, showing one system-wide track record. Per-user scoping would mean a user's Brief confidence and the public `/accuracy` page were computed from different populations — breaking the premise that confidence is grounded in the app's actual track record (`ARCHITECTURE.md` §5's honesty principle). Prediction accuracy is a property of the CME-arrival/Kp-forecast methodology itself, not of who happened to be logged in when a given Brief was generated.

`Prediction.userId` stays required regardless — it still answers "whose Brief triggered this" (needed for the later delete-my-data task) and scopes the one-time persistence decision (does _this_ request get to write a row at all), just not the aggregate read. `apps/api/src/predictions/history.ts`'s `getGlobalPredictionHistory` aggregates `scored`/`hit` counts with no `userId` filter at all. `packages/shared`'s `historyFactor`/`predictAuroraConfidence` were already scope-agnostic (`FORMULAS.md` §8/§9 never specified scope either way, per the 2026-07-15 `predictAuroraForObserver` entry's same class of gap) — no engine change needed, only the caller's aggregation query.

## 2026-07-22 — Phase 6 Task 4: prediction persistence lives in `routes/brief.ts`, gated by optional (not required) auth

**Why:** `build-brief.ts`/`space-weather-card.ts` are deliberately pure (no I/O) — same discipline as the ISS next-pass fetch, which already lives at the HTTP layer for the identical reason. `/api/brief` itself is genuinely public (`require-auth.ts`'s own header comment, and no doc anywhere makes it auth-required), so making a `Prediction` write mandatory would have meant either breaking anonymous Brief access or leaving `Prediction.userId` nullable against `SCHEMA.md`'s explicit "belongs to a User" framing. Chose: a new `tryAuthenticate` (`apps/api/src/auth/require-auth.ts`), sibling to `requireAuth`, that treats a missing header, a malformed header, _and_ an invalid/expired token identically as anonymous (`null`) — never a 401 — reusing the same `verifyAccessToken`. Only a token that actually verifies unlocks persistence; the Brief response itself is byte-identical either way. Persistence only fires when there's both a real `userId` and an active CME (`aurora.hasActiveCme`), and is wrapped in try/catch so a DB failure degrades silently (logged, never blanks the Brief) — same resilience contract as every other card's failure path.

Global `f_hist` (previous entry) still needs a DB read on _every_ request with any CME data at all, authenticated or not — guarded by a cheap fast path (`pollerState.donki.data?.cmes?.length > 0`) so the pre-existing DB-free brief tests (no CME in their fixtures) still never touch Postgres, and a failed history lookup falls back to the neutral prior rather than failing the request.

## 2026-07-22 — Phase 6 Task 4: `confidenceBand`/CME identity/lead-hours live in `Prediction.context` JSONB, not new columns

**Why:** `prisma/schema.prisma`'s `Prediction` model (already applied in the `init` migration, predating this task) has no dedicated `confidenceBand` column — `SCHEMA.md`'s own prose bundles it as "confidence (the C value + band)," and separately calls out "which CME, user's geomagnetic latitude, lead time, the factor breakdown" as belonging in the JSONB `context` blob. Added `cmeActivityId`/`leadHours` fields to `space-weather-card.ts`'s `AuroraCardData` (DONKI's `activityId` and the Causal Engine's already-computed but previously-unsurfaced `leadHours`) purely to get that data to the HTTP layer — no schema migration needed, matching Task 3's "no new migration needed" precedent for `Cache`.

## 2026-07-22 — Phase 6 Task 4: daily accuracy job cadence (24h) and observed-Kp match tolerance (1.5h)

**Why:** Two implementation defaults, neither pinned by any doc. `ACCURACY_JOB_INTERVAL_MS = 24h` — WORKPLAN.md's own task name ("daily accuracy job") is the only guidance; matches `startCacheSweepLoop`'s "no doc pins a cadence, treat as an implementation default" precedent. `MAX_OBSERVED_MATCH_AGE_MS = 1.5h` (`apps/api/src/predictions/accuracy.ts`) — SWPC's observed-Kp product is a 3-hour-cadence series, so a genuine reading is never more than half that cadence from any instant it actually covers; a `Prediction.targetTime` whose nearest observed entry is farther than that is left `scored: false` rather than scored against a fabricated "nearest" match (same "never fabricate" discipline as the CME-speed-error placeholder). A prediction that ages out of SWPC's ~7-day observed window entirely (e.g. the job didn't run for over a week) stays permanently unscored — accepted as a pathological-downtime edge case, not designed around, since the job runs daily with an immediate first tick on boot.

## 2026-07-23 — Phase 6 Task 4 (retro note): transient full-suite flake under parallel DB load — known characteristic, not chased

**Why logged:** Flagged during Task 4's review as something to track rather than let go unlogged, even though it didn't reproduce on retry and wasn't fixed. Every DB-backed test file opens its own `PrismaClient` (its own connection pool) against the same local docker-compose Postgres instance; under Vitest's default parallel-file execution, a large enough number of these pools contending at once can occasionally starve or time out a single query. Accepted as a known characteristic of the current test architecture, not a logic defect — revisit (e.g. a shared test `PrismaClient`, or capping parallelism) only if it starts happening more frequently as the suite keeps growing.

## 2026-07-23 — Phase 6 Task 5: delete-my-data implemented as real User deletion (cascade), per SCHEMA.md — not explicit per-table deletes

**Why:** Before building, found a direct conflict between locked docs on the exact mechanism question. `WORKPLAN.md`'s task line and `ARCHITECTURE.md` §7 both describe delete-my-data only as removal of "a user's locations, sky log, and predictions" — silent on the account/Session. `SCHEMA.md`'s `User` model section is explicit and unambiguous: _"Delete-my-data: deleting a User cascades to their Sessions, Locations, SkyLogEntries, and Predictions. Deletion means real removal (ARCHITECTURE.md §7), so cascade is the intended behavior, not soft-delete flags."_ That's SCHEMA.md directly naming the mechanism — precisely the design question at hand — rather than being silent on it like the other two docs.

Flagged to the human rather than silently picking a side (per `CLAUDE.md`'s "don't silently override a locked doc" rule); they chose to follow SCHEMA.md. Implemented as `DELETE /api/auth/account` (`apps/api/src/routes/auth.ts`), `requireAuth`-gated (real auth required, unlike `/api/brief`'s optional auth), doing `prisma.user.deleteMany({ where: { id: userId } })` — `deleteMany` rather than `delete`, matching `logout`'s own established idiom, so a second call after the row is already gone is a clean no-op rather than a thrown P2025. The already-defined `onDelete: Cascade` FKs on `Session`/`Location`/`SkyLogEntry`/`Prediction` (all already applied in the `init` migration, no new migration needed) do the actual per-table removal — this is the one place in the codebase that relies on DB-level cascade rather than an explicit application-level delete, and it's deliberate here since SCHEMA.md itself calls that out as "the intended behavior, not soft-delete flags." Also clears the refresh-token cookie in the response, same as logout, since the Session it named no longer exists.

**Residual doc inconsistency, not resolved by this decision:** `WORKPLAN.md`/`ARCHITECTURE.md` §7 still literally describe only three resource types, not the account itself — this decision follows SCHEMA.md as the more specific, mechanism-level source, but the wording gap between the docs remains unreconciled. Flagging for whoever next edits these three docs to tighten the language so a future reader doesn't hit the same ambiguity.

## 2026-07-23 — Frontend design system: free-font substitution (Archivo, Martian Mono, Newsreader)

**Why:** `DESIGN_SPEC.md` Part II names a licensed premium pairing (Atlas Grotesk/Atlas Typewriter, Lyon Text) alongside free equivalents for each of the three type roles. Per this project's standing "free/open-source unless no viable alternative exists" rule, chosen the free set: **Archivo** (display/interface), **Martian Mono** (measurements), **Newsreader** (explanatory prose). `ARCHITECTURE.md` §2 updated to name these as the actual chosen stack, so it stays the single source of truth for "what's actually used" rather than `DESIGN_SPEC.md`'s aspirational premium/free pairing.

## 2026-07-23 — Twilight-interpolation function belongs in `packages/shared`, not `apps/web` (addendum to closed Phase 2) (RESOLVED — see 2026-07-23 "Twilight-interpolation function implemented" below)

**Why:** `DESIGN_SPEC.md` §2's central mechanic — the entire UI palette interpolating from real computed solar altitude — is math, not styling: it's a pure function of an already-computed engine output (`sunAltitudeDeg`, from `packages/shared/src/engines/sun-position.ts`). Building it as a frontend-only utility would let `apps/web` reimplement/interpret solar-altitude logic independently of the backend engine, risking exactly the drift `ARCHITECTURE.md` §2's "engines living here means frontend and backend can never disagree" principle exists to prevent.

This is a small addendum to Phase 2 (already closed), not new Phase 7/8 scope — flagged explicitly per `CLAUDE.md`'s "don't silently deviate from a locked doc" rule rather than letting it be added ad hoc inside `apps/web` during Phase 7. Claude Code owns adding this one function (twilight phase + palette-interpolation input, per `DESIGN_SPEC.md` §2's table of solar-altitude thresholds) to `packages/shared` before Phase 7's design-system-foundation task needs it. `apps/web` consumes the function's output; it does not reimplement the altitude→phase mapping itself.

## 2026-07-23 — Twilight-interpolation function implemented: continuous `[0,3]` scale, day/night as flat plateaus

**Why:** Implementing the addendum above, `packages/shared/src/engines/twilight.ts`'s `twilightStateForSunAltitude()` needed a concrete interpolation-value design that `DESIGN_SPEC.md` §2 doesn't spell out numerically (it states the continuity _requirement_, not a formula). Chosen: a single monotonic `value` in `[0, 3]`, hitting the exact integers 0/1/2/3 at the four named boundaries (0°/-6°/-12°/-18°) — day and night are modeled as flat plateaus at the two ends (`value` pinned to 0 and 3 respectively) since `DESIGN_SPEC.md`'s table gives each a single fixed description ("Pale, cool, high-key" / "Full dark, minimum luminance"), not a range to gradient across; only civil/nautical/astronomical, which each have two named boundaries, get a real linear segment. A rendering layer interpolates between the color stops at `floor(value)`/`ceil(value)` using the fractional part — this function's contract stops at that number, never a color, matching the same boundary `DECISIONS.md` already drew for `FORMULAS.md` §2's `T_kelvin`→RGB step.

Reused `FORMULAS.md` §0's already-frozen `TWILIGHT_ISS_AURORA_DEG` (-6°) and `TWILIGHT_STARS_DEG` (-18°) rather than re-declaring them — confirms `DESIGN_SPEC.md` §2 and `FORMULAS.md` §0 agree on those two thresholds, not a coincidence worth re-deriving. Added one new constant, `TWILIGHT_NAUTICAL_ASTRONOMICAL_DEG = -12` (nautical/astronomical boundary), sourced from `DESIGN_SPEC.md` §2 since `FORMULAS.md` doesn't name it — kept local to `twilight.ts` rather than added to `constants.ts`, since it isn't a `FORMULAS.md §0` frozen constant.

Boundary ownership: each exact threshold value belongs to the darker/next phase (e.g. exactly -6° is `'nautical'`, not `'civil'`) — matches the real-world convention that civil twilight _ends_ the instant the Sun reaches -6° below the horizon (US Naval Observatory definition), used as the hand-verified anchor in `twilight.test.ts`.

## 2026-07-23 — Phase 7 design-system-foundation: type scale as CSS custom properties; Tailwind v4 CSS-first config

**Why:** Two related decisions, both confirmed by the human before building.

**Type scale encoding — CSS custom properties, not Tailwind `fontSize`:** The spec defines each type step as a size + line-height + tracking _triple_. Tailwind's `fontSize` can hold triples but doesn't keep them coupled — three separate utility classes are still required. A CSS custom property + a `.type-*` semantic class keeps the triple atomic and enforces the spec's "set like a printed masthead" intent in a single declaration. Colors/spacing/radius/motion continue to use Tailwind utility classes where they benefit from composability.

**Tailwind v4 CSS-first — no `tailwind.config.ts`:** Tailwind CSS v4 replaced the JS config file with CSS-first `@theme` blocks in the stylesheet. All design tokens (color, spacing, radius, motion duration/easing, font families) live in `apps/web/src/index.css`'s `@theme` block. `tailwind.config.ts` exists as a no-op comment so agents don't recreate a v3-style config.

## 2026-07-23 — Phase 7 design-system-foundation: motion token consumer split (CSS vs GSAP)

**Why:** DESIGN_SPEC.md §7.1 names GSAP ease functions deliberately — GSAP is the locked animation library (ARCHITECTURE.md §2) and these are real, distinct curve shapes. Tokens split by consumer:

- **Micro** (`ease-out`): CSS only — spec says "ease-out" verbatim, a plain CSS keyword, no GSAP needed for hover/focus states.
- **Transition** (`expo.out`): GSAP string `EASE_TRANSITION = "expo.out"` in `src/lib/motion.ts`. CSS fallback `cubic-bezier(0.16, 1, 0.3, 1)` also defined (user-confirmed correct curve).
- **Cinematic** (`expo.inOut`): GSAP string `EASE_CINEMATIC = "expo.inOut"` in `src/lib/motion.ts`. No CSS bezier approximation defined — no non-GSAP consumer exists, and the expo.inOut approximation must be verified against easings.net before committing to CSS. If ever needed: verify, then add. See user message 2026-07-23 for the correction context.
- **Ambient** (`sine.inOut`): OPEN for Phase 8. Both `EASE_AMBIENT = "sine.inOut"` (GSAP string) and `cubic-bezier(0.37, 0, 0.63, 1)` (CSS, from easings.net sineInOut reference) are defined. Phase 8 decides GSAP vs CSS and updates this entry.

## 2026-07-23 — Phase 7 design-system-foundation: Sky ramp runtime wiring explicitly deferred

**Why:** Sky-100 through sky-950 hex values are static and live in `@theme` and `:root` immediately. The runtime logic that reads the twilight interpolation value from `packages/shared`'s `twilightStateForSunAltitude()` and maps it to semantic surface slots (`--surface`, `--surface-secondary`, etc.) at runtime is deferred until that function's shape is confirmed stable and any consuming API decisions (polling interval, SSE delivery vs on-mount fetch) are made. A placeholder solar-altitude computation in `apps/web` would risk diverging from the shared engine. Semantic slots are statically wired to `sky-900` (night) as a safe default — users always get a readable interface regardless of actual twilight state, just without the live lighting effect.

## 2026-07-23 — Phase 7 gap: `apps/web` typecheck never verified in Antigravity's sandbox, 18 real `tsc --build` errors found and closed

## 2026-07-23 — Phase 7: Daily Brief Location Fallback & Horizon Band Scrubber Seeding

**Why:** Two design & implementation decisions confirmed before building:

1. **Default Location Fallback Chain**: `/api/brief` requires `lat` and `lon` query parameters. `getEffectiveLocation()` in `apps/web/src/lib/api.ts` checks: `useAppStore.getState().location` -> `useAppStore.getState().user.location` -> Srinagar (`34.08`°N, `74.80`°E, name: `"SRINAGAR"`), matching `DESIGN_SPEC.md` §10's spec anchor and backend test suite defaults.
2. **Horizon Band Position Seeding vs Scrubbing**: At `t = now`, the Horizon Band anchors Sun altitude from `brief.skyAnchor.data.sunAltitudeDeg`, ISS position from `brief.iss.data`, and observer coordinates directly from the `/api/brief` payload to guarantee 100% agreement with card text. For fluid 60fps time-scrubbing (-6h to +6h across the night), `@astranet/shared` pure math engines (`sunAltitudeDeg`, `equatorialToHorizontal`) run client-side seeded by the payload's observer coordinates and `generatedAt` timestamp.

**Why logged:** same class of issue as the Phase 1 static-dataset/fixture gaps above — Antigravity's sandbox cannot run typecheck commands, so Phase 7's `apps/web` output had never actually been run through `npx tsc --build`. Confirmed the 18 errors were real by reproducing them independently (see repro method below) before touching anything, per `CLAUDE.md`'s "verify yourself" rule.

**Root cause, one root cause not three:** `apps/web/tsconfig.json` had no `compilerOptions.paths` entry for the `@/*` alias that `vite.config.ts`'s `resolve.alias` already defines, so Vite resolves `@/store`, `@/pages/*`, etc. at runtime but `tsc` couldn't. That single gap cascaded into all three reported symptoms: direct `TS2307` "Cannot find module '@/...'" errors, then every downstream Zustand selector on an unresolved `@/store` import losing its type and reporting `TS7006` implicit-`any` (e.g. `(s) => s.setUser`, `(s) => s.navVisible`), plus a wave of `TS17004` "Cannot use JSX unless the '--jsx' flag is provided" noise once the module graph broke. Fixed by adding `"paths": { "@/*": ["./src/*"], "@astranet/shared": ["../../packages/shared/src/index.ts"] }` to `apps/web/tsconfig.json`, matching `vite.config.ts`'s actual alias targets (checked directly, not assumed).

**Repro/verify method:** stashed just `apps/web/tsconfig.json` + `apps/web/src/index.ts`, reran `tsc --build --force` — got the module-not-found/implicit-any cascade back exactly as described (e.g. `App.tsx(32,29): TS7006`, `PersistentNav.tsx(22,35)/(23,38): TS7006`), confirming the paths fix is the real root cause and not coincidental. Restored, then confirmed `npx tsc --build --force` (whole repo) and `npx tsc --noEmit -p apps/web/tsconfig.json` (standalone) both report zero errors.

**Items 2 and 3 needed no separate fix once item 1 was corrected:** `apps/web/src/store/index.ts` already types `useAppStore` via `create<AppState>()` with `AppState` fully exported — once `@/store` resolves, every selector infers correctly with no per-callsite annotation needed. `apps/web/src/pages/LoginPage.tsx`'s `res.status` comes from the Fetch API's `Response.status` (plain `number`), so its `409`/`400`/`401` comparisons never actually narrow to a literal union in the current file — no widening was needed there either. Both were downstream symptoms of item 1's module-resolution failure, not independent bugs.

**Scope discipline:** did not touch `apps/web/src/lib/motion.ts` (3 pre-existing `@typescript-eslint/no-unnecessary-type-assertion` lint errors) or the pre-existing Prettier formatting gaps in `App.tsx`, `PersistentNav.tsx`, `index.css`, `motion.ts`, `vite.config.ts`, and `LoginPage.tsx` (all line-width/formatting only, unrelated to the type-narrowing bug) — none of these are TypeScript errors, none regressed from this fix, and per the explicit scope of this takeover they remain Antigravity's Phase 7 work to close. One-time typecheck takeover only; Phase 7 ownership is unchanged.

## 2026-07-23 — Autofill CSS fix landed; `index.css`/`motion.ts` lint+format gaps closed; repo-wide pre-existing lint/format gaps found, not fixed

**Why logged:** Asked to confirm the autofill CSS fix (`apps/web/src/index.css`) was committed cleanly against `npx tsc --build` and the repo's lint/format gates. It wasn't committed at all — `index.css` was still untracked, alongside the rest of Antigravity's in-progress Phase 7 files. Running the real gates (`npm run lint`, `npm run format:check`) surfaced 11 ESLint errors and 22 files failing Prettier, none of which had been checked before. Human directed a three-way split rather than a blanket fix, superseding the prior entry's "motion.ts stays Antigravity's to close" note for these specific 3 errors:

1. **Committed alone:** `index.css`, reformatted with `prettier --write` to match project style (single quotes, lowercase hex, no manual column alignment) and verified clean against `format:check`. Not linted by ESLint at all — CSS isn't in `eslint .`'s targeted extensions, confirmed by comparing a direct `eslint index.css` invocation (which errors, irrelevantly, on being handed a non-JS file) against the real `npm run lint` file set, which never flagged it. Commit `95b3099`.

2. **Committed alone:** the 3 real `@typescript-eslint/no-unnecessary-type-assertion` errors in `apps/web/src/lib/motion.ts` (lines 34/35/41) — the `as const` on each exported string-literal `const` was redundant since TS already infers the literal type for a `const` primitive binding with no type annotation; `as const` only matters for object/array literals, which widen by default. Fixed via `eslint --fix`, then also ran `prettier --write` since the file failed `format:check` too and the goal was landing this file clean, not partially. Commit `b5c3a95`.

3. **Not fixed, logged only — genuinely pre-existing and repo-wide, not Phase 7 CSS/motion scope:**
   - **8 ESLint parsing errors** on generated/non-source files: `apps/api/coverage/lcov-report/{block-navigation,prettify,sorter}.js`, `packages/shared/coverage/lcov-report/{block-navigation,prettify,sorter}.js` (6 total — coverage output, never meant to be linted; `.eslintrc.json`'s `ignorePatterns` lacks a `coverage` entry), plus `apps/api/scripts/{ingest-light-pollution,ingest-stars}.js` (2 — the same "`.js` scripts not covered by any tsconfig `include`" gap already logged in the 2026-07-16 entry above, now also surfacing under `eslint .` and not just `tsc`).
   - **20 remaining files failing `format:check`** (of the original 22 — `index.css`/`motion.ts` now excluded): a mix of genuinely pre-existing root config/docs (`.claude/agents/formula-reviewer.md`, `.claude/commands/{formula-audit,phase-check}.md`, `.claude/settings.json`, `.eslintrc.json`, `.github/workflows/ci.yml`, `.lintstagedrc.json`, `.prettierrc`, `docker-compose.yml`, `NOTES.md`, `package.json`, `package-lock.json`, `README.md`, `SCHEMA.md`, `TESTING.md`), the same two `apps/api/scripts/*.js` files above, and Antigravity's other untracked Phase 7 files (`App.tsx`, `PersistentNav.tsx`, `LoginPage.tsx`, `vite.config.ts`) — explicitly not committed or touched here per the human's direction that those remain Antigravity's own work to land.

Flagging both as a dedicated cleanup task (fix `ignorePatterns`, decide whether the two ingest scripts get a tsconfig `include` or an ESLint override, run `prettier --write` repo-wide once each in-flight agent's own files have landed) rather than bundling into this fix.

## 2026-07-23 — Independent verification of Antigravity's Daily Brief work (`BriefPage.tsx`, `HorizonBand.tsx`, `api.ts`): two real findings beyond Antigravity's self-report, one documentation-vs-code mismatch

**Why logged:** Antigravity's own summary (this file's prior entry + `PROGRESS.md`) reported three fixes — twilight-phase mislabeling, a numbered-heading issue, location-switcher positioning — and claimed the location fallback and Horizon Band drift risk were handled per the pre-build decision above. Per `CLAUDE.md`'s "verify yourself" rule, re-checked all five items against real code and real command output rather than accepting the self-report.

1. **`npx tsc --build --force` (whole repo):** zero errors. Clean.

2. **Twilight fix — confirmed the correct, non-narrow fix:** `BriefPage.tsx` imports and calls `twilightStateForSunAltitude()` from `@astranet/shared` (line 3, 54) — this is the shared engine call, not a client-side reimplementation and not a display-only patch layered on top of one. Verified the boundaries in general, not just at the reported `-14.2°`: `twilight.ts` uses `TWILIGHT_ISS_AURORA_DEG` (-6°) and `TWILIGHT_STARS_DEG` (-18°) from `FORMULAS.md` §0 for the civil/nautical and astronomical/night edges, plus a local `TWILIGHT_NAUTICAL_ASTRONOMICAL_DEG = -12` (documented in-file as sourced from `DESIGN_SPEC.md` §2's table, not `FORMULAS.md`, since the frozen doc only names two thresholds). Hand-checked all four boundaries (0°, -6°, -12°, -18°): phase and the continuous `value` field both transition correctly and monotonically (0→1→2→3, no jump discontinuity) at every edge, matching `DESIGN_SPEC.md` §2's five-phase table exactly.

3. **`fetchBrief` default-location fallback — works, but the decision entry above misdescribes it:** `getEffectiveLocation()` (`apps/web/src/lib/api.ts`) always returns a valid `{lat, lon}` (store location or Srinagar default), so a logged-out/no-saved-location user's `fetchBrief` call never gets `undefined` coordinates and will not 400. However, the prior decision entry's claimed fallback chain — `store.location -> store.user.location -> Srinagar` — has a step that doesn't exist: `AppState.user` (`apps/web/src/store/index.ts`) has no `location` field, and `setLocation` is never called anywhere in the app yet (grepped, zero call sites outside the store definition). The real chain is two steps, not three. Functionally fine today (no logged-in-with-saved-location path exists to fall through), but the committed documentation describes code that isn't there.

4. **Horizon Band drift risk — NOT resolved, confirmed real, worse than the original concern:** `HorizonBand.tsx` computes Sun position via its own `sunEquatorialPosition()` + `equatorialToHorizontal()` + `julianDay()` calls (a separate import of `packages/shared`'s engines), not by reading `brief.skyAnchor.data.sunAltitudeDeg` from the API response. It does seed the Julian day from `brief.generatedAt` rather than an independently-obtained `now`, and since it composes the same underlying functions the backend's `sunAltitudeDeg()` (`apps/api/src/brief/sky-anchor-card.ts`) calls, the numbers agree today at `scrubHours = 0` — but this is still the exact "separate client-side recompute" pattern flagged as a drift risk before the build started, not a read of the payload's own data. Two worse instances of the same root problem found alongside it, both violating `DESIGN_SPEC.md` §9's explicit "every marker is at its real position... Jupiter sits where Jupiter actually is. Nothing is placed for composition": the Jupiter marker uses a hardcoded RA 45°/Dec 18° "approximate current position" that never tracks real Jupiter ephemeris (no Jupiter engine exists anywhere in the repo), and the NEO marker uses a hardcoded RA 120°/Dec 10° unrelated to the NEO's actual data (the API only provides miss-distance/diameter, no RA/Dec). The ISS marker's azimuth (`(pos.longitude + 180) % 360`) is also not a valid sub-satellite-longitude-to-observer-azimuth conversion — fabricated, not computed geometry.

5. **Design-token fidelity — not clean:** `HorizonBand.tsx`, `ConfidenceTicks.tsx`, `FreshnessIndicator.tsx`, and `LivePulse.tsx` all hardcode literal hex values in inline `style` props (e.g. `#C9B187`, `#C4362A`, `#3E4A4A`, `#D97706`, `#B08968`) instead of exclusively using the Tailwind token classes backed by `index.css`'s `--color-*` custom properties. Confirmed the hex values numerically match current tokens (`--color-brass-300: #c9b187`, `--color-ember-600: #c4362a`, etc.) so they render identically today, but they bypass the design system — a future palette retune in `index.css`/`DESIGN_SPEC.md` would silently not apply to these four components. No ad hoc `font-family` strings found; all type uses the `type-*` utility classes correctly.

6. **New lint/format regressions, not previously logged (distinct from the repo-wide pre-existing gaps logged above):** `npx eslint apps/web/src ... --max-warnings=0` now fails on `BriefPage.tsx:17` — `error` state is set on a failed fetch but never rendered anywhere, so there is no user-visible error state for a total `/api/brief` failure (silent fallback to hardcoded demo numbers instead). `prettier --check` also newly fails on six of this session's own new files — `HorizonBand.tsx`, `ConfidenceTicks.tsx`, `FreshnessIndicator.tsx`, `LivePulse.tsx`, `api.ts`, `BriefPage.tsx` — on top of the three already-logged pre-existing gaps (`App.tsx`, `PersistentNav.tsx`, `LoginPage.tsx`). These six are new-in-scope, not carried-over debt.

7. **Not fixed here (review only, per instruction):** items 3's documentation mismatch, item 4's drift risk + fake ephemeris positions, item 5's hardcoded hex, and item 6's lint/format regressions are logged but left for Antigravity (or a follow-up task) to close — this pass verified, it did not rewrite. Items 1 and 2 need no further action.

**Not a new gap, noted for the record only:** `DESIGN_SPEC.md` §10 item 1 requires Moon phase and rise/set in the Sky Anchor entry; neither `BriefPage.tsx` nor any backend card shows it, and no Moon-position engine exists anywhere in `packages/shared` or `apps/api` yet. This predates this session's work — not something to fix under this review.
