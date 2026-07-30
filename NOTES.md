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

### Explore scene — cardinal marks can overlap markers at grazing camera angles [RESOLVED - Phase 12]

`apps/web/src/components/explore/CardinalMarks.tsx` renders N/E/S/W as billboarded `DiegeticText` at a fixed 3D radius just above the horizon rule. Fixed in Phase 12 via `filterVisibleCardinalMarks` in `lib/explore-interaction.ts`: culls back-facing cardinal direction labels (`dot < 0.05`) and enforces minimum angular separation (`minAngularSeparationRad = 0.35` ~20°).

### Share card — deep below-horizon marker glyphs can touch a compass label (RESOLVED — see `DECISIONS.md`, 2026-07-30)

Fixed by re-composing the Horizon Band's vertical rhythm (`DESIGN_SPEC.md` §17): the compass-label offset, the below-horizon label row, and the fact plate (plus everything anchored to it) shift down by a fixed 14px, using real font metrics rather than the previous non-metric-backed estimate. Verified exhaustively (every 0.1° from 0 to -90°) in `og-svg.test.ts`. No longer a known limitation.

### `apps/api` test suite — `f_hist` assertion flaky under parallel runs (RESOLVED — see `DECISIONS.md`, 2026-07-30)

Fixed: the four Postgres-integration test files that write to the global `Prediction` table now run in a dedicated, serialized Vitest project (`apps/api/vitest.workspace.ts`), so they can no longer race each other. Verified with 6 consecutive clean full-suite runs. No longer a known limitation.
