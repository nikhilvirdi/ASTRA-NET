# NOTES.md

Parking lot for ideas explicitly **not** in current scope. Purpose: capture them so they stop pulling focus, without letting them into `WORKPLAN.md` uninvited. Nothing here gets built unless it's deliberately promoted into a phase by the human.

---

## Horizon: Deep-Sky & Cosmological Expansion

The original 34-feature vision's Zones 3–5 (Stellar Neighborhood, Milky Way, Large-Scale Universe). Deferred because none of it feeds the personalization/return loop that differentiates the core product — it's spectacle, not utility, until there's a genuine reason to return to it.

- **Zone 3 — Stellar Neighborhood:** confirmed exoplanet systems (e.g., stand on TRAPPIST-1e), spectroscopic "break the light into a barcode" feature, cosmic-time-machine light-delay callouts.
- **Zone 4 — Milky Way:** Sagittarius A* approach (EHT imagery), multi-wavelength spectrum toggle, volumetric nebula fly-throughs.
- **Zone 5 — Large-Scale Universe:** cosmic-web filament ride, gravitational lensing distortion engine, CMB "Echoes of Creation" sonification, redshift/dark-energy treadmill, the Pale Blue Dot return-to-Earth moment.
- **Fermi Paradox / Drake Equation filter** — interactive overlay on the Milky Way.
- **Gravitational Wave Ripple** — live LIGO/GWOSC event visualization.

**Promotion condition:** only once the core loop (Brief, Causal Engine, Explore, Best-Spot, Log, Accuracy) is fully live and there's a specific, considered reason to extend outward — not because it would look good in a demo.

---

## Cut Features (explicitly rejected, not just deferred)

These were removed for structural reasons, not just prioritization — don't reintroduce without a new argument:

- **Constellation Symphony** — isolating/illuminating satellite networks as geometric patterns. Spectacle, no personalization value.
- **Apollo Echoes** — historical Moon landing sites + archival audio. Interesting but disconnected from the "now" identity (Pillar 5).
- **Fluid Time Machine Scrubber** — dragging through past/future solar-system events. Conflicts with Chronological Synchronicity as a default state.
- **Magnetic Shield Stress Test** — magnetosphere deformation visual. Redundant with the Auroral Ring's live data story.
- **Orbital Mechanics Nudge Sandbox** _(from earliest draft)_ — lets users alter real orbital data. Violates the live-data trust model outright.
- **Exoplanet Transit Demonstrator** _(from earliest draft)_ — static pedagogical demo, not a live phenomenon.
- **Goldilocks Zone Visualizer** _(from earliest draft)_ — static overlay, no live data, adds nothing over existing educational tools.

---

## Open Ideas (unscored, unscoped — just captured)

- Debris Graveyard Reconstructor (time-reverse a collision/ASAT event) — could fit the causal-chain identity if ever revisited, currently out of scope.
- Threat Horizon scale-matched-to-your-city NEO visualization — currently folded into the plain NEO card (§ workplan Phase 6/10); the "hover a scale model over your city" cinematic version is deferred.
- Barycenter Tug-of-War (Sun wobble from Jupiter) — nice detail, no personalization value, low priority.
- Possible future: push notifications (native/PWA) for alerts, beyond in-app only — infra decision not yet made.

---

## Non-Ideas (considered and rejected outright, don't revisit)

- Second datastore (MongoDB/Redis) — see `DECISIONS.md`, only reconsider if a real query pattern demands it.
- Third-party auth provider — custom JWT is the committed path.
- Procedural/fictional object generation of any kind — violates the core "everything is real and verified" identity permanently, not just for now.

---

## Known Limitations & Deferred Fixes (real defects, deliberately not fixed yet)

Distinct from the sections above: these are not features anyone chose to defer, they are things currently wrong or fragile, recorded so they are not rediscovered from scratch. Nothing here should be built from without the human moving it into `WORKPLAN.md` first.

### Explore scene — cardinal marks can overlap markers at grazing camera angles

`apps/web/src/components/explore/CardinalMarks.tsx` renders N/E/S/W as billboarded `DiegeticText` at a fixed 3D radius just above the horizon rule. `CelestialMarkers.tsx` places bodies at their own 3D positions. At shallow camera elevations the two can collide in **screen space** even though they are well separated in world space.

Different bug class from the 2D share-card collision fixed in `og-svg.ts` (that one was a fixed layout with a deterministic overlap; this one is camera-dependent and transient), and lower priority — the user can orbit away from it, and no information is destroyed. A real fix means screen-space label deconfliction in the 3D layer, which nothing in the codebase does yet. Logged 2026-07-29.

### Share card — deep below-horizon marker glyphs can touch a compass label

`og-svg.ts`'s below-horizon **labels** were moved off the compass row and no longer collide at any altitude. The **glyphs** are a separate, unresolved case: the rule-to-plate budget is 50px and must hold three rows, so for the deepest marker's disc to clear the compass label band entirely `HORIZON_MAX_DROP` would have to be under 5.75px — too shallow for a marker to read as below the rule at all.

At the current 16px a Sun glyph clears down to **−32.3°**; past that, and only when its azimuth falls within ~5° of a tick, the disc can touch a compass label. That bites on mid-winter night cards at mid latitudes (London reaches about −61.9°). Resolving it properly means re-composing the Horizon Band's vertical rhythm, which is a `DESIGN_SPEC.md` §17 decision rather than a bug fix. Logged 2026-07-29.

### `apps/api` test suite — `f_hist` assertion is flaky under parallel runs

`src/routes/brief.test.ts > feeds real global accuracy-loop history into the returned confidence factors (f_hist)` fails intermittently on full-suite runs. Reproduced on `main` at **2 of 3** full runs, so it predates Phase 11 and is not caused by the share card work.

Cause: `getGlobalPredictionHistory` (`src/predictions/history.ts`) counts **every** scored `Prediction` row with no test scoping — global is the correct production behaviour (see `DECISIONS.md`), but six test files seed predictions and vitest runs files in parallel against one shared Postgres. The test expects exactly its own 3 hits / 4 trials; a failing run observed 0.5454 = 6/11 = (4+2)/(7+4), i.e. one extra hit and three extra trials leaked in from a concurrent file.

Note the whole `apps/api` suite additionally requires the docker-compose Postgres to be running (`docker compose up -d`), or the DB-backed files fail outright with `Can't reach database server at localhost:5433` — a separate, non-flaky prerequisite that is easy to mistake for this bug.

Three possible fixes, none chosen because all three affect every run and none is a Phase 11 concern: serialize the DB-touching test files (`fileParallelism: false` or a dedicated pool), give each test file its own schema/database, or loosen the assertion to "greater than the neutral prior" and lose its precision. Logged 2026-07-29.
