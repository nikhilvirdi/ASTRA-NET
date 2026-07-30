# ASTRANET — Architecture

Reference document for the locked technical architecture. This is the "what and why" behind the system. Formulas live in `FORMULAS.md`, external APIs in `API_SOURCES.md`, data model in `SCHEMA.md`, build order in `WORKPLAN.md`, frontend visual/interaction design in `DESIGN_SPEC.md`.

---

## 1. System Shape (high level)

```
┌──────────────────────────────────────────────────────────┐
│  BROWSER (Cloudflare Pages)                                │
│  React + Vite + Three.js/R3F + Zustand + Tailwind         │
│  - Daily Brief, Explore (3D), Best-Spot, Log, Settings    │
│  - Consumes REST /api/* and subscribes to SSE /stream     │
└───────────────┬───────────────────────┬──────────────────┘
                │ REST (JSON)            │ SSE (live fast-tier)
┌───────────────▼───────────────────────▼──────────────────┐
│  BACKEND (Node + Express + TS)  — always-on VPS           │
│                                                            │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  POLLER      │──▶│ IN-MEMORY    │──▶│  REST + SSE    │  │
│  │ two-tier     │   │ STATE STORE  │   │  endpoints     │  │
│  └─────┬───────┘   └──────────────┘   └───────┬────────┘  │
│        │ uses                                   │ uses     │
│  ┌─────▼───────┐   ┌──────────────┐   ┌────────▼───────┐  │
│  │ DATA CLIENTS │   │ PURE ENGINES │   │  DB (Prisma)   │  │
│  │ (Phase 1)    │   │ (Phase 2)    │   │  Predictions   │  │
│  └─────────────┘   └──────────────┘   └────────────────┘  │
│                            │                    │          │
│                            ▼                    ▼          │
│                    ┌───────────────────────────────────┐  │
│                    │  PostgreSQL 16 (Docker, self-host) │  │
│                    │  via Prisma — predictions,         │  │
│                    │  share cards, and cache —          │  │
│                    │  no accounts at all.               │  │
│                    └───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                │ polls (central, constant load)
                ▼
   External free APIs: CelesTrak · N2YO · NOAA SWPC ·
   NASA DONKI/NeoWs/GIBS · JPL Horizons · Open-Meteo
```

**Central-poller principle:** ASTRANET polls each external source _once_, centrally, and fans results out to all users via the in-memory store + SSE. Upstream API load is therefore constant regardless of how many users are online — the single most important scaling decision in the system, and what keeps every free-tier rate limit comfortably satisfied.

---

## 2. Locked Stack

### Language

- **TypeScript everywhere** (frontend, backend, shared package). Strict mode. No `any` in committed code.

### Monorepo layout

- `apps/api` — Express backend, poller, endpoints.
- `apps/web` — React frontend.
- `packages/shared` — shared TypeScript types **and the pure math engines**, imported by both sides. Engines living here means the frontend and backend can never disagree on a calculation.

### Frontend

| Concern                           | Choice                                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework                         | React + Vite                                                                                                                                                                                                                                           |
| 3D                                | Three.js + React Three Fiber (R3F) + drei                                                                                                                                                                                                              |
| State                             | Zustand                                                                                                                                                                                                                                                |
| Styling                           | Tailwind CSS + shadcn/ui                                                                                                                                                                                                                               |
| Typography                        | Archivo (display/interface), Martian Mono (measurements), Newsreader (explanatory prose) — free equivalents of `DESIGN_SPEC.md`'s licensed pairing (Atlas Grotesk/Typewriter, Lyon Text), per the project's free-tools-first rule (see `DECISIONS.md`) |
| Camera/UI animation               | GSAP                                                                                                                                                                                                                                                   |
| Diegetic 3D text                  | troika-three-text (MSDF)                                                                                                                                                                                                                               |
| Maps (Best-Spot)                  | MapLibre GL JS                                                                                                                                                                                                                                         |
| Charts (Accuracy)                 | Recharts                                                                                                                                                                                                                                               |
| Orbital propagation (client-side) | satellite.js                                                                                                                                                                                                                                           |

### Backend

| Concern            | Choice                                |
| ------------------ | ------------------------------------- |
| Runtime/framework  | Node.js + Express + TypeScript        |
| Database           | PostgreSQL 16, self-hosted via Docker |
| ORM                | Prisma                                |
| Realtime           | Server-Sent Events (fast tier only)   |
| Validation         | Zod (at every external-data boundary) |
| Process management | pm2 or Docker restart policy          |

### Tooling

- Vitest (unit) + Playwright (e2e), ESLint + Prettier, GitHub Actions CI.

---

## 3. Key Architecture Decisions (and why)

**A. Self-hosted Postgres over Supabase.** Removes the 7-day free-tier pause entirely and the need to babysit it. Auth was the other thing Supabase would have given us — moot now that there is no account system at all (see `DECISIONS.md`).

**B. Single Postgres, no MongoDB.** Fluid/semi-structured data (cached upstream payloads, a prediction's factor-breakdown context) uses JSONB columns; cache expiry uses an `expires_at` table cleaned on read plus a periodic sweep. One datastore, one thing to operate, cleaner to reason about. Mongo would only earn its place with a query pattern Postgres genuinely can't serve — none exists here.

**C. Prisma over Drizzle.** Chosen for familiarity and a readable schema/migration story. Schema in `schema.prisma` is the real source of truth; `SCHEMA.md` explains the "why."

**D. Always-on VPS over serverless polling.** Owning the box (Hetzner small instance, or Oracle Always-Free ARM) makes the poller a plain long-running process — no GitHub-Actions-cron workaround, no Render cold-start dance. The two-tier poller runs exactly as designed. Frontend still ships to Cloudflare Pages (free, unlimited bandwidth).

**E. Pure engines in a shared package.** All scientific math is pure `(inputs) → outputs` with no I/O and injected `now`. Makes it fully unit-testable and impossible for frontend/backend to diverge. This is also the strongest interview artifact.

**F. Central poller + SSE fan-out.** See §1. Constant upstream load, live client updates without WebSocket complexity (one-directional server→client is all we need).

**G. (retired) Custom JWT auth.** ASTRANET originally shipped custom JWT auth (access + rotated refresh, optional Google OAuth). Removed entirely by explicit human decision — no login, no accounts, no per-user data. Location, the Personal Sky Log, and Settings are now plain client-side state (browser `localStorage`), not server-persisted per-account rows. See `DECISIONS.md` for the removal and `SCHEMA.md` for the resulting data model. This letter stays retired rather than being reused, so old citations to "§3 G" elsewhere in this repo's history remain traceable to what they meant at the time.

---

## 4. Poller Design & Two-Tier Polling

The poller is one always-on process. It orchestrates the Phase-1 data clients on two schedules, writes normalized results to the in-memory store, and never contains prediction logic (that belongs to the engines).

### Fast tier — every 30–60s

Data that genuinely moves on that timescale:

- ISS position
- SWPC solar wind + Kp-index

Fast-tier updates are pushed to clients over **SSE `/stream`**, each datum tagged with a freshness timestamp. The UI shows a live pulse for these.

### Slow tier — every 5–15 min

Data that changes slowly:

- NASA DONKI (CME/flare events)
- NASA NeoWs (near-Earth objects)
- SWPC 3-day forecast / OVATION oval
- NASA GIBS imagery
- JPL Horizons planetary positions

Slow-tier data is surfaced with an "updated Xm ago" label. Never promote a slow source into the fast tier.

### State store

In-memory, normalized. Rebuilt by re-fetching on boot — **not** persisted, so a restart self-heals. Per-source health flags live here and feed the degradation contract.

### Honesty rule

The UI never claims more freshness than the tier delivers: fast-tier = live pulse, slow-tier = explicit relative timestamp. Chronological Synchronicity (Pillar 5) is a promise, so freshness is always visible.

### Keep-warm

A `/health` endpoint doubles as the keep-warm target and the poller/DB liveness check.

---

## 5. Degradation Contract

The Daily Brief and every composite response are built from **independent cards**. Rules:

- A single source failure blanks **only its own card** ("unavailable"), never the whole response or page.
- Priority order: **Sky Anchor (static star catalog, always works) > ISS > space weather > NEO/imagery.**
- The Brief renders if **any** card resolves.
- Per-source health flags from the poller drive which cards degrade.

This contract is enforced identically on backend (`/api/brief` composition) and frontend (card rendering).

---

## 6. Data Freshness & Trust

- Every datum carries a freshness signal end-to-end.
- Forecasts (aurora odds, event predictions) always show honest **confidence bands** (see `FORMULAS.md` §8), never false precision.
- Predictions are recorded and later scored against observed reality; the resulting track record is publicly visible on `/accuracy`. Honesty about uncertainty is a first-class product value, not a footnote.

---

## 7. Security & Privacy

There is no account system, so there is no personal data on the server to protect in the first place:

- Location, the Personal Sky Log, and alert preferences all live only in the visitor's own browser (`localStorage`) — never transmitted to or stored by the backend.
- The database holds nothing that identifies a visitor: `Prediction` rows are global forecast/outcome pairs (no owner field), `ShareCard` rows are anonymous public snapshots, `Cache` is upstream-payload TTL storage. See `SCHEMA.md`.
- **Clear local data** (in `/settings`) wipes that browser's own location, Sky Log, and alert preferences — a client-side operation, not a server request.

---

## 8. Pages

Single persistent app shell (logo + minimal top nav: Explore · Best Spot · Log · Settings) wrapping all routes **except** `/explore`, which is full-bleed and immersive with nav auto-hiding. Every route is public — there is no account system and therefore no auth-gated page.

| Route        | Contents                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | **Daily Brief** — tonight's sky, aurora odds + confidence, next ISS pass, one solar line, 60-sec learning moment. Location is a client-side setting (default: Delhi) applied site-wide. |
| `/explore`   | **Explorable Universe (3D)** — opens on Ground Truth Sky Anchor; click-driven contextual overlays; no menus, the scene is the navigation.                                               |
| `/best-spot` | **Best-Spot-Tonight Finder** — MapLibre map + ranked nearby viewing spots (clarity × darkness × travel), filterable by tonight's event.                                                 |
| `/log`       | **Personal Sky Log** — timeline of witnessed events + simple stats (total, streak, last aurora). Local to the browser (`localStorage`), not server-persisted.                           |
| `/settings`  | Current location, alert toggles, **clear local data** (wipes this browser's location/Sky Log/alerts).                                                                                   |
| `/share/:id` | **Shareable Sky Card** — anonymous snapshot of a day's brief, OG-tagged. The growth loop.                                                                                               |
| `/accuracy`  | **Track record** — predicted vs. actual Kp over time + rolling hit-rate (Recharts).                                                                                                     |

---

## 9. Deployment

- **Backend + Postgres:** always-on VPS (Hetzner small instance or Oracle Always-Free ARM), Docker Compose, pm2 or Docker restart policy for the poller/API.
- **Frontend:** Cloudflare Pages (free, unlimited bandwidth).
- **Static assets** (star catalog binary, planet textures): jsDelivr via a public GitHub repo.
- **Keep-warm / liveness:** scheduled ping to `/health`.

---

## 10. Non-Goals (architectural boundaries)

- No procedural/fictional objects — everything traces to a real catalog.
- No deep-sky/cosmological subsystem in scope (deferred to horizon, see `NOTES.md`).
- No professional satellite-ops tooling.
- No account system at all — no login, no signup, no per-user data, no third-party auth provider.
- No second datastore unless a real query pattern forces it.
