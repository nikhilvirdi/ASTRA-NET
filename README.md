# ASTRA-NET

<br>
<div align="center">

<img width="340" alt="ASTRA-NET" src="https://github.com/user-attachments/assets/5b1dd545-852b-43ea-8135-78a6bfa1c9f0" />

**a live, honest companion for the sky above you**

**Live:** **[astra-net-8mu.pages.dev](https://astra-net-8mu.pages.dev)**

</div>
<br>
ASTRA-NET tells you what's actually happening in space right now, above your exact location â€” the ISS passing overhead, an aurora that might reach your latitude tonight, an asteroid making its closest approach, the real planets and stars visible from where you're standing.

It isn't a satellite tracker, a space-news feed, or a scientific data portal for experts. It's a plain-language sky companion built on one rule that shapes every decision in the codebase: **if the data isn't real and verifiable, it doesn't appear.** No procedurally generated stars, no plausible-looking placeholder numbers when a source is down, no invented facts dressed up as insight. When something can't be fetched, the app says so, honestly, rather than quietly filling the gap.

## The problem this solves

Space information today is scattered and impersonal. A satellite tracker shows a dot moving with no story. An aurora forecast gives you a Kp-index number with no sense of what it means for _you_, standing where you actually are. A solar flare, the geomagnetic storm it triggers, and the aurora that might appear over your city that night are treated as three unrelated facts, sitting in three different tools, with nothing connecting them.

ASTRA-NET connects that chain and shows it, in real time, in one place â€” the reasoning that gets you from "the Sun did something" to "here's what it means for your sky tonight."

## The Causal Engine

This is the reasoning core of the product, and it's the part that separates ASTRA-NET from a page that just displays a fetched number. When the app tells you an aurora might be visible tonight, that prediction is the end of a real, traceable chain:

1. **Detection** â€” a coronal mass ejection (CME) erupts from the Sun, reported by NASA's DONKI system.
2. **Transit** â€” the CME's real launch velocity runs through a physics-based drag model (VrÅ¡nak 2013) to estimate when it reaches Earth.
3. **Geomagnetic response** â€” NOAA's live Kp-index is checked against how strong that CME is expected to be.
4. **Local outcome** â€” the predicted Kp is compared against your actual latitude to determine whether the aurora's visibility boundary reaches you.

You can see the whole chain, not just the final answer, along with how confident that answer genuinely is.

### Confidence, honestly

Every prediction the app makes is quietly recorded and later scored against what actually happened. That track record feeds directly back into how confident the Causal Engine is willing to sound the next time â€” a rolling, unedited history, not a number chosen to look impressive.

## Who this is for

- **The curious beginner** â€” interested in space, no technical background, wants plain language and zero required prior knowledge.
- **The space enthusiast** â€” already follows launches and space news, but currently pieces information together across five different tools.
- **Anyone who just wants to know what's actually overhead tonight**, without decoding a raw Kp-index or a satellite tracker's dot.

It's explicitly **not** built for aerospace professionals or satellite operators â€” that audience already has real operational tools, and designing for them would compromise the plain-language identity this product is built around.

## The five ideas behind every decision

**Contextualization.** A fact is never left as an abstract number. "17,500 mph" means nothing on its own; "circles Earth every 90 minutes, so it laps your city every 90 minutes" means something.

**Visualization as interface.** In Explore, the 3D scene _is_ the navigation â€” there's no separate menu to learn, understanding comes from looking and clicking.

**Cross-domain synthesis.** Solar activity, geomagnetic conditions, and what's actually visible in the sky are shown as one connected story, not three separate silos.

**Human-scale framing.** Distances and sizes are tied back to something relatable wherever possible, not left as pure scientific notation.

**The default state is always _now_.** Live data is the foundation of trust â€” every screen makes clear what's genuinely live versus what's a few minutes stale, never blurring the two.

## Tech stack

| Layer              | Technology                  |
| ------------------ | --------------------------- |
| Frontend framework | React, Vite, TypeScript     |
| 3D rendering       | Three.js, React Three Fiber |
| Diegetic 3D text   | troika-three-text           |
| State management   | Zustand                     |
| Styling            | Tailwind CSS                |
| Animation          | GSAP                        |
| Backend runtime    | Node.js, Express            |
| Database           | PostgreSQL, Prisma          |
| Realtime updates   | Server-Sent Events (SSE)    |
| Validation         | Zod                         |
| Containerization   | Docker                      |
| Testing            | Vitest                      |
| Code quality       | ESLint, Prettier            |
| Frontend hosting   | Cloudflare Pages            |
| Backend hosting    | Render                      |
| Database hosting   | Supabase                    |

The whole system is TypeScript end to end, structured as a monorepo: a React frontend, an Express backend, and a shared package holding every real astronomy calculation â€” so the frontend and backend can never quietly disagree on a formula, because they're both importing the exact same one.

## Real data, real sources

Every one of these is free, and every one is called through the backend's own poller â€” the app fetches each source on its own schedule and fans the result out to every visitor from memory, rather than every browser tab hitting these APIs directly.

| Source                                                                                               | Powers                                               | Notes                                                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| [N2YO](https://www.n2yo.com/)                                                                        | Live ISS position and visible pass predictions       | Keyed, free registration                                              |
| [NOAA SWPC](https://www.swpc.noaa.gov/)                                                              | Real-time and forecasted Kp-index, solar wind speed  | Keyless                                                               |
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/)                                                | Solar flares and coronal mass ejections              | Keyed, free from api.nasa.gov                                         |
| [NASA NeoWs](https://api.nasa.gov/)                                                                  | Near-Earth object close approaches                   | Same NASA key as DONKI                                                |
| [NASA GIBS](https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | Live Earth imagery tiles                             | Keyless                                                               |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)                                                   | Real current positions of the Sun and planets        | Keyless                                                               |
| [CelesTrak](https://celestrak.org/)                                                                  | Satellite orbital elements, ISS fallback propagation | Keyless                                                               |
| HYG Database                                                                                         | The real star catalog rendered in Explore            | Static dataset, self-hosted                                           |
| International Meteor Organization                                                                    | Meteor shower active windows and radiant coordinates | Static reference data, cross-checked against a published working list |

Everything else â€” Sun and Moon position, twilight phase, star coordinates, the aurora visibility math â€” is computed live on real astronomical formulas, not fetched from anywhere.

## Built by

**Nikhil Virdi** â€” [github.com/nikhilvirdi](https://github.com/nikhilvirdi)
