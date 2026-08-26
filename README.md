
# ASTRA-NET


ASTRA-NET tells you what's actually happening in space right now, above your exact location — the ISS passing overhead, an aurora that might reach your latitude tonight, an asteroid making its closest approach, the real planets and stars visible from where you're standing.

It isn't a satellite tracker, a space-news feed, or a scientific data portal for experts. It's a plain-language sky companion built on one rule that shapes every decision in the codebase: **if the data isn't real and verifiable, it doesn't appear.** No procedurally generated stars, no plausible-looking placeholder numbers when a source is down, no invented facts dressed up as insight. When something can't be fetched, the app says so, honestly, rather than quietly filling the gap.

<div align="center">

<img width="400" alt="ASTRA-NET" src="https://github.com/user-attachments/assets/5b1dd545-852b-43ea-8135-78a6bfa1c9f0" />

**A live, honest companion for the sky above you.**

</div>

---

<!-- Screenshot placeholder — Daily Brief -->
<!-- ![Daily Brief](./docs/assets/screenshot-brief.png) -->

## The problem this solves

Space information today is scattered and impersonal. A satellite tracker shows a dot moving with no story. An aurora forecast gives you a Kp-index number with no sense of what it means for _you_, standing where you actually are. A solar flare, the geomagnetic storm it triggers, and the aurora that might appear over your city that night are treated as three unrelated facts, sitting in three different tools, with nothing connecting them.

ASTRA-NET connects that chain and shows it, in real time, in one place — the reasoning that gets you from "the Sun did something" to "here's what it means for your sky tonight."

## The Causal Engine

This is the reasoning core of the product, and it's the part that separates ASTRA-NET from a page that just displays a fetched number. When the app tells you an aurora might be visible tonight, that prediction is the end of a real, traceable chain:

1. **Detection** — a coronal mass ejection (CME) erupts from the Sun, reported by NASA's DONKI system.
2. **Transit** — the CME's real launch velocity runs through a physics-based drag model (Vršnak 2013) to estimate when it reaches Earth.
3. **Geomagnetic response** — NOAA's live Kp-index is checked against how strong that CME is expected to be.
4. **Local outcome** — the predicted Kp is compared against your actual latitude to determine whether the aurora's visibility boundary reaches you.

You can see the whole chain, not just the final answer, along with how confident that answer genuinely is.

<!-- Screenshot placeholder — Causal Chain / Space Weather -->
<!-- ![Causal Chain](./docs/assets/screenshot-causal-chain.png) -->

## Confidence, honestly

Every prediction the app makes is quietly recorded and later scored against what actually happened. That track record feeds directly back into how confident the Causal Engine is willing to sound the next time — a rolling, unedited history, not a number chosen to look impressive.

## Who this is for

- **The curious beginner** — interested in space, no technical background, wants plain language and zero required prior knowledge.
- **The space enthusiast** — already follows launches and space news, but currently pieces information together across five different tools.
- **Anyone who just wants to know what's actually overhead tonight**, without decoding a raw Kp-index or a satellite tracker's dot.

It's explicitly **not** built for aerospace professionals or satellite operators — that audience already has real operational tools, and designing for them would compromise the plain-language identity this product is built around.

## The five ideas behind every decision

**Contextualization.** A fact is never left as an abstract number. "17,500 mph" means nothing on its own; "circles Earth every 90 minutes, so it laps your city every 90 minutes" means something.

**Visualization as interface.** In Explore, the 3D scene _is_ the navigation — there's no separate menu to learn, understanding comes from looking and clicking.

**Cross-domain synthesis.** Solar activity, geomagnetic conditions, and what's actually visible in the sky are shown as one connected story, not three separate silos.

**Human-scale framing.** Distances and sizes are tied back to something relatable wherever possible, not left as pure scientific notation.

**The default state is always _now_.** Live data is the foundation of trust — every screen makes clear what's genuinely live versus what's a few minutes stale, never blurring the two.

## What's actually in the app

**Daily Brief** — the entry point. One honest, composed sentence about the single most notable real thing happening in your sky right now, followed by a full breakdown: your local horizon rendered as a real dome-arc sky view, live solar/lunar/planetary positions, the current ISS pass window, the Space Weather causal chain, and today's near-Earth object flyby if one exists.

**Explore** — a full 3D, real-time sky dome. Real star positions from the HYG catalog, real planet positions from JPL Horizons rendered with real photographic textures (including Saturn's rings), the ISS and tracked satellites, and — when one is genuinely active — a real meteor shower radiant, sourced from the IMO's published shower calendar rather than invented.

**Settings** — your location, set either by typing real coordinates (with proper degree/direction controls) or by using your device's actual GPS location, plus display preferences (12-hour or 24-hour time, metric or imperial units) that apply everywhere instantly. An honest, expandable breakdown of every real data source the app uses and what it actually powers. A "clear local data" control that requires you to type a confirmation before it acts, because it's genuinely irreversible.

**Status** — a plain, public instrument reading of every live data source's real current health and freshness. Nothing is hidden here; if a source is stale or down, it says so.

**About** — the Causal Engine explained in plain language, and the product's honesty commitments spelled out directly.

<!-- Screenshot placeholder — Explore -->
<!-- ![Explore](./docs/assets/screenshot-explore.png) -->

<!-- Screenshot placeholder — Settings -->
<!-- ![Settings](./docs/assets/screenshot-settings.png) -->

## No accounts, nothing tracked

There is no sign-up, no login, and no account system anywhere in this product. Your location and display preferences live only in your own browser's local storage — the server never sees them, never stores them, and has nothing to leak. There is nothing here to delete on request, because nothing personal was ever collected in the first place.

## Tech stack

| Layer              | Technology                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework | [![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/) [![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) |
| 3D rendering       | [![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js&logoColor=white)](https://threejs.org/) [![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-black)](https://docs.pmnd.rs/react-three-fiber)                                                                                                       |
| Diegetic 3D text   | [![troika-three-text](https://img.shields.io/badge/troika--three--text-MSDF-informational)](https://github.com/protectwise/troika/tree/main/packages/troika-three-text)                                                                                                                                                                   |
| State management   | [![Zustand](https://img.shields.io/badge/state-Zustand-orange)](https://github.com/pmndrs/zustand)                                                                                                                                                                                                                                        |
| Styling            | [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)                                                                                                                                                                                                           |
| Animation          | [![GSAP](https://img.shields.io/badge/GSAP-88CE02?logo=greensock&logoColor=black)](https://gsap.com/)                                                                                                                                                                                                                                     |
| Backend runtime    | [![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![Express](https://img.shields.io/badge/Express-black?logo=express&logoColor=white)](https://expressjs.com/)                                                                                                           |
| Database           | [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)                                                                                                  |
| Realtime updates   | Server-Sent Events (SSE)                                                                                                                                                                                                                                                                                                                  |
| Validation         | [![Zod](https://img.shields.io/badge/validation-Zod-3E67B1)](https://zod.dev/)                                                                                                                                                                                                                                                            |
| Containerization   | [![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)                                                                                                                                                                                                                              |
| Testing            | [![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)                                                                                                                                                                                                                      |
| Code quality       | [![ESLint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/) [![Prettier](https://img.shields.io/badge/code_style-Prettier-F7B93E?logo=prettier&logoColor=black)](https://prettier.io/)                                                                                                  |

The whole system is TypeScript end to end, structured as a monorepo: a React frontend, an Express backend, and a shared package holding every real astronomy calculation — so the frontend and backend can never quietly disagree on a formula, because they're both importing the exact same one.

## Real data, real sources

Every one of these is free, and every one is called through the backend's own poller — the app fetches each source on its own schedule and fans the result out to every visitor from memory, rather than every browser tab hitting these APIs directly.

| Source                                                                                                                                                         | Powers                                               | Notes                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| [![N2YO](https://img.shields.io/badge/data-N2YO-lightgrey)](https://www.n2yo.com/)                                                                             | Live ISS position and visible pass predictions       | Keyed, free registration                                              |
| [![NOAA SWPC](https://img.shields.io/badge/data-NOAA_SWPC-lightgrey)](https://www.swpc.noaa.gov/)                                                              | Real-time and forecasted Kp-index, solar wind speed  | Keyless                                                               |
| [![NASA DONKI](https://img.shields.io/badge/data-NASA_DONKI-lightgrey)](https://ccmc.gsfc.nasa.gov/tools/DONKI/)                                               | Solar flares and coronal mass ejections              | Keyed, free from api.nasa.gov                                         |
| [![NASA NeoWs](https://img.shields.io/badge/data-NASA_NeoWs-lightgrey)](https://api.nasa.gov/)                                                                 | Near-Earth object close approaches                   | Same NASA key as DONKI                                                |
| [![NASA GIBS](https://img.shields.io/badge/data-NASA_GIBS-lightgrey)](https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | Live Earth imagery tiles                             | Keyless                                                               |
| [![JPL Horizons](https://img.shields.io/badge/data-JPL_Horizons-lightgrey)](https://ssd.jpl.nasa.gov/horizons/)                                                | Real current positions of the Sun and planets        | Keyless                                                               |
| [![CelesTrak](https://img.shields.io/badge/data-CelesTrak-lightgrey)](https://celestrak.org/)                                                                  | Satellite orbital elements, ISS fallback propagation | Keyless                                                               |
| HYG Database                                                                                                                                                   | The real star catalog rendered in Explore            | Static dataset, self-hosted                                           |
| International Meteor Organization                                                                                                                              | Meteor shower active windows and radiant coordinates | Static reference data, cross-checked against a published working list |

Everything else — Sun and Moon position, twilight phase, star coordinates, the aurora visibility math — is computed live on real astronomical formulas, not fetched from anywhere.

## Pages

| Route       | What's there                                                                       |
| ----------- | ---------------------------------------------------------------------------------- |
| `/`         | Daily Brief — tonight's sky, the causal chain, and every honest instrument reading |
| `/explore`  | The real-time 3D sky                                                               |
| `/settings` | Location, display preferences, and the full data-source breakdown                  |
| `/status`   | Live health of every data source, publicly visible                                 |
| `/about`    | The Causal Engine explained, and the honesty commitments behind it                 |

<!-- Screenshot placeholder — Status -->
<!-- ![Status](./docs/assets/screenshot-status.png) -->

<!-- Screenshot placeholder — About -->
<!-- ![About](./docs/assets/screenshot-about.png) -->

## Built by

**Nikhil Virdi** — [github.com/nikhilvirdi](https://github.com/nikhilvirdi)
