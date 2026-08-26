# ASTRA-NET
<br>
<div align="center">

<img width="340" alt="ASTRA-NET" src="https://github.com/user-attachments/assets/5b1dd545-852b-43ea-8135-78a6bfa1c9f0" />

**a live, honest companion for the sky above you**

</div>
<br>
ASTRA-NET tells you what's actually happening in space right now, above your exact location — the ISS passing overhead, an aurora that might reach your latitude tonight, an asteroid making its closest approach, the real planets and stars visible from where you're standing.

It isn't a satellite tracker, a space-news feed, or a scientific data portal for experts. It's a plain-language sky companion built on one rule that shapes every decision in the codebase: **if the data isn't real and verifiable, it doesn't appear.** No procedurally generated stars, no plausible-looking placeholder numbers when a source is down, no invented facts dressed up as insight. When something can't be fetched, the app says so, honestly, rather than quietly filling the gap.

## The problem this solves

Space information today is scattered and impersonal. A satellite tracker shows a dot moving with no story. An aurora forecast gives you a Kp-index number with no sense of what it means for *you*, standing where you actually are. A solar flare, the geomagnetic storm it triggers, and the aurora that might appear over your city that night are treated as three unrelated facts, sitting in three different tools, with nothing connecting them.

ASTRA-NET connects that chain and shows it, in real time, in one place — the reasoning that gets you from "the Sun did something" to "here's what it means for your sky tonight."

## The Causal Engine

This is the reasoning core of the product, and it's the part that separates ASTRA-NET from a page that just displays a fetched number. When the app tells you an aurora might be visible tonight, that prediction is the end of a real, traceable chain:

1. **Detection** — a coronal mass ejection (CME) erupts from the Sun, reported by NASA's DONKI system.
2. **Transit** — the CME's real launch velocity runs through a physics-based drag model (Vršnak 2013) to estimate when it reaches Earth.
3. **Geomagnetic response** — NOAA's live Kp-index is checked against how strong that CME is expected to be.
4. **Local outcome** — the predicted Kp is compared against your actual latitude to determine whether the aurora's visibility boundary reaches you.

You can see the whole chain, not just the final answer, along with how confident that answer genuinely is.

### Confidence, honestly

Every prediction the app makes is quietly recorded and later scored against what actually happened. That track record feeds directly back into how confident the Causal Engine is willing to sound the next time — a rolling, unedited history, not a number chosen to look impressive.

## Who this is for

- **The curious beginner** — interested in space, no technical background, wants plain language and zero required prior knowledge.
- **The space enthusiast** — already follows launches and space news, but currently pieces information together across five different tools.
- **Anyone who just wants to know what's actually overhead tonight**, without decoding a raw Kp-index or a satellite tracker's dot.

It's explicitly **not** built for aerospace professionals or satellite operators — that audience already has real operational tools, and designing for them would compromise the plain-language identity this product is built around.

## The five ideas behind every decision

**Contextualization.** A fact is never left as an abstract number. "17,500 mph" means nothing on its own; "circles Earth every 90 minutes, so it laps your city every 90 minutes" means something.

**Visualization as interface.** In Explore, the 3D scene *is* the navigation — there's no separate menu to learn, understanding comes from looking and clicking.

**Cross-domain synthesis.** Solar activity, geomagnetic conditions, and what's actually visible in the sky are shown as one connected story, not three separate silos.

**Human-scale framing.** Distances and sizes are tied back to something relatable wherever possible, not left as pure scientific notation.

**The default state is always *now*.** Live data is the foundation of trust — every screen makes clear what's genuinely live versus what's a few minutes stale, never blurring the two.

## Walking through the app

### Dashboard

<img width="1890" height="1021" alt="hero" src="https://github.com/user-attachments/assets/c3bc7467-9b82-45f8-aca4-a74e16e5ad23" />

This is the front door — the page you land on, and the one honest summary of tonight's sky. It opens with a single composed sentence about whatever the single most notable real thing happening in your sky is right now, then breaks that down into a series of independent, honestly-labeled sections underneath.

#### Headline

<img width="1502" height="277" alt="headline" src="https://github.com/user-attachments/assets/d3de6c7e-fd1c-4ebb-b75f-0926d06dcedd" />

The one sentence at the top of the page, composed fresh from whatever's genuinely most notable right now — an active space weather event, an upcoming ISS pass, a close asteroid approach, or a quiet night with nothing unusual happening. It's never the same fallback sentence regardless of context; if nothing is currently active, it says so honestly instead of defaulting to a generic line.

#### Horizon Band

<img width="1483" height="602" alt="horizon" src="https://github.com/user-attachments/assets/86391ec4-ced1-442a-9f6e-6a8256d25696" />

A curved, dome-shaped rendering of your actual local horizon, from north around to your zenith and back down — not a flat map, an honest projection of what the sky above you actually looks like right now. The Sun, Moon, and any visible planets appear at their real computed altitude and azimuth, moving as you scrub through the day using the built-in time slider.

#### Sky Anchor

<img width="1478" height="382" alt="sky anchor" src="https://github.com/user-attachments/assets/31e578c6-ad20-4873-953c-45206921c41d" />

The Sun's current altitude, the Moon's real phase and illumination percentage, and the exact times of the next moonrise and moonset — the baseline facts everything else on the page reasons from.

#### ISS Visible Pass

<img width="1530" height="228" alt="iss" src="https://github.com/user-attachments/assets/274f613a-f088-4302-9f42-d49c94127ae1" />

The next window (if one exists in the current observation period) during which the International Space Station will actually be visible from your location — not just overhead, but genuinely visible, meaning it's dark enough where you are and the station itself is still catching sunlight. If nothing qualifies right now, the section says so honestly rather than showing a stale or fabricated time.

#### Space Weather & Causal Chain

<img width="1493" height="565" alt="Space Weather" src="https://github.com/user-attachments/assets/5fc21cac-3ba8-4ea0-a613-e54c08670899" />

The live version of the Causal Engine described above, rendered as an actual timeline: a marker moves in real time along the Sun-to-Earth transit path as a coronal mass ejection travels, with the resulting Kp-index prediction and aurora outcome shown at the end of the chain — never as a static, disconnected number.

#### Near-Earth Object Flyby

<img width="1568" height="480" alt="near earth" src="https://github.com/user-attachments/assets/9324a52f-6acf-4630-8266-ef0b8371165e" />

Today's closest-approaching asteroid or comet, if one exists, with its real diameter (estimated from its known absolute magnitude), its real closest-approach distance plotted on an actual scale next to the Earth-Moon distance for context, and its relative velocity.

#### Learning Moment

A short, real astronomy fact that rotates on a schedule, weighted toward whatever's actually active in your sky right now — if there's a real aurora event in progress, you're more likely to see an aurora-related fact than a generic one.

### Explore

<!-- Screenshot placeholder — Explore -->
<!-- ![Explore](./docs/assets/screenshot-explore.png) -->

A full, real-time 3D rendering of the sky as seen from your exact location, right now. Every star is a real entry from the HYG catalog, correctly positioned and color-tinted based on its actual measured temperature. The Sun, Moon, and visible planets are rendered with real photographic surface textures — including Saturn's rings — at their true current positions from JPL's Horizons ephemeris service. The ISS and other tracked satellites move across the scene in real time.

Click on anything — a planet, the Moon, a satellite — and a small panel opens with a one-sentence description and its live altitude/azimuth reading. When a real meteor shower is genuinely active (checked against the International Meteor Organization's published calendar, not invented), its radiant point appears in the sky exactly where it would be if you looked up.

### Settings

<!-- Screenshot placeholder — Settings -->
<!-- ![Settings](./docs/assets/screenshot-settings.png) -->

Everything the app needs to know about you lives here, and nowhere else — there's no account, so this page *is* your whole profile.

#### Setting your location

Two ways to do it, both real:

- **Type it in directly** — enter your latitude and longitude as a degree value plus a direction (North/South, East/West), and the app converts it internally to the exact coordinate pair it needs.
- **Use your current location** — one click asks your browser for permission to use your device's real GPS location and fills in the exact coordinates for you. If permission is denied or your location can't be determined, the app tells you plainly rather than silently falling back to a default.

Your saved location applies everywhere in the app — the Dashboard, Explore, and every calculation on the page — instantly, with no page reload.

#### Preferences

Two real toggles: 12-hour or 24-hour time format, and metric or imperial units. Both apply immediately across every screen that shows a time or a measurement.

#### About the Data

An expandable list, one entry per real external source the app relies on, each one explaining in plain language exactly what it powers and how the underlying calculation actually works — sourced directly from the project's own technical documentation, not simplified into something that isn't quite true anymore.

#### Your Data

A single control to clear everything the app has saved about you from your browser. Because it's genuinely irreversible, it requires you to type a confirmation word before it acts — it never fires from a single accidental click.

### Status and About

Two smaller, quieter pages round things out. **Status** is a plain, public readout of every live data source's real current health — if something is down or stale, it says so, with nothing hidden. **About** is where the Causal Engine and the app's honesty commitments are explained directly, in the app's own words, for anyone who wants the full picture in one place.

## No accounts, nothing tracked

There is no sign-up, no login, and no account system anywhere in this product. Your location and display preferences live only in your own browser's local storage — the server never sees them, never stores them, and has nothing to leak. There is nothing here to delete on request, because nothing personal was ever collected in the first place.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React, Vite, TypeScript |
| 3D rendering | Three.js, React Three Fiber |
| Diegetic 3D text | troika-three-text |
| State management | Zustand |
| Styling | Tailwind CSS |
| Animation | GSAP |
| Backend runtime | Node.js, Express |
| Database | PostgreSQL, Prisma |
| Realtime updates | Server-Sent Events (SSE) |
| Validation | Zod |
| Containerization | Docker |
| Testing | Vitest |
| Code quality | ESLint, Prettier |

The whole system is TypeScript end to end, structured as a monorepo: a React frontend, an Express backend, and a shared package holding every real astronomy calculation — so the frontend and backend can never quietly disagree on a formula, because they're both importing the exact same one.

## Real data, real sources

Every one of these is free, and every one is called through the backend's own poller — the app fetches each source on its own schedule and fans the result out to every visitor from memory, rather than every browser tab hitting these APIs directly.

| Source | Powers | Notes |
|---|---|---|
| [N2YO](https://www.n2yo.com/) | Live ISS position and visible pass predictions | Keyed, free registration |
| [NOAA SWPC](https://www.swpc.noaa.gov/) | Real-time and forecasted Kp-index, solar wind speed | Keyless |
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Solar flares and coronal mass ejections | Keyed, free from api.nasa.gov |
| [NASA NeoWs](https://api.nasa.gov/) | Near-Earth object close approaches | Same NASA key as DONKI |
| [NASA GIBS](https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | Live Earth imagery tiles | Keyless |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Real current positions of the Sun and planets | Keyless |
| [CelesTrak](https://celestrak.org/) | Satellite orbital elements, ISS fallback propagation | Keyless |
| HYG Database | The real star catalog rendered in Explore | Static dataset, self-hosted |
| International Meteor Organization | Meteor shower active windows and radiant coordinates | Static reference data, cross-checked against a published working list |

Everything else — Sun and Moon position, twilight phase, star coordinates, the aurora visibility math — is computed live on real astronomical formulas, not fetched from anywhere.

## Built by

**Nikhil Virdi** — [github.com/nikhilvirdi](https://github.com/nikhilvirdi)
