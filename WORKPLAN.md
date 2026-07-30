# ASTRANET — Development Workplan

**This file is the single source of truth for the build.**
Humans and agents follow this order. Do not skip ahead. Do not start a phase until the previous phase's _Definition of Done_ is fully met.

> **Current Phase:** `Phase 10` — update this marker as you progress. Agents must read this line first and only work within the current phase unless explicitly told otherwise.
>
> **Phase 8 was closed by explicit human decision on 2026-07-27 with three items accepted as open, not completed** — real-browser verification of the real (non-simulated) satellite population, the §11 0:20 orbit-drop cinematic, and the diegetic-font/DevTools check. This is a deliberate, logged exception to Rule 1 ("Order is law") and the binary Definition-of-Done gate, not a precedent. See `DECISIONS.md` (2026-07-27, Phase 8 → 9 transition) for the full list and who owns each.
>
> **Phase 5's Authentication and the auth-gated pieces of Phase 6/10 were removed entirely by explicit human decision on 2026-07-30.** There is no account system: no login/signup, no per-user `Location`/`SkyLogEntry`/`Session`/`User` tables. Location, the Personal Sky Log, and Settings are now plain client-side state (browser `localStorage`). The task lists below for Phases 5, 6, and 10 describe what was originally built and are left as historical record, not a description of the current system — see `ARCHITECTURE.md` §3 G/§7/§8, `SCHEMA.md`, and `DECISIONS.md` (2026-07-30) for what actually exists now.

---

## Global Operating Rules (apply to every phase, every agent)

1. **Order is law.** Build in phase order. A later phase may not be started to "unblock" a stuck earlier task — fix the earlier task.
2. **Quality over quantity.** One correct, tested, reviewed component beats five half-built ones. Never batch-generate whole phases in one pass.
3. **Formulas are frozen.** All math comes from `FORMULAS.md` verbatim — never invent constants, thresholds, or alternative formulas. If a formula seems wrong, flag it; do not silently change it.
4. **Pure logic stays pure.** Math/engine code takes data in, returns results out — no network calls, no DB, no clock reads passed as hidden globals (inject `now` as a parameter). This is what makes it testable.
5. **Every non-trivial function ships with tests.** No unit tests → the task is not done.
6. **Validate all external data** with Zod at the boundary. Never trust an upstream API's shape.
7. **Fail gracefully.** A single failing data source degrades one card, never the whole response/page. Follow the degradation contract (Phase 5).
8. **Small commits, clear messages.** One logical change per commit.
9. **Update tracking.** When a task is done, update `PROGRESS.md`. When a real decision is made, log it in `DECISIONS.md`.
10. **Don't gold-plate.** Build exactly what the current phase specifies. Deferred/horizon features stay in `NOTES.md`, not in the code.

**Definition of Done (every task):** implemented → typed (no `any`) → validated → unit-tested → lint/format clean → committed → `PROGRESS.md` updated.

---

## Phase 0 — Foundation & Tooling

**Objective:** A running, empty skeleton that every later phase plugs into. No features yet.

**Atomic tasks:**

- Initialize repo, `package.json`, TypeScript config (strict mode on).
- Set up monorepo/workspace split: `apps/api`, `apps/web`, `packages/shared` (shared types + pure engines live here so both sides import them).
- `docker-compose.yml` with a Postgres 16 service.
- `prisma/schema.prisma` scaffold + `.env.example` (DB URL, API keys, JWT secret placeholders).
- ESLint + Prettier + shared tsconfig.
- Vitest configured and running one trivial passing test.
- Agent context files: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules` — all pointing to the reference docs.
- CI workflow: install → lint → typecheck → test on every push.

**Agent expectations:** Do not install anything not needed yet. No feature code. Confirm `docker compose up` starts Postgres and `npm test` passes before closing the phase.

**Definition of Done:** Repo clones, Postgres starts, migrations run against an empty schema, CI is green.

---

## Phase 1 — Data Source Clients

**Objective:** One isolated, validated client per external API. Each fetches, parses, and returns clean typed data — nothing else.

**Atomic tasks (one sub-task per source):**

- CelesTrak (satellite TLE/OMM) client.
- N2YO (ISS/visual passes) client.
- NOAA SWPC client (Kp-index, solar wind, X-ray flux, OVATION oval, 3-day forecast).
- NASA DONKI (CME/flare) client.
- NASA NeoWs (near-Earth objects) client.
- JPL Horizons (planetary/solar positions) client.
- Open-Meteo (cloud cover) client.
- Static datasets ingested once and self-hosted: light-pollution atlas, bright-star catalog.
- For **each** client: a Zod schema for the response, typed output, retry-with-timeout, and a documented fallback value when the source is unavailable.

**Agent expectations:** Build and test each client in complete isolation with a real sample response fixture. Record every source's rate limit and key requirement in `API_SOURCES.md`. No client may depend on another. No poller, no endpoints yet.

**Definition of Done:** Every client returns validated typed data from a fixture and handles a simulated failure without throwing.

---

## Phase 2 — Core Math Engines (pure, no I/O)

**Objective:** The scientific heart of ASTRANET as pure, unit-tested functions. This de-risks the hardest conceptual work before any wiring.

**Atomic tasks:**

- Coordinate + star-position transforms (catalog → 3D; RA/Dec → alt/az; LST; Sun position).
- Satellite visible-pass logic (elevation + observer-darkness + sunlit test).
- CME arrival — Drag-Based Model solver (`FORMULAS.md` §6).
- Aurora visibility — geomagnetic latitude + oval boundary vs. Kp (§7).
- **Causal Engine** — the three-factor confidence function (§8): lead × agreement × history. Pure `(events, forecast, userLat, now) → prediction`.
- Best-Spot score (§11): clarity × darkness × travel.
- NEO diameter + miss-distance helpers (§10).

**Agent expectations:** Zero network/DB/global-clock access — inject all inputs. Every function gets a thorough unit-test suite covering edge cases (negative parallax, Kp extremes, arrival before/after solar-wind speed, zero cloud, poles). Match `FORMULAS.md` exactly; cite the section in a comment.

**Definition of Done:** 100% of engines have passing tests including edge cases; a reviewer can trace every number back to `FORMULAS.md`.

---

## Phase 3 — The Poller

**Objective:** One always-on process that orchestrates Phase-1 clients on a two-tier schedule, holds latest state in memory, and exposes it.

**Atomic tasks:**

- Fast tier (30–60s): ISS position, SWPC solar wind/Kp → refresh in-memory store.
- Slow tier (5–15min): DONKI, NeoWs, imagery, forecasts.
- In-memory normalized state store (re-fetched on boot, not persisted).
- SSE `/stream` endpoint pushing fast-tier updates; each datum tagged with freshness/timestamp.
- Per-source health flags feeding the degradation contract.
- Central polling = constant upstream load regardless of user count; log any 429s.
- `/health` endpoint (also used for keep-warm).

**Agent expectations:** The poller only _collects and serves_ data — no prediction logic here (that's the engines). Respect each source's tier; never move a slow source to the fast tier. Verify one source failing doesn't stall the others.

**Definition of Done:** Poller runs continuously, `/stream` emits live fast-tier data with correct freshness tags, and killing one source leaves the rest healthy.

---

## Phase 4 — The `/brief` Endpoint & Degradation Contract

**Objective:** The product's spine. Compose poller data + engine outputs into the Daily Brief payload.

**Atomic tasks:**

- Define the degradation contract: Brief = independent cards (Sky Anchor > ISS > space weather > NEO/imagery); any source failure blanks only its card as "unavailable"; Brief renders if _any_ card resolves.
- `/api/brief?lat=&lon=` — assembles tonight's summary, aurora odds + confidence, next ISS pass, one solar line, learning moment.
- Wire the Causal Engine to live poller data for the aurora prediction.
- Confidence bands and honest freshness surfaced in the payload.
- Contract/integration tests for full-data, partial-outage, and total-outage cases.

**Agent expectations:** This is the milestone that proves the backend. Before touching the frontend, sanity-check `/api/brief` with a bare fetch. No styling, no React — JSON only.

**Definition of Done:** `/api/brief` returns a correct, confidence-rated payload for a real location, and degrades card-by-card under simulated outages.

---

## Phase 5 — Authentication

**Objective:** Secure accounts without a third-party auth provider.

**Atomic tasks:**

- Prisma `users` + `sessions` models.
- Argon2 password hashing.
- Custom JWT middleware: 15-min access token + rotated refresh token (httpOnly cookie, hashed + stored for revocation).
- `signup`, `login`, `logout`, `refresh` routes.
- `verifyAccessToken` guard for protected routes.
- Google OAuth 2.0 (authorization-code flow) as an additive login path issuing the same JWT pair.

**Agent expectations:** Email/password ships and is fully tested before OAuth is started. Never store plaintext or reversible secrets. Treat refresh-token rotation and revocation as required, not optional.

**Definition of Done:** A user can sign up, log in, refresh, log out, and access a protected route; tokens rotate and revoke correctly; OAuth path links/creates a user cleanly.

---

## Phase 6 — Persistence Features & Accuracy Loop

**Objective:** The data that makes ASTRANET personal and honest.

**Atomic tasks:**

- Saved locations (add/remove/default), scoped to the authed user.
- Personal Sky Log (auto-logged passes/aurora nights + manual entries) as JSONB history.
- Cache table with `expires_at` + cleanup on read + periodic sweep (no Redis).
- `predictions` table: every aurora prediction stored with target time, predicted Kp, confidence, context.
- Daily accuracy job: fetch observed Kp for elapsed targets, record actual vs. predicted, compute rolling hit-rate.
- Feed hit-rate back into the Causal Engine's history factor.
- Delete-my-data: real, complete removal of a user's locations + log + predictions.

**Agent expectations:** Enforce per-user access in the API layer (no cross-user reads). The accuracy loop is in-scope, not aspirational — build the table and the job together.

**Definition of Done:** Locations and log persist per user; predictions are recorded and scored daily; hit-rate visibly influences confidence; delete-my-data leaves nothing behind.

---

## Phase 7 — Frontend Foundation & Daily Brief

**Objective:** The first thing a user sees, consuming a real backend.

**Atomic tasks:**

- **Design system foundation** — build first, before any screen: color tokens (including the twilight solar-altitude interpolation ramp), type scale, spacing scale, and motion/timing tokens per `DESIGN_SPEC.md` Part II. This is the actual first atomic task of this phase, not the Daily Brief page itself.
- React + Vite app shell, routing, persistent nav (auto-hiding on `/explore`).
- Zustand store; Tailwind + shadcn/ui base.
- Auth UI (`/login`, `/signup`) wired to Phase-5 routes; token handling — visual spec: `DESIGN_SPEC.md` §16.
- `/` Daily Brief page rendering `/api/brief`, with per-card loading + "unavailable" states matching the degradation contract; includes the Horizon Band signature element — visual spec: `DESIGN_SPEC.md` §9–10.
- Freshness indicators (live pulse for fast tier, "updated Xm ago" for slow) — visual spec: `DESIGN_SPEC.md` §7.3 (the Freshness Rule).

**Agent expectations:** Build against the _real_ endpoint, not mock data. Respect the degradation contract in the UI exactly as the backend defines it. `DESIGN_SPEC.md` is a locked reference doc for this and every later frontend phase — same fidelity as `ARCHITECTURE.md`/`FORMULAS.md`; don't invent alternative colors, type, or layout.

**Definition of Done:** A logged-in user sees a real, personalized Daily Brief that degrades gracefully when a source is down, matching `DESIGN_SPEC.md`'s design system.

---

## Phase 8 — The Explorable Universe (3D)

**Objective:** The immersive core. Build the proving scene first, then layer objects.

**Atomic tasks:**

- **Ground Truth Sky Anchor first** — real GPS-anchored night sky from the bright-star catalog, correct alt/az, the single scene that proves camera + data + coordinate transforms end-to-end.
- Clickable ISS/satellites with contextual one-sentence overlays (hold for data).
- Sun + planets at true current positions (JPL/Horizons via engines).
- Auroral Ring driven by live OVATION/Kp.
- Heliosphere Pulse driven by live solar wind.
- Diegetic text (troika-three-text) with accessible DOM mirror.
- GSAP camera rig; semantic zooming; the "Rule of 7" clickable-object cap.

**Agent expectations:** Do not add a new 3D object until the previous one is stable at target framerate. Every object explains itself in one plain sentence first (Pillar 1 & 2). No fictional objects — everything traces to a real catalog. Visual spec: `DESIGN_SPEC.md` §11 — the opening sequence, cursor gravity, Rule of 7 enforcement, and tethered overlay-panel design are all specified there; follow it rather than improvising a visual language for this scene.

**Definition of Done:** A user drops from orbit into their real night sky, clicks the ISS and gets its story, and sees a live aurora ring — all at a stable framerate.

---

## Phase 9 — Best-Spot-Tonight Finder

**Objective:** The share-worthy discovery layer.

**Atomic tasks:**

- MapLibre GL map centered on the user.
- Candidate-site generation + scoring (clarity × darkness × travel, engine-driven).
- Ranked list + map markers; filter by tonight's event (aurora/meteor/ISS).
- Spot detail: why it ranked there + directions link.

**Agent expectations:** Reuse the Phase-2 best-spot engine — no re-implementing scoring in the UI. Keep the "why ranked" explanation honest and legible. Visual spec: `DESIGN_SPEC.md` §12 — the light-pollution-as-map-layer treatment and the three-bar score-breakdown display (same visual grammar as the Brief's Confidence Ticks).

**Definition of Done:** For a real location, the finder recommends the nearest genuinely good spot with a transparent score breakdown.

---

## Phase 10 — Log, Settings & Accuracy Pages

**Objective:** Retention, control, and visible honesty.

**Atomic tasks:**

- `/log` — timeline + simple stats (total sightings, streak, last aurora).
- `/settings` — saved locations, alert toggles, account, delete-my-data control.
- `/accuracy` — public Recharts view of predicted vs. actual Kp + rolling hit-rate.
- Personalized alerts wiring (ISS/aurora/meteor/NEO).

**Agent expectations:** `/accuracy` must reflect the _real_ recorded track record from Phase 6 — never fabricated numbers. Delete-my-data must call the real Phase-6 deletion. Visual spec: `DESIGN_SPEC.md` §13 (Log) and §14 (Accuracy) — note §14's explicit "no cherry-picking controls" constraint on the accuracy chart.

**Definition of Done:** Log and settings work per user; delete-my-data truly erases; accuracy page shows genuine historical performance.

---

## Phase 11 — Shareable Sky Card

**Objective:** The growth loop.

**Atomic tasks:**

- `/share/:id` public, no-login snapshot of a location's brief.
- OG/meta tags for rich link previews.
- One-tap generate/share from the Daily Brief.

**Agent expectations:** Fully public and login-free. The card must be self-contained and render correctly as a shared link preview. Visual spec: `DESIGN_SPEC.md` §17 — including the twilight-accurate server-rendered OG image (the card should look visibly different depending on the actual time/location it was shared for).

**Definition of Done:** A generated card opens for a logged-out visitor and previews correctly when the link is shared.

---

## Phase 12 — Resilience, Polish & Deploy

**Objective:** Production-grade finish.

**Atomic tasks:**

- Full outage/resilience pass across every card and scene.
- Rate-limit budget verification against real source limits under load.
- Accessibility pass (keyboard nav, screen readers, diegetic-text DOM mirror).
- Mobile pass for Companion + Discovery layers.
- Performance/framerate profiling of the 3D scene across hardware tiers.
- Deploy: backend + Postgres on the VPS (pm2/Docker restart policy), frontend on Cloudflare Pages, keep-warm via `/health`.
- README screenshots/GIF; final `PROGRESS.md`/`DECISIONS.md` sync.

**Agent expectations:** Nothing new is added here — only hardening, measuring, and shipping. Every earlier phase's Definition of Done must still hold.

**Definition of Done:** ASTRANET is deployed, resilient to source outages, accessible, performant, and demoable end-to-end.

---

## Horizon (explicitly NOT in this workplan)

Deep-sky and cosmological features — stellar neighborhood, Milky Way core, black holes, cosmic web, gravitational lensing, CMB, gravitational waves — are deferred by design. They are captured in `NOTES.md` and built only when there's a genuine reason a user would return to them, never because they'd look impressive in a demo. Do not pull these into any phase above.
