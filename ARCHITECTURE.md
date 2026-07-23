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
│  │ DATA CLIENTS │   │ PURE ENGINES │   │  AUTH (JWT)    │  │
│  │ (Phase 1)    │   │ (Phase 2)    │   │  + Argon2      │  │
│  └─────────────┘   └──────────────┘   └────────────────┘  │
│                            │                    │          │
│                            ▼                    ▼          │
│                    ┌───────────────────────────────────┐  │
│                    │  PostgreSQL 16 (Docker, self-host) │  │
│                    │  via Prisma — users, sessions,     │  │
│                    │  locations, sky_log, predictions,  │  │
│                    │  cache                             │  │
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

| Concern            | Choice                                                                           |
| ------------------ | -------------------------------------------------------------------------------- |
| Runtime/framework  | Node.js + Express + TypeScript                                                   |
| Database           | PostgreSQL 16, self-hosted via Docker                                            |
| ORM                | Prisma                                                                           |
| Auth               | Custom JWT (15-min access + rotated refresh) + Argon2; optional Google OAuth 2.0 |
| Realtime           | Server-Sent Events (fast tier only)                                              |
| Validation         | Zod (at every external-data boundary)                                            |
| Process management | pm2 or Docker restart policy                                                     |

### Tooling

- Vitest (unit) + Playwright (e2e), ESLint + Prettier, GitHub Actions CI.

---

## 3. Key Architecture Decisions (and why)

**A. Self-hosted Postgres over Supabase.** Removes the 7-day free-tier pause entirely and the need to babysit it. The only thing Supabase gave us that we now own is auth — handled by custom JWT. One system we fully control.

**B. Single Postgres, no MongoDB.** Fluid/semi-structured data (sky-log history, cached payloads) uses JSONB columns; cache expiry uses an `expires_at` table cleaned on read plus a periodic sweep. One datastore, one thing to operate, cleaner to reason about. Mongo would only earn its place with a query pattern Postgres genuinely can't serve — none exists here.

**C. Prisma over Drizzle.** Chosen for familiarity and a readable schema/migration story. Schema in `schema.prisma` is the real source of truth; `SCHEMA.md` explains the "why."

**D. Always-on VPS over serverless polling.** Owning the box (Hetzner small instance, or Oracle Always-Free ARM) makes the poller a plain long-running process — no GitHub-Actions-cron workaround, no Render cold-start dance. The two-tier poller runs exactly as designed. Frontend still ships to Cloudflare Pages (free, unlimited bandwidth).

**E. Pure engines in a shared package.** All scientific math is pure `(inputs) → outputs` with no I/O and injected `now`. Makes it fully unit-testable and impossible for frontend/backend to diverge. This is also the strongest interview artifact.

**F. Central poller + SSE fan-out.** See §1. Constant upstream load, live client updates without WebSocket complexity (one-directional server→client is all we need).

**G. Custom JWT auth.** Access token (15 min) + refresh token (30 days, httpOnly cookie, rotated on use, stored hashed in `sessions` for revocation). Google OAuth 2.0 is an additive authorization-code path issuing the same token pair — never a prerequisite.

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

- Passwords hashed with Argon2; never stored or logged in plaintext.
- Refresh tokens stored hashed, rotated on use, revocable via the `sessions` table.
- Per-user data access enforced in the API layer (no cross-user reads).
- Location data is used only to personalize; never sold or shared.
- **Delete-my-data** performs real, complete removal of a user's locations, sky log, and predictions — deletion means deletion, not deactivation.

---

## 8. Pages

Single persistent app shell (logo + minimal top nav: Explore · Best Spot · Log · Settings) wrapping all routes **except** `/explore`, which is full-bleed and immersive with nav auto-hiding.

| Route               | Auth     | Contents                                                                                                                                                                     |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                 | public   | **Daily Brief** — tonight's sky, aurora odds + confidence, next ISS pass, one solar line, 60-sec learning moment. Logged-out = generic location; logged-in = saved location. |
| `/explore`          | public   | **Explorable Universe (3D)** — opens on Ground Truth Sky Anchor; click-driven contextual overlays; no menus, the scene is the navigation.                                    |
| `/best-spot`        | public   | **Best-Spot-Tonight Finder** — MapLibre map + ranked nearby viewing spots (clarity × darkness × travel), filterable by tonight's event.                                      |
| `/log`              | required | **Personal Sky Log** — timeline of witnessed events + simple stats (total, streak, last aurora).                                                                             |
| `/settings`         | required | Saved locations, alert toggles, account, **delete-my-data**.                                                                                                                 |
| `/login`, `/signup` | public   | Single auth page, mode toggle, redirect back after auth.                                                                                                                     |
| `/share/:id`        | public   | **Shareable Sky Card** — no-login snapshot of a day's brief, OG-tagged. The growth loop.                                                                                     |
| `/accuracy`         | public   | **Track record** — predicted vs. actual Kp over time + rolling hit-rate (Recharts).                                                                                          |

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
- No third-party auth provider dependency.
- No second datastore unless a real query pattern forces it.
