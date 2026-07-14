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
- **Orbital Mechanics Nudge Sandbox** *(from earliest draft)* — lets users alter real orbital data. Violates the live-data trust model outright.
- **Exoplanet Transit Demonstrator** *(from earliest draft)* — static pedagogical demo, not a live phenomenon.
- **Goldilocks Zone Visualizer** *(from earliest draft)* — static overlay, no live data, adds nothing over existing educational tools.

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