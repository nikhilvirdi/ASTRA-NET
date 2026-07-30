# ASTRANET — Interface Design Specification

**Version 1.0 · Pre-engineering design document**
Prepared for the frontend build (Phases 7–11). No code, no implementation detail — this is the design intent that the build must satisfy.

---

## Part I — Creative Direction

### 1. The problem with how space software looks

Every space product converges on the same visual language: black voids, cyan and violet gradients, glowing hexagons, HUD chrome borrowed from film UI. It is science fiction cosplay. It signals _futuristic_ and communicates nothing about the actual sky.

ASTRANET is not science fiction. It is an **observational instrument**. Its subject is not "space" — an abstraction — but **the sky above one person, tonight**. That distinction drives every decision in this document.

The reference set is therefore not Blade Runner. It is:

- **Planispheres and star wheels** — circular, rotating, aligned to a real horizon
- **Observatory logbooks** — dated entries, measured values, honest annotations
- **Marine and astronomical instruments** — brass calibration marks, engraved scales, precision without ornament
- **Red-light dark adaptation** — the actual working condition of anyone using this outdoors at night
- **Nautical almanacs** — dense, typeset, trustworthy tables of when things happen

The product should feel _made and calibrated_, not _rendered_. Closer to a Leica or a barometer than to a dashboard.

### 2. The central design thesis

> **The interface is lit by the user's actual sky.**

ASTRANET already computes the Sun's altitude for the user's exact coordinates (`FORMULAS.md` §4). That number is not just data for a card — it is the **lighting condition of the entire application**.

The full UI palette is derived at runtime from real solar altitude at the user's location:

| Solar altitude | Twilight phase        | Interface state                                     |
| -------------- | --------------------- | --------------------------------------------------- |
| > 0°           | Day                   | Pale, cool, high-key. Reading light.                |
| 0° to −6°      | Civil twilight        | Warming. Contrast softens. Horizon glows.           |
| −6° to −12°    | Nautical twilight     | Deep slate. Brass marks emerge.                     |
| −12° to −18°   | Astronomical twilight | Near-ink. Airglow tint appears.                     |
| < −18°         | Night                 | Full dark. Minimum luminance. Red accents dominate. |

The transition between phases is continuous, not stepped — colors interpolate against the real, changing altitude. Someone who opens ASTRANET at 4pm and again at 10pm sees two visibly different applications, and the difference is _true_.

**Why this is the right signature:** it makes Pillar 5 (Chronological Synchronicity) structural rather than decorative. It is functionally correct — a screen used outdoors at astronomical night must not be a white rectangle destroying the user's dark adaptation. It cannot be templated, copied, or arrived at accidentally, because it requires the exact computation this product already performs. And it means the app is quietly _different every time you open it_, which is the whole promise.

### 3. Aesthetic risk, stated plainly

**The accent color is red, not blue.**

Every competitor in this space uses cool accents. ASTRANET uses **astronomer's red** — the deep, desaturated red of a dark-adaptation headlamp. It is authentic (this is literally the color astronomers work by), functional (it preserves night vision, and drives a real Red Light Mode), and it is the single most contrarian choice available in this category.

Against cool slate-teal sky tones, warm red reads as _signal_: something is happening, something is live, something needs you. Cool tones are the ambient state; red is only ever the exception. This restraint is what keeps it premium instead of alarming.

---

## Part II — Design System

### 4. Color

#### 4.1 Base ramp — "Sky"

The atmospheric base. Deliberately **desaturated blue-green**, not navy and never violet. Real dark sky carries a faint green airglow cast; that is what keeps this from reading as generic "dark mode."

| Token     | Hex       | Use                                                |
| --------- | --------- | -------------------------------------------------- |
| `sky-100` | `#EEF1F1` | Day surface. Cool paper, not cream.                |
| `sky-200` | `#D6DCDC` | Day secondary surface, dividers in day mode.       |
| `sky-400` | `#8B9898` | Mid-tone. Disabled states, tertiary text on light. |
| `sky-600` | `#3E4A4A` | Nautical twilight surface.                         |
| `sky-800` | `#1C2424` | Astronomical twilight surface.                     |
| `sky-900` | `#111818` | Night surface. The deepest base.                   |
| `sky-950` | `#0A0E0E` | Immersive/3D scene void. `/explore` only.          |

Note: `sky-950` is the only near-black in the system and it appears exclusively behind the 3D scene, where true darkness is required for star rendering. **The 2D interface never uses pure black.**

#### 4.2 Instrument — "Brass"

Calibration marks, tick rules, scale numerals, and secondary structure. Brass is the material of real astronomical instruments; here it is the color of _measurement itself_.

| Token       | Hex       | Use                                          |
| ----------- | --------- | -------------------------------------------- |
| `brass-300` | `#C9B187` | Tick marks and scale rules on dark surfaces. |
| `brass-500` | `#9A8258` | Secondary data labels, axis numerals.        |
| `brass-700` | `#6B5A3C` | Brass on light surfaces (day mode).          |

#### 4.3 Signal — "Ember"

The red. Used only for live state, alerts, and high-attention events. **Never for decoration, never for borders, never as a gradient.**

| Token       | Hex       | Use                                 |
| ----------- | --------- | ----------------------------------- |
| `ember-400` | `#E0614C` | Live-pulse indicator, active state. |
| `ember-600` | `#C4362A` | Primary action, alert emphasis.     |
| `ember-800` | `#7E241C` | Red Light Mode base.                |

#### 4.4 Phenomenon colors

Each real sky phenomenon gets one muted, specific color — never a rainbow, never a gradient set. These appear on the Horizon Band, in the 3D scene, and as small identifying marks.

| Token     | Hex       | Phenomenon                                                            |
| --------- | --------- | --------------------------------------------------------------------- |
| `aurora`  | `#7FA88A` | Aurora. Muted sage-green — the color of a real weak aurora, not neon. |
| `solar`   | `#D9A05B` | Solar activity, CME, flares.                                          |
| `orbital` | `#A8B4BC` | ISS and satellites. Cool metallic grey.                               |
| `neo`     | `#B08968` | Near-Earth objects. Dusty rock.                                       |

#### 4.5 Red Light Mode

A first-class mode, toggleable in `/settings` and auto-suggested when the computed solar altitude drops below −18° and the user has been idle-then-returned (indicating they may have stepped outside).

In this mode the entire interface renders in a **single-hue red ramp** on `sky-950`: no cool tones, no white text, no blue-emitting pixels. Maximum luminance is capped severely. Phenomenon colors collapse to red luminance steps, distinguished by shape and label rather than hue.

This is not a gimmick. It is the difference between an app you can use while actually standing outside looking at the sky and one you cannot.

---

### 5. Typography

#### 5.1 The typographic rule that defines the system

> **Words are proportional. Measurements are monospaced. Always, everywhere, without exception.**

Every number that represents a real measured quantity — a time, a coordinate, an altitude, a Kp index, a distance, a magnitude, a freshness stamp — is set in the mono face. Every word is set in the proportional face.

The result is a visible typographic seam running through every screen, separating _what we're telling you_ from _what we measured_. It makes the product's honesty legible at a glance, before you read a single word. This is the typographic identity — not a display face choice, but a rule about meaning.

#### 5.2 The three faces

| Role                    | Primary (licensed) | Open-source alternative             | Reasoning                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interface & display** | Atlas Grotesk      | Archivo (variable)                  | A cartographic grotesque — neutral enough for dense data, with enough width and weight range to carry very large headlines. Named for maps, which is the right lineage. Deliberately _not_ a high-contrast display serif, which is the current default gesture in premium design and reads as templated.   |
| **Measurement**         | Atlas Typewriter   | Martian Mono                        | Companion mono to the above. Tabular figures are non-negotiable — columns of Kp values and pass times must align. Slightly technical character without novelty.                                                                                                                                            |
| **Explanation**         | Lyon Text          | Newsreader (variable, optical size) | Used **only** for plain-language explanations and the 60-second learning moment — the "story voice" of Pillar 1. A reading serif, not a display serif: low contrast, generous x-height, designed for continuous prose. Its appearance signals _this is written for you to understand_, not _this is data_. |

#### 5.3 Type scale

A restrained scale. Sizes in rem at a 16px root, with a modular ratio near 1.25 in the body range and larger jumps at display sizes where precision matters less than presence.

| Token        | Size     | Line height | Tracking | Use                                      |
| ------------ | -------- | ----------- | -------- | ---------------------------------------- |
| `display-xl` | 5.5rem   | 0.95        | −0.03em  | The Brief headline. Desktop only.        |
| `display-l`  | 3.75rem  | 1.0         | −0.025em | Section openers, `/share` card headline. |
| `display-m`  | 2.5rem   | 1.05        | −0.02em  | Card headlines, mobile Brief headline.   |
| `title`      | 1.5rem   | 1.2         | −0.01em  | Entry titles.                            |
| `body-l`     | 1.125rem | 1.6         | 0        | Explanation prose (serif).               |
| `body`       | 1rem     | 1.55        | 0        | Default interface text.                  |
| `caption`    | 0.875rem | 1.4         | 0.01em   | Secondary labels.                        |
| `micro`      | 0.75rem  | 1.3         | 0.08em   | Eyebrows and mono stamps. Uppercase.     |
| `data-l`     | 2rem     | 1.0         | −0.01em  | Featured measurement (mono, tabular).    |
| `data`       | 1rem     | 1.4         | 0        | Inline measurement (mono, tabular).      |

**Headline treatment:** `display-xl` is set tight — negative tracking, near-solid leading — and left-aligned with a hard measure cap of **16 words per line**. It should feel _set_, like a printed masthead, not auto-flowing web text.

#### 5.4 Numerals

Tabular lining figures throughout. Fractional values (Kp 5.3, magnitude −1.4) always show consistent decimal places within a given context so columns align optically. Negative signs use a true minus glyph (−), not a hyphen — a small thing that separates instruments from spreadsheets.

---

### 6. Spacing & Layout

#### 6.1 Spacing scale

Base unit 4px. `2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192 · 256`

Vertical rhythm on content pages is generous — the closest visual reference is a well-set almanac page, not a dashboard. Whitespace does the work that borders would otherwise do.

#### 6.2 The Observation Grid

The core desktop layout is an **asymmetric two-track grid**, not a symmetric 12-column:

```
┌────────────────────────────────────────────┬──────────────┐
│                                            │              │
│   READING TRACK                            │  MARGIN      │
│   max 68ch                                 │  TRACK       │
│                                            │  240px       │
│   Headline, entries, explanations,          │              │
│   the Horizon Band                          │  Freshness   │
│                                            │  Confidence  │
│                                            │  Coordinates │
│                                            │  Source      │
│                                            │              │
└────────────────────────────────────────────┴──────────────┘
        ← gutter 96px →
```

**Reading track** carries everything the user reads. Capped at 68 characters — beyond that, prose becomes tiring, and this product is prose-first.

**Margin track** carries all provenance: freshness stamps, confidence indicators, source attributions, exact coordinates. This is the scientific-paper marginalia pattern. It means honesty about data quality is _permanently visible without ever interrupting the reading_, which is exactly the balance `ARCHITECTURE.md` §6 asks for.

The margin track is right-aligned against its own inner edge and set entirely in mono at `micro`/`caption` size, in `brass-500`. It reads as an instrument's engraved scale running alongside the content.

#### 6.3 Corner radius

| Token         | Value  | Use                                                                                 |
| ------------- | ------ | ----------------------------------------------------------------------------------- |
| `radius-none` | 0      | Rules, dividers, the Horizon Band, data plots.                                      |
| `radius-sm`   | 2px    | Input fields, small controls.                                                       |
| `radius-md`   | 6px    | Buttons, toggles.                                                                   |
| `radius-full` | 9999px | Only for genuinely circular objects — dial controls, sky-position markers, avatars. |

Deliberately tight. Instruments have sharp edges; soft rounded cards are the SaaS tell. But **not zero everywhere** — a fully square-cornered interface is its own recognizable cliché. The mixed scale, where structural elements are sharp and interactive elements are slightly softened, encodes a real distinction: _sharp things are readouts, soft things are controls._

#### 6.4 Elevation

There are **no drop shadows** in the 2D interface. Depth is expressed through three other means:

1. **Luminance** — surfaces closer to the user are one step lighter on the sky ramp.
2. **Hairline rules** — 1px `sky-600` at 40% opacity, used to separate, never to enclose.
3. **Atmospheric blur** — a genuine backdrop blur used _once_, on the `/explore` overlay panels only, where it is justified diegetically as looking through atmosphere.

This single-exception rule is what prevents glassmorphism creep.

---

### 7. Motion

#### 7.1 Principles

**Celestial motion is slow, continuous, and inexorable.** Nothing in this product bounces, springs playfully, or overshoots. There is no elastic easing anywhere. The sky does not bounce.

| Class      | Duration   | Easing                | Use                                                |
| ---------- | ---------- | --------------------- | -------------------------------------------------- |
| Micro      | 120–180ms  | `ease-out`            | Hover, focus, toggle.                              |
| Transition | 320–480ms  | `expo.out`            | Panel entry, card reveal, route change.            |
| Cinematic  | 800–1600ms | `expo.inOut`          | 3D camera moves, page-load sequence.               |
| Ambient    | 4–20s      | `sine.inOut`, looping | Atmospheric gradients, star twinkle, aurora drift. |

#### 7.2 The Live Pulse

Fast-tier data (ISS position, solar wind, Kp) carries a **live pulse**: a single `ember-400` dot, 4px, that pulses once per actual poll cycle — synchronized to the real 30–60s cadence, not a decorative loop.

This matters enormously. A generic "live" animation that pulses every 2 seconds while data refreshes every 45 is a lie. Ours pulses when data actually arrives. The user learns the rhythm of the real system.

#### 7.3 The Freshness Rule — the honesty mechanic

Under every measurement sits a **1px depleting rule**, the width of the value above it.

- At the instant data arrives, the rule is full-width in `brass-300`.
- It depletes linearly across that source's expected refresh interval.
- Fast-tier: depletes over ~60s, refills on each poll. Constant gentle motion.
- Slow-tier: depletes over ~15min. Nearly imperceptible movement.
- When fully depleted and no refresh has arrived, it turns `ember-600` and the numeral drops to 60% opacity.

Data ages _visibly_. Staleness is never something a user has to check for — it is displayed continuously. Alongside the mono/proportional rule, this is the second half of the product's typographic honesty.

#### 7.4 Confidence Ticks

The Causal Engine's confidence is the product of three real factors (`FORMULAS.md` §8). It is displayed as **three short vertical bars**, each filled proportionally to its factor:

```
Lead      ▮▮▮▮▮▯▯▯
Agreement ▮▮▮▮▮▮▮▯
History   ▮▮▮▮▯▯▯▯
          ─────────
          MODERATE
```

Never a single percentage. Never a gauge. Showing the three factors separately makes the _reasoning_ visible, which is the entire differentiator of this product — it turns a black-box number into an argument the user can inspect. Hovering or tapping each bar names it in plain language ("How far ahead we're predicting," "How well the two forecasts agree," "How often we've been right before").

#### 7.5 Page-load sequence

A single orchestrated sequence, not scattered fades. On first load of `/`:

1. **0–400ms** — Surface resolves to the correct twilight color. Nothing else. The user's first impression is the light.
2. **300–900ms** — Horizon Band draws itself left to right: horizon rule first, then compass ticks, then event markers appearing at their true positions.
3. **600ms** — Headline sets in one motion: no per-character stagger, no typewriter effect. It arrives complete, like a printed page.
4. **800ms onward** — Entries reveal in a 60ms stagger, each one lifting 8px with opacity.
5. **1200ms** — Margin-track provenance fades in last, at 60% opacity.

Total: under 1.5 seconds. The ordering encodes priority: light, then sky, then answer, then detail, then provenance.

#### 7.6 Reduced motion

Under `prefers-reduced-motion`: ambient loops stop entirely, the live pulse becomes a static dot with a mono timestamp, freshness rules jump in steps rather than animating continuously, and the load sequence collapses to a single 200ms fade. The 3D scene remains navigable but auto-rotation and camera drift are disabled.

---

### 8. Iconography & Illustration

#### 8.1 Icons

**Engraved, not drawn.** 1.25px stroke, square terminals, no rounded joins, built on a 20px grid. The reference is instrument panel engraving and chart symbology, not Feather/Lucide's friendly rounded set.

Critically: **phenomena do not use icons — they use their real chart symbols.** Star magnitude is shown by dot size, as in a real star atlas. Satellite passes are shown as directional arcs. Cloud cover uses okta notation. This is the vernacular of the subject, and using it correctly is what separates this from an app that merely depicts astronomy.

#### 8.2 Illustration policy

**No stock illustration. No 3D-rendered planet marketing art. No abstract blob shapes.**

Every visual is one of exactly three categories:

1. **Real data, drawn** — plots, sky charts, orbital arcs, light-pollution gradients. Generated from actual values.
2. **Real imagery** — NASA GIBS Earth tiles, mission photography. Always attributed in the margin track.
3. **Instrument marks** — calibration ticks, scales, rules, compass roses. Structural, in brass.

If a visual element cannot be traced to one of those three, it does not ship. This mirrors the product's own "no procedurally generated objects" rule (`ARCHITECTURE.md` §10) and applied to the interface, it is what will make ASTRANET look unmistakably unlike an AI-assembled app.

---

## Part III — The Signature Element

### 9. The Horizon Band

This is the element ASTRANET is remembered by. It appears on `/`, `/best-spot`, and `/share/:id`.

**Form:** a full-width strip, 180px tall on desktop, spanning the reading track. Not a card — no border, no background fill. It sits directly on the page surface.

**Structure:**

```
        ZENITH ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                              ◦ ISS 21:42
                                        ~~~~~ aurora
   45° ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                 ●Jupiter
                                                    ◦ NEO
════════════════════════════════════════════════════════════════
   N        NE        E        SE        S        SW        W
```

- **Horizontal axis: true azimuth**, N through W, with compass ticks in brass.
- **Vertical axis: true altitude**, horizon (0°) at the bottom rule, zenith at the top.
- **The horizon rule** is the heaviest line in the entire product — 2px, solid. It is the ground the user is standing on.
- **Every marker is at its real position.** The ISS marker sits where the ISS will actually be. Jupiter sits where Jupiter actually is. Nothing is placed for composition.
- **A time scrubber** runs beneath. Dragging it moves every marker along its true path across the night. Releasing snaps back to now — because the default state is always _now_ (Pillar 5).

**Why this earns its place:** it is the only element in any product of this kind that answers _where do I look?_ — the actual question a person standing outside has. It makes Pillar 2 (Visualization as Interface) and Pillar 4 (Anthropocentric Scaling) literal: the layout maps to the user's own field of view. And it is derived entirely from computations already implemented in `packages/shared`.

**Interaction:** hovering a marker raises a thin tether line to a one-sentence label. Clicking navigates to that object in `/explore`, with the camera already oriented to match the band's viewpoint — so the transition from 2D chart to 3D scene is spatially continuous, not a jump cut.

**Degraded state:** if a source is down, its marker is absent and a mono note appears in the margin track: `ISS · POSITION UNAVAILABLE`. The band itself never fails — the horizon, compass, and Sun/Moon positions are pure computation.

---

## Part IV — Screens

### 10. `/` — Daily Brief

The entry point. There is no account system — must work for every visitor. Must answer the question in under three seconds.

#### Composition, top to bottom

**Eyebrow strip** (mono, `micro`, uppercase, `brass-500`)
`DELHI · 28.61°N 77.21°E · WED 22 JUL · CIVIL TWILIGHT ENDS 19:42`

Left-aligned. A location switcher sits at its right end as a text button, not a dropdown chip — it should read as part of the line, not a control bolted on.

**The Headline** (`display-xl`, proportional, with mono numerals inline)

One sentence. The synthesized answer.

> _The ISS crosses your sky at_ `21:42`_, bright enough to see from the city — and a solar storm arriving tomorrow night gives you a_ `1 in 3` _chance of aurora._

Note the mono/proportional seam running through it. Words and measurements are visually distinct even inside a single sentence. This is the type system doing its job at the largest possible scale.

Max two lines on desktop. If the composed sentence would exceed that, the backend's summary logic should shorten rather than the frontend wrapping to three.

**The Horizon Band** — full reading-track width, 96px below the headline.

**The Entries** — vertical stack, separated by hairline rules, 48px vertical padding each. Ordered by the degradation contract's own priority, which is also genuine priority of interest:

1. **Sky Anchor** — tonight's darkness window. Twilight phases as a small horizontal scale with the current moment marked. Moon phase and rise/set. This entry never fails.
2. **ISS pass** — next visible pass, direction, peak altitude, duration, brightness. A small arc diagram showing the path across the sky.
3. **Space weather** — the causal chain, rendered as a real chain:
   `FLARE 19 JUL` → `CME ARRIVING 23 JUL ±6h` → `Kp 6 PREDICTED` → `AURORA POSSIBLE AT YOUR LATITUDE`
   Each link is a small panel connected by a brass rule. The Confidence Ticks sit at the end. This is Pillar 3 made visible — the single most important entry in the product, and it should be given the most vertical space.
4. **Near-Earth object** — closest approach, size compared to something human-scale (Pillar 4: "about as wide as the Eiffel Tower is tall"), miss distance in lunar distances.
5. **Learning moment** — the one place the serif appears at `body-l`. Three or four sentences, no data, no chrome. Set as a pull-quote with generous margins. It should read like a well-edited paragraph in a good magazine, and it is the emotional exit note of the page.

**Exit points** — two, at the bottom, as text links with a brass rule above: _Explore this sky_ → `/explore`, and _Find a better view tonight_ → `/best-spot`.

#### Entry states

- **Loading** — the entry's structure renders immediately (title, layout, units) with values as brass em-dashes. Never a skeleton shimmer; skeletons are the SaaS tell and they hide structure. Showing the frame with empty readouts is what an instrument does while acquiring.
- **Unavailable** — the entry remains, dimmed to 50%, with a plain-language mono note: `SOURCE UNAVAILABLE · LAST SEEN 14:20`. It is never hidden. Hiding a failed card would make the page silently lie about completeness.

---

### 11. `/explore` — The Explorable Universe

Full-bleed. Persistent nav auto-hides after 3 seconds of camera motion and returns on pointer-to-top-edge. Background is `sky-950`, the only true near-black in the product.

#### Opening sequence — the first 45 seconds

A single locked cinematic, only on first visit (subsequent visits drop the user directly into the scene):

| Time | Event                                                                                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Black. A single mono line, centered, small: `28.61°N 77.21°E · 21:04 LOCAL`. Ambient audio fades in — low wind, no music.                                                               |
| 0:04 | The user's real night sky fades up. Stars at true positions, magnitude-scaled. No labels yet. The horizon rule is faintly visible at the bottom.                                        |
| 0:12 | One point of light begins moving. Cursor gravity gently biases toward it. A hairline tether and a single mono label appear: `ISS`.                                                      |
| 0:20 | On click: the camera lifts — a long `expo.inOut` rise from ground to orbit, 1.6s — and locks to the ISS in true orbital motion. Ambient audio shifts from wind to a low mechanical hum. |
| 0:26 | Diegetic text materializes on a tether from the station: _Seven people are inside, moving at_ `27,600 km/h`_. It laps your city every_ `90 minutes`_._                                  |
| 0:40 | The user drags. Camera breaks lock. Earth resolves, wrapped in the live Auroral Ring. Control is now entirely theirs.                                                                   |

#### Interaction model

- **No menus.** The scene is the navigation, per Pillar 2.
- **Rule of 7** — never more than seven clickable objects at any zoom level. Everything else is ambient. Enforced by the semantic zoom system, which aggregates rather than hides: satellites merge into constellation-shaped clusters, then into a single orbital shell glow.
- **Cursor gravity** — the pointer is magnetically biased toward selectable objects within 40px, with a 60ms ease. Teaches selectability without a tutorial.
- **Peeling the onion** — tap for the one-sentence story; hold for the measurements; hold longer for full technical data. Three depths, user-controlled.

#### Overlay panels

The one place backdrop blur is permitted. Panels are not floating cards — they are **tethered to their object by a 1px brass line** and positioned in screen space adjacent to it, moving as the camera moves. Maximum 380px wide. Content order is fixed: one plain sentence (serif), then measurements (mono), then a link deeper.

An invisible DOM mirror of all diegetic text is maintained for screen readers — non-negotiable, since the 3D scene is otherwise entirely inaccessible.

---

### 12. `/best-spot` — Best-Spot-Tonight Finder

Split layout, 40/60 on desktop: ranked list left, map right. On mobile the map is full-bleed with the list as a draggable sheet from the bottom.

**The map is the light-pollution data.** MapLibre with a custom style where the base map is deliberately minimal — no road labels, no POI clutter, just terrain, water, and place names in mono — and the light-pollution grid is the dominant visual layer, rendered as a continuous luminance field in `brass` tones. Dark sites are literally dark on the map. The visual and the meaning are the same thing.

**Ranked results.** Each result shows its score breakdown _explicitly_, not as a single number:

```
CHERRY VALLEY                        42 km · 38 min
────────────────────────────────────────────────
CLARITY    ▮▮▮▮▮▮▮▯   12% cloud
DARKNESS   ▮▮▮▮▮▮▯▯   BORTLE 3
TRAVEL     ▮▮▮▮▯▯▯▯   42 km
```

Same three-bar language as the Confidence Ticks — one visual grammar for "this is a composite score you can inspect." The user should never wonder why a spot ranked where it did.

**Honest degradation:** if cloud data is unavailable, the clarity bar is replaced with `CLOUD DATA UNAVAILABLE` and the header carries a mono note that ranking is running on darkness and travel only, at reduced confidence.

---

### 13. `/log` — Personal Sky Log

A field journal. Public, local to this browser — no account, no server-side record.

**Header stats** — three large mono figures with small proportional labels beneath: nights observed, ISS passes caught, last aurora. Set at `data-l`, widely spaced, no cards, no boxes. Just numbers on the page, like a plate in a scientific monograph.

**Timeline** — a single vertical brass rule down the left of the reading track. Entries hang off it, newest first, grouped by month with the month set in `display-m` at low opacity as a section marker.

Each entry: date (mono), event type (small engraved icon + label), the conditions at the time (Kp, cloud, moon phase — all mono), and an optional user note (serif, italic). Auto-logged and manually-added entries are distinguished by a filled versus hollow marker on the rule — a small honest distinction between what the system observed and what the user claimed.

**Empty state** — not a shrug. A single line of direction: _Nothing logged yet. Your first ISS pass tonight is at_ `21:42` _— catch it and it lands here._ With a link to the Brief. An empty screen is an invitation to act.

---

### 14. `/accuracy` — Track Record

Public. The most important screen for trust, and it should look like a scientific plot, not a business dashboard.

**Main chart** — predicted versus actual Kp over time. A step plot, not a smooth curve (Kp is a discrete index; smoothing it would be a small lie). Predicted values in `brass-500`, actual in `ember-600`. Where they diverge, the gap is filled at 15% opacity — misses are _visually emphasized_, not hidden.

**Rolling hit-rate** — a single large mono figure with the Beta prior explained in one serif sentence beneath: _Early predictions start from a neutral prior rather than a perfect score, so this number is honest from day one._

**No cherry-picking controls.** No date-range selector that lets the page show only its best week. The default and only view is the full record. That constraint _is_ the design.

Axis labels, gridlines, and annotations all in brass mono at `micro`. Gridlines at 1px, 20% opacity. The chart should be dense and quiet — a plot from a journal, not a marketing graphic.

---

### 15. `/settings`

Public, local to this browser — no account. Calm, wide-spaced, single column, no tabs.

Sections separated by hairline rules with mono uppercase section labels: `LOCATION`, `ALERTS`, `APPEARANCE`, `YOUR DATA`.

**Location** replaces what used to be a saved-locations list: there is one current location, editable inline (label, latitude, longitude), applying site-wide across the Daily Brief, Explore, and Best Spot the moment it's saved. No sign-in, no per-account list — just a browser-local setting anyone can change.

**Appearance** contains the Red Light Mode toggle with a one-line serif explanation of _why_ it exists — a small moment of teaching that reinforces the product's credibility.

**Your data** — the clear-local-data control. It is not hidden, not styled as dangerous-red-by-default, not buried behind three confirmations. It sits plainly with an honest description: _Wipes your saved location, Sky Log entries, and alert preferences from this browser. It cannot be undone._ One typed confirmation, done — there is no server-side account or row to delete, only this browser's own storage.

---

### 16. `/login` and `/signup` — removed

There is no account system (see `DECISIONS.md`). This section number is retired rather than reused or renumbered, so existing citations to the sections after it (`§17` Share Card) stay stable.

---

### 17. `/share/:id` — Shareable Sky Card

Public, no login, and the growth loop. This is the screen most non-users will see first, so it carries the most brand weight per pixel.

Single-viewport composition, no scroll on desktop:

- Location and date, mono, `micro`
- The headline, `display-l`
- The Horizon Band, simplified — markers and horizon only, no scrubber
- Three key measurements as a mono row
- A discreet ASTRANET wordmark and a single CTA: _See your own sky_ → `/`

**OG image** is server-rendered at 1200×630 using the same composition and the _actual twilight colors for that location and time_. A shared link at midnight looks visibly different from one shared at dusk. Shared cards become small, honest advertisements for the product's core idea.

**Instrument plate.** The eyebrow strip and the mono measurement row sit on a solid `sky-900` plate (`sky-800` is an acceptable alternative); text on the plate is `sky-100` ink with `brass-300` labels. The headline and the Horizon Band stay on the bare surface, as designed — the twilight color is the point of the card and must remain the dominant field.

This exists for a measured reason, not a stylistic one. §4.1's ramp is continuous from a near-white day surface to a near-black night one, so it necessarily passes through mid-greys. Against those, the best worst-case contrast any two-token ink strategy can reach is `sqrt(contrast(lightToken, darkToken))` — the value at the crossover where both candidates are equal. For the `brass-300`/`brass-700` pair that ceiling is **1.79:1**, and for `sky-400`/`sky-600` it is **1.76:1**, against the `4.5² = 20.25` pair contrast a 4.5:1 guarantee would require. No threshold, no selection rule, and no narrowing of the ramp can lift small text to Part VI's floor while it sits directly on the surface; only removing it from the surface can. On a `sky-900` plate the same tokens give `brass-300` **8.67:1** and `sky-100` **15.83:1**.

The plate is **unconditional** — it does not appear only at the twilights that need it. A plate that came and went with solar altitude would make the card's identity flicker with time of day and read as a rendering fault.

**Known exception, not yet resolved:** the Horizon Band's compass ticks and marker labels (`micro`, `brass`) and the footer CTA (`body`, muted) remain on the bare surface and therefore remain below the 4.5:1 floor across part of the ramp. Backing them would either occlude the Band — the signature element — or add a second plate to the footer. That is a composition decision this section does not yet make.

---

## Part V — Responsive Strategy

Designed as five real conditions, not breakpoints applied after the fact.

### Ultrawide — 1920px+

Do **not** stretch the reading track. The measure stays capped at 68ch. The additional horizontal space is given to:

- The Horizon Band, which widens to a fuller azimuth sweep (N through N, a complete 360° panorama rather than the 240° default).
- An ambient atmospheric gradient bleeding to both edges — the actual twilight field, computed, extending past the content.

The content stays centered-left with a fixed max-width; the extra space becomes _sky_, which is thematically correct rather than empty.

### Desktop — 1280–1920px

The reference implementation described throughout this document. Two-track Observation Grid, full margin track, all motion active, full 3D scene.

### Laptop — 1024–1280px

Margin track narrows to 180px and drops to `micro` size only. Gutter tightens from 96px to 64px. `display-xl` steps down to 4rem. Horizon Band reduces to 150px tall. Otherwise identical.

### Tablet — 768–1024px

The margin track **collapses inline**: freshness and confidence indicators move directly beneath their measurements rather than beside them. This is the most significant structural change in the system and it must be designed, not automated — each entry needs an explicit stacked arrangement.

Best-Spot switches to map-primary with a bottom sheet. The 3D scene remains full but drops to the Tier-2 asset budget. Touch replaces cursor gravity with a 44px minimum tap target on every selectable object.

### Mobile — below 768px

Per the product's own strategy, mobile is where casual daily return visits happen. The Brief must be _excellent_ here, not merely functional.

- Single column, 20px side margins.
- Headline drops to `display-m` (2.5rem) but stays the dominant element. It is never reduced to body size — the answer must remain the answer.
- The Horizon Band becomes **horizontally scrollable**, 120px tall, with the compass fixed and snap points at each cardinal direction. This is arguably better than desktop: panning across your own horizon with a thumb maps directly to turning your head.
- Entries stack with 32px separation. The causal chain rotates from horizontal to vertical, links connected by a vertical brass rule.
- Exit-point links become full-width tap targets with 56px height.
- `/explore` renders at Tier-3: star field, ISS, Earth, aurora ring. No volumetrics, no post-processing. Touch orbit with momentum. Diegetic text becomes bottom-sheet text — world-space text is unreadable at this size, and forcing it would be pride over usability.
- Red Light Mode is most valuable here, since mobile is the device people actually take outside. Surface it prominently in settings on mobile specifically.

---

## Part VI — Quality Floor

Non-negotiable, and not announced in the UI:

- **Contrast** — all text meets WCAG AA at every twilight phase. Night mode is verified at its lowest luminance; this requires testing the _interpolated_ states, not just the five named ones.
- **Focus** — visible keyboard focus on every interactive element, styled as a 2px `brass-300` outline offset 2px. Never removed, never a browser default.
- **The 3D DOM mirror** — every diegetic text element and clickable object has a screen-reader-accessible equivalent in the DOM, kept in sync. `/explore` is fully navigable by keyboard with arrow-key object cycling.
- **Motion** — `prefers-reduced-motion` respected per §7.6.
- **Color independence** — no information conveyed by hue alone. Phenomenon colors are always paired with a shape or label, which is also what makes Red Light Mode possible.
- **Loading** — structure before values, always. Never a full-page spinner; the product's own architecture guarantees partial data, and the UI should reflect that from the first frame.

---

## Part VII — Voice

The interface writes like a knowledgeable friend who respects your time, not like a system reporting its state.

| Do                                                                               | Don't                                               |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| _The ISS passes at 21:42, high and bright._                                      | _ISS transit event detected — visibility: nominal._ |
| _We can't reach the space weather service right now. Last reading was at 14:20._ | _Error: SWPC endpoint unavailable (503)._           |
| _Nothing logged yet. Your first ISS pass tonight is at 21:42._                   | _No data to display._                               |
| _About as wide as the Eiffel Tower is tall._                                     | _Estimated diameter: 324m._                         |

Rules:

- Sentence case everywhere except mono labels, which are uppercase with wide tracking.
- Measurements always carry units. Always.
- Never state a forecast without its confidence.
- Never apologize. Errors explain what happened and what to do next.
- Every phenomenon gets one plain sentence before any number appears. That ordering is Pillar 1, enforced at the copy level.

---

## Appendix — Design decision rationale

For anyone reviewing why this looks the way it does:

**Why not dark-mode-with-cyan?** It is the category default and communicates genre, not subject. ASTRANET's subject is the real sky, which is not cyan.

**Why red as the accent?** Authentic to night observation, functionally justified by dark adaptation, and the strongest available differentiator in a category saturated with cool accents.

**Why the mono/proportional split?** It makes the product's core value — honest measurement versus plain-language explanation — visible before reading. It is a typographic rule that carries meaning, which is more durable than a distinctive display face.

**Why an asymmetric grid with a margin track?** Because provenance must be permanently visible without interrupting reading, and a symmetric grid has no natural home for it.

**Why the Horizon Band?** It answers the actual question a person outdoors has — _where do I look?_ — and no competitor answers it. It also makes the layout itself an instrument, which is the entire creative direction in one element.

**Why does the interface change color with the real sun?** Because a product whose central promise is _now_ should look different at different nows. It is the promise, expressed as light.
