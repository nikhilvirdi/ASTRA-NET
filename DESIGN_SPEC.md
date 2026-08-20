# ASTRANET — Interface Design Specification

**Final consolidated version.** Replaces every prior version of this document. This is the single spec a coding agent should build from — no separate addendum files, no version-hopping between v1/v2/v3. Where earlier drafts disagreed with each other, this document is the resolution.

---

## Binding constraints — read this before anything else

Three things are explicitly locked and must not be reinterpreted, redesigned, or "improved" by anyone building from this document:

1. **Typography is fixed.** Archivo (display/interface), Martian Mono (measurements), Newsreader (explanatory prose). No substitution, no alternative pairing, regardless of anything else in this document.
2. **The Daily Brief's background system is fixed.** The twilight-interpolated sky ramp — the interface's color changing continuously with real computed solar altitude — is the product's central visual identity (§2) and is retained exactly as designed. Nothing in this document touches it.
3. **The Daily Brief gets minimal visual change.** Its composition, structure, and feel are considered correct. Everything applied to it below is either a genuine bug fix (something already broken against this spec) or a deliberately tiny, single-line addition that reuses existing typography and chrome — never a restructuring, never a new visual element with its own weight. If a future change to the Daily Brief doesn't fit in one of those two categories, it doesn't belong on this screen.

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

ASTRANET already computes the Sun's altitude for the user's exact coordinates. That number is not just data for a card — it is the **lighting condition of the entire application**.

The full UI palette is derived at runtime from real solar altitude at the user's location:

| Solar altitude | Twilight phase        | Interface state                                     |
| -------------- | --------------------- | --------------------------------------------------- |
| > 0°           | Day                   | Pale, cool, high-key. Reading light.                |
| 0° to −6°      | Civil twilight        | Warming. Contrast softens. Horizon glows.           |
| −6° to −12°    | Nautical twilight     | Deep slate. Brass marks emerge.                     |
| −12° to −18°   | Astronomical twilight | Near-ink. Airglow tint appears.                     |
| < −18°         | Night                 | Full dark. Minimum luminance. Red accents dominate. |

The transition between phases is continuous, not stepped. **This system is retained exactly as-is per the binding constraints above — do not alter it while fixing anything else on the Daily Brief.**

### 3. Aesthetic risk, stated plainly

**The accent color is red, not blue.** ASTRANET uses **astronomer's red** — the deep, desaturated red of a dark-adaptation headlamp. Authentic to night observation, functional (preserves night vision, drives a real Red Light Mode), and the strongest available differentiator in a category saturated with cool accents.

**No blue, anywhere.** Not a hover state, not a default component color, not a link. If blue appears in a build, it did not come from this document.

---

## Part II — Design System

### 4. Color

#### 4.1 Base ramp — "Sky"

| Token     | Hex       | Use                                                                                                   |
| --------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `sky-100` | `#EEF1F1` | Day surface. Cool paper, not cream.                                                                   |
| `sky-200` | `#D6DCDC` | Day secondary surface, dividers in day mode.                                                          |
| `sky-300` | `#B4BFBF` | Secondary body text on light surfaces — the step between a divider tone and a disabled/tertiary tone. |
| `sky-400` | `#8B9898` | Mid-tone. Disabled states, tertiary text on light.                                                    |
| `sky-600` | `#3E4A4A` | Nautical twilight surface.                                                                            |
| `sky-800` | `#1C2424` | Astronomical twilight surface.                                                                        |
| `sky-900` | `#111818` | Night surface. The deepest base.                                                                      |
| `sky-950` | `#0A0E0E` | Immersive/3D scene void. `/explore` only.                                                             |

`sky-950` is the only near-black in the system, exclusive to the 3D scene void. The 2D interface never uses pure black.

#### 4.2 Instrument — "Brass"

| Token       | Hex       | Use                                          |
| ----------- | --------- | -------------------------------------------- |
| `brass-300` | `#C9B187` | Tick marks and scale rules on dark surfaces. |
| `brass-500` | `#9A8258` | Secondary data labels, axis numerals.        |
| `brass-700` | `#6B5A3C` | Brass on light surfaces (day mode).          |

#### 4.3 Signal — "Ember"

Live state, alerts, and high-attention events only. Never decoration, never borders, never a gradient, never a default hover color (see §4.6).

| Token       | Hex       | Use                                 |
| ----------- | --------- | ----------------------------------- |
| `ember-400` | `#E0614C` | Live-pulse indicator, active state. |
| `ember-600` | `#C4362A` | Primary action, alert emphasis.     |
| `ember-800` | `#7E241C` | Red Light Mode base.                |

#### 4.4 Phenomenon colors

| Token     | Hex       | Phenomenon                                                                     |
| --------- | --------- | ------------------------------------------------------------------------------ |
| `aurora`  | `#7FA88A` | Aurora. Muted sage-green.                                                      |
| `solar`   | `#D9A05B` | Solar activity, CME, flares.                                                   |
| `orbital` | `#A8B4BC` | ISS and satellites. Cool metallic grey.                                        |
| `neo`     | `#B08968` | Near-Earth objects. Dusty rock.                                                |
| `meteor`  | `#C9C4D6` | Meteor showers. Pale chalk-lavender — a brief cool streak, not a light source. |

Every phenomenon shown anywhere in the product must map to one of these tokens before it ships. No unassigned phenomenon gets a color improvised at build time.

#### 4.5 Red Light Mode

Toggleable in `/settings`, auto-suggested below −18° solar altitude after an idle-then-returned signal. Single-hue red ramp on `sky-950`, no cool tones, no white text. Not a gimmick — the difference between an app usable outdoors at night and one that isn't.

#### 4.6 Interaction states — brass, not ember

Hover and focus use brass (`brass-300` on dark, `brass-700` on light). Ember is reserved exclusively for genuinely live or urgent things. If every hover state glows red, red stops meaning "live" — this is the rule that keeps ember meaningful.

---

### 5. Typography

**Fixed per the binding constraints above — see §5.2 for the exact three faces. Nothing in this section is open for reconsideration.**

#### 5.1 The typographic rule that defines the system

> **Words are proportional. Measurements are monospaced. Always, everywhere, without exception.**

The seam this creates — visible at a glance, before reading a word — is the product's honesty made typographic. This applies at every size, including the Daily Brief headline at its largest.

#### 5.2 The three faces

| Role                    | Face                                | Reasoning                                                                                                                                          |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interface & display** | Archivo (variable)                  | A cartographic grotesque — neutral enough for dense data, enough weight range for large headlines. Deliberately not a high-contrast display serif. |
| **Measurement**         | Martian Mono                        | Tabular figures non-negotiable — columns of Kp values and pass times must align.                                                                   |
| **Explanation**         | Newsreader (variable, optical size) | Used only for plain-language explanations and the Learning Moment. Signals _this is written for you to understand_, not _this is data_.            |

**Small caps, not stretched capitals.** Where the font supports true small-caps (OpenType `smcp`), use it for micro/eyebrow labels instead of uppercasing regular glyphs. Both Archivo and Martian Mono support this.

#### 5.3 Type scale

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

**Headline: hard constraint, not a target.** `display-xl` is set tight, left-aligned, 16 words per line maximum, **two lines total on desktop.** If the composed sentence would exceed that, the backend's summary composer shortens it before it reaches the frontend — dropping the least essential clause, never a unit or a confidence qualifier. The frontend has no license to wrap a third line, shrink the font, or otherwise absorb an oversized sentence. A five-line headline is a backend bug, not a frontend styling decision.

#### 5.4 Time, freshness, and Kp precision — canonical formats

**Time.** Screens tied to the visitor's own location and moment (Daily Brief, Explore, Best Spot, Settings) show local time, 24-hour, no suffix. Screens meant for someone else to read (Share Card, `/accuracy`) show UTC, explicitly suffixed. Never mixed on one screen.

**Freshness labels.** Exactly two phrasings exist anywhere in the product: **`LIVE`** (fast-tier, paired with the live-pulse dot) and **`UPDATED Xm AGO`** (slow-tier, or fast-tier gone stale). No other phrasing ships — not "(NOW)", not a bare bullet, not "TARGET:".

**Kp precision.** Discrete index, never a raw continuous decimal. One decimal maximum, third-step notation preferred (`3-`, `3`, `3+`) wherever it maps cleanly.

---

### 6. Spacing & Layout

#### 6.1 Spacing scale

Base unit 4px: `2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192 · 256`.

#### 6.2 The Observation Grid

The core desktop layout is an asymmetric two-track grid — reading track (max 68ch) plus a margin track (240px) carrying freshness, confidence, coordinates, and source. This is original to the product's design, not a new structural change — it has simply never been built. Completing it now on the Daily Brief is a correction against this spec, not a redesign of the screen.

```
┌────────────────────────────────────────────┬──────────────┐
│   READING TRACK (max 68ch)                  │  MARGIN      │
│                                              │  TRACK 240px │
└────────────────────────────────────────────┴──────────────┘
```

**The margin track is sticky** (`position: sticky`) within its own column, independent of the reading track's scroll — this is what actually delivers "permanently visible" rather than a second column that scrolls at the same rate as the first.

#### 6.3 Corner radius

| Token         | Value  | Use                                                                    |
| ------------- | ------ | ---------------------------------------------------------------------- |
| `radius-none` | 0      | Rules, dividers, the Horizon Band, data plots.                         |
| `radius-sm`   | 2px    | Input fields, small controls.                                          |
| `radius-md`   | 6px    | Buttons, toggles.                                                      |
| `radius-full` | 9999px | Only genuinely circular objects — dial controls, sky-position markers. |

Sharp things are readouts, soft things are controls. The causal-chain links on the Daily Brief are readouts connected by a measurement, not buttons — `radius-none`/`radius-sm`, never a rounded pill.

#### 6.4 Elevation

No drop shadows. Depth via: luminance steps, hairline rules (1px `sky-600` at 40%), one deliberate backdrop-blur exception (`/explore` overlay panels only), and a subtle grain/dither texture on dark surfaces (`sky-800`/`sky-900`/`sky-950` only) — both a materiality cue and a real fix for banding in the twilight gradient.

#### 6.5 Persistent Horizon Reference

Once the full Horizon Band scrolls out of view on `/`, a condensed strip pins beneath the top nav: compass ticks and object dots only, 32px tall, no scrubber. Un-pins on scroll-to-top or navigation away. "Where do I look?" shouldn't require scrolling back up to re-answer.

---

### 7. Motion

#### 7.1 Principles

Celestial motion is slow, continuous, inexorable — no elastic easing anywhere.

| Class      | Duration   | Easing                | Use                                                |
| ---------- | ---------- | --------------------- | -------------------------------------------------- |
| Micro      | 120–180ms  | `ease-out`            | Hover, focus, toggle.                              |
| Transition | 320–480ms  | `expo.out`            | Panel entry, card reveal, route change.            |
| Cinematic  | 800–1600ms | `expo.inOut`          | 3D camera moves, page-load sequence.               |
| Ambient    | 4–20s      | `sine.inOut`, looping | Atmospheric gradients, star twinkle, aurora drift. |

#### 7.2 The Live Pulse

Fast-tier data carries a single `ember-400` dot, 4px, pulsing once per actual poll cycle — never a decorative loop.

#### 7.3 The Freshness Rule

A 1px depleting rule sits under every measurement, full-width in `brass-300` at arrival, depleting across the source's refresh interval, turning `ember-600` at 60% numeral opacity when stale.

#### 7.4 Confidence Ticks

```
Lead      ▮▮▮▮▮▯▯▯
Agreement ▮▮▮▮▮▮▮▯
History   ▮▮▮▮▯▯▯▯
          ─────────
          MODERATE
```

**Never a percentage. Never a gauge. Never a number next to a bar — no exceptions, on any screen, including the Share Card.** Bars plus one qualitative verdict word is the entire display, always. Reveal: each bar fills 0→value over 400ms `expo.out`, staggered 60ms, once per data arrival — never on re-render.

#### 7.5 Page-load sequence

Under 1.5s total: surface resolves to twilight color (0–400ms) → Horizon Band draws (300–900ms) → headline sets complete, no stagger (600ms) → entries reveal in 60ms stagger (800ms+) → margin-track provenance fades in last (1200ms).

#### 7.6 Reduced motion

Ambient loops stop, live pulse becomes a static dot with timestamp, freshness rules jump in steps, load sequence collapses to one 200ms fade.

#### 7.7 Anticipatory hover

Hovering a Horizon Band marker (not just clicking) previews identity — tether and label at reduced opacity — before any navigation. Same principle as Explore's cursor gravity: preview before commit.

---

### 8. Iconography & Illustration

#### 8.1 Icons

Engraved, not drawn — 1.25px stroke, square terminals, 20px grid. Instrument-panel engraving, not Feather/Lucide's rounded set. Phenomena use real chart symbols (magnitude dots, directional arcs, okta notation), never icons.

**`/explore`'s cursor** is a small engraved crosshair mark, not the system default arrow — a one-pixel reminder the scene is an instrument being aimed.

#### 8.2 Illustration policy

Every visual traces to one of three sources: real data drawn (plots, sky charts, arcs), real imagery (NASA GIBS, always attributed), or instrument marks (ticks, scales, rules). Nothing else ships.

#### 8.3 Object label legibility — the decluttering rule

Any screen rendering real-position objects with text labels (Horizon Band, Explore, the Share Card's simplified band) follows one rule: **no two labels may render overlapping or interleaved, at any zoom level, on any screen.** Resolution priority: stagger along the tether → merge into a cluster mark at wider zoom → reveal on hover/tap only. No screen ships a state where two labels sit drawn on top of each other.

---

## Part III — The Signature Element

### 9. The Horizon Band

Appears on `/`, `/best-spot`, and `/share/:id`, plus its condensed pinned form (§6.5). Full-width strip, 180px tall on desktop, no border, no background fill — sits directly on the page surface.

- Horizontal axis: true azimuth, N through W by default (240° sweep; full 360° only at ultrawide). Vertical axis: true altitude, horizon at bottom.
- The horizon rule is the heaviest line in the product — 2px, solid.
- Every marker is at its real position, always. Where two collide, §8.3 governs the label, never the marker.
- A time scrubber runs beneath, styled as a brass instrument control (tick-marked rail, small circular brass handle) — not a generic web slider, not a stock blue-thumb range input.

**Interaction:** hover previews per §7.7; click navigates to `/explore` with the camera pre-oriented to the same viewpoint — spatially continuous, not a jump cut.

**Degraded state:** a down source's marker is simply absent, with a margin-track note in the canonical `UPDATED Xm AGO` phrasing. The Band itself never fails — horizon, compass, and Sun/Moon positions are pure computation.

---

## Part IV — Screens

### 10. `/` — Daily Brief

**Everything in this section operates under the binding constraints at the top of this document.** The background system is untouched. The layout below is a correction of what the original spec already called for, not a new direction. The additions listed are deliberately small — read each one and confirm it's genuinely a single line, tick, or icon before implementing it as anything more.

#### Composition, top to bottom — unchanged from the original intent

**Eyebrow strip** (mono, `micro`, true small caps, `brass-500`): `DELHI · 28.61°N 77.21°E · WED 22 JUL · CIVIL TWILIGHT ENDS 19:42`. Location switcher reads as part of the line, not a bolted-on control. **One addition only:** when a streak of 2+ consecutive nights exists, it's appended to the end of this same line in the same styling — `... · 4 NIGHTS RUNNING`. Nothing else changes about this row.

**The Headline** (`display-xl`): one sentence, the synthesized answer, mono/proportional seam intact, hard two-line cap per §5.3. **One addition:** a small engraved speaker-icon button sits at the end of the eyebrow row (after the location switcher), rendered only when audio mode is enabled in Settings — reading the headline and entries aloud via the browser's built-in text-to-speech. No player chrome beyond the icon itself; playing state is a slow pulse on the icon.

**The Horizon Band** — unchanged, full reading-track width, pins in condensed form per §6.5.

**The Entries** — the original five, in the original order, with the original degradation states (structure-with-em-dashes while loading, dimmed-to-50%-with-a-note when unavailable, never hidden):

1. **Sky Anchor** — darkness window, twilight scale, Moon phase and rise/set. Never fails. **Two additions, both minimal:** the existing twilight scale gains two more thin brass tick marks for golden hour and blue hour, styled identically to the phase ticks already there — no new element, two more ticks on the one that exists. Separately, when tonight's full moon is genuinely a supermoon, the moon-phase line gains a short parenthetical: `FULL (99%) — SUPERMOON`. Not a badge, not a graphic — three more words in the same mono line.
2. **ISS pass** — next visible pass, direction, peak altitude, duration, brightness, arc diagram. **One addition:** a comfort-temperature reading appended as a fourth measurement in the same row as duration/brightness — `8°C AT PASS TIME`. Same mono styling as the numbers already there.
3. **Space weather** — the causal chain (`FLARE` → `CME` → `Kp` → `AURORA`), rendered as sharp brass-ruled panels, never rounded chips. Confidence Ticks per §7.4 exactly — bars and a word, never a percentage. No additions here.
4. **Near-Earth object** — unchanged.
5. **Learning Moment** — unchanged, the one place the serif appears at `body-l`.

**Exit points** — unchanged: two text links with a brass rule above.

**What this section deliberately does not add:** no new entry type, no new card, no new visual weight anywhere on this page beyond the six additions named above (streak in the eyebrow, audio icon, two twilight ticks, a supermoon parenthetical, one more mono measurement on the ISS entry). If a future request asks for more than this on the Daily Brief specifically, it should be treated as a new decision, not an extension of this spec.

---

### 11. `/explore` — The Explorable Universe

No new features land here in this version — everything speculative for this screen (satellite trains, planet conjunctions, eclipse rendering) was deliberately cut from scope. What remains is correction only:

- The opening sequence is descoped to a simple fade-in — no wind audio, no mechanical hum, no orbit-rise choreography, until the rest of the scene has caught up to what's already specified.
- The object-label decluttering rule (§8.3) applies here exactly as it does on the Horizon Band.
- The engraved crosshair cursor (§8.1) replaces the system default.
- No menus — the scene remains the navigation. Rule of 7 clickable-object cap, cursor gravity, and the three-depth "peeling the onion" interaction stand as originally specified.

---

### 12. `/best-spot` — Best-Spot-Tonight Finder

Split 40/60 desktop layout unchanged. Map remains the light-pollution data itself — a continuous brass-toned luminance field, not a generic pin map with a dark background.

**Real ranking modes.** Aurora, ISS, and Meteor filters all compute a genuine ranking now — not just Aurora with the other two doing nothing. Each filter's active-state underline uses that phenomenon's own token (§4.4): `aurora`, `orbital` for ISS, `meteor` for Meteor. Selecting a filter changes each site's third data row to that event's specific detail — never a fixed row that ignores the selected filter.

**Extended cloud-cover timeline.** The single "12% cloud" reading becomes a small horizontal sparkline spanning the next 6–12 hours, same brass-fill-on-track grammar as the existing three-bar scores, with a thin marker for "now." Degrades to today's single-hour reading if extended data is unavailable — never a fabricated flat line.

**Honest degradation, unchanged:** an error state and a populated results list are mutually exclusive — never both on screen. If cloud data is down, the clarity bar is replaced with a plain note and the header states the ranking is running on darkness and travel only.

---

### 13. `/log` — removed

Retired per prior decision. Number not reused.

---

### 14. `/accuracy` — Track Record

Unchanged. Step plot, no cherry-picking controls, Beta prior explained in one serif sentence.

---

### 15. `/settings`

Sections: `LOCATION`, `ALERTS`, `APPEARANCE`, `YOUR DATA`. No language section, no install-app section — both were cut from this version's scope.

**Alerts are real now, not decorative.** The same toggle switches, same brass-crescent knob, but functional: enabling one triggers the browser's own native push-permission prompt, never a custom modal. Each toggle carries an honest status line beneath it — `PUSH ENABLED` or `PUSH BLOCKED — CHECK BROWSER SETTINGS` — the same honesty principle the rest of the product already applies to data freshness, now applied to permission state.

**Your Data.** The clear-local-data control is not styled as a danger warning by default — this was a real defect against this spec in an earlier build and stays a hard rule, not a stylistic option.

---

### 16. `/login` and `/signup` — removed

No account system. Number not reused.

---

### 17. `/share/:id` — Shareable Sky Card

Single-viewport, no scroll, no footer (its composition rule stays "no scroll on desktop," which a footer would violate).

**The data-parity rule, restated as a hard requirement:** this card renders from the same computed Brief object `/` uses — same headline, same full three-factor confidence — never a separate simplified payload. If a piece is genuinely unavailable, it's blanked per the degradation contract, never replaced with a bare percentage or a missing headline as a shortcut.

**Native share sheet.** Where the platform supports it, the existing Share action triggers the OS-native share sheet instead of a copy-link fallback. No new visual element — same button, smarter behavior.

**Discoverability.** Proper meta tags and a sitemap entry for these pages — no UI change, a correctness item so the pages that already exist are actually findable.

**Instrument plate, unconditional, per the existing contrast math:** the eyebrow strip and mono measurement row sit on a solid `sky-900` plate; the headline and Horizon Band stay on bare surface. The known remaining exception (compass ticks and footer CTA below 4.5:1 across part of the ramp) is recorded, not silently accepted as solved.

---

### 18. Footer (new)

Present on every route except `/explore` (full-bleed by design) and `/share/:id` (no-scroll composition). One hairline-topped row, `sky-600` at 40%, content in `micro`/mono/`brass-500`:

```
ASTRANET                              STATUS · ABOUT
```

Left: bare wordmark. Right: two plain-text links to `/status` and `/about`, separated by a middle dot, no button chrome — same "reads as part of the line" principle as the location switcher. Nothing else lives here in this version — no RSS link, no language selector; both were cut from scope.

---

### 19. `/status` (new)

Public, plain, an instrument readout — closer to the Accuracy page's "dense and quiet" register than any dashboard product. Single reading-track column, one row per poller source:

```
ISS POSITION            ● LIVE
SOLAR WIND / KP         ● LIVE
SPACE WEATHER FORECAST  ● UPDATED 4m AGO
JUPITER EPHEMERIS       ● UPDATED 22m AGO
```

Source name in `body` mono, a live-pulse dot only when genuinely live per §7.2, freshness in the two canonical phrasings from §5.4 — nothing else. An unhealthy source renders dimmed in `ember-600` with its last-known timestamp, matching exactly how a degraded Daily Brief entry presents. No graph, no history — that omission is what keeps this an honest instrument reading rather than a marketing status page.

---

### 20. `/about` (new)

Public, explains the Causal Engine and the product's honesty stance. The one other page besides the Learning Moment that earns extended serif (`body-l`) treatment throughout.

**Composition:** three or four short sections — what ASTRANET is and isn't (the five-pillar framing, lightly adapted), how the confidence number is actually built (the three-factor idea in plain language, with the real factor names appearing once in mono as a callout, not buried), and a direct link to `/accuracy` framed as "see the real numbers." Same voice as the Learning Moment throughout — a knowledgeable friend explaining something, never documentation. This page succeeds if someone trusts the confidence number more after reading it, not if it looks impressive.

---

## Part V — Responsive Strategy

Five real conditions, not breakpoints applied after the fact.

**Ultrawide (1920px+):** reading track stays capped at 68ch; extra space goes to a fuller Horizon Band sweep (up to full 360°) and an ambient twilight gradient bleeding to both edges.

**Desktop (1280–1920px):** the reference implementation throughout this document. Full Observation Grid, sticky margin track, all motion active.

**Laptop (1024–1280px):** margin track narrows to 180px, `micro` only, sticky behavior retained. `display-xl` steps to 4rem.

**Tablet (768–1024px):** margin track collapses inline beneath each measurement — the most significant structural change in the system, designed explicitly per entry, not automated. Best-Spot switches to map-primary with a bottom sheet.

**Mobile (below 768px):** single column, 20px margins. Headline drops to `display-m` but stays dominant — never body-sized. Horizon Band becomes horizontally scrollable with cardinal snap points. Causal chain rotates vertical. Red Light Mode surfaced prominently in Settings, since mobile is what people actually take outside.

---

## Part VI — Quality Floor

Non-negotiable, unannounced in the UI:

- **Fonts** — Archivo, Martian Mono, Newsreader, exactly. Any other typeface anywhere is a defect.
- **Contrast** — WCAG AA at every twilight phase, tested at interpolated states, not just the five named ones.
- **Focus** — visible 2px `brass-300` outline, never removed, never a browser default.
- **The 3D DOM mirror** — every diegetic text element and clickable object mirrored for screen readers; `/explore` fully keyboard-navigable.
- **Motion** — `prefers-reduced-motion` respected per §7.6.
- **Color independence** — no information by hue alone; every phenomenon color pairs with shape or label.
- **Loading** — structure before values, always; never a full-page spinner or a skeleton shimmer.
- **Label legibility** — no two object labels overlap, at any zoom level, on any screen (§8.3), verified against real close-conjunction data.
- **No raw percentages** — no confidence or score renders as a bare number anywhere, under any condition, including the Share Card.
- **Palette closure** — no element renders in a color outside Part II's tokens. Any blue, or any hex not in this document, is a defect, checked by a lint rule, not by eye.
- **Data parity** — any derivative of the Daily Brief (the Share Card, its OG image) computes from the same source object as `/` — a smaller rendering of the same data, never a separately-fetched, incomplete one.

---

## Part VII — Voice

The interface writes like a knowledgeable friend who respects your time, not a system reporting its state.

| Do                                                                               | Don't                                               |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| _The ISS passes at 21:42, high and bright._                                      | _ISS transit event detected — visibility: nominal._ |
| _We can't reach the space weather service right now. Last reading was at 14:20._ | _Error: SWPC endpoint unavailable (503)._           |
| _Cloud data unavailable — ranking on darkness and travel only._                  | _Insufficient data. Confidence degraded._           |
| _About as wide as the Eiffel Tower is tall._                                     | _Estimated diameter: 324m._                         |

Sentence case everywhere except true-small-caps mono labels. Measurements always carry units. Never state a forecast without its confidence, always in bars-plus-verdict form. Never apologize — errors explain what happened and what to do next.

---

## Appendix — Why this version is shaped the way it is

**Why so little changes on the Daily Brief, when almost everything else in the product grew:** it was already working. The additions here — a streak count, an audio icon, two more ticks on an existing scale, three more words on an existing line, one more measurement in an existing row — were each chosen specifically because none of them ask the page to hold anything new in the visual sense. They speak in the page's existing voice instead of adding a second one.

**Why the fonts and the twilight background are called out as binding constraints instead of just described:** everything else in this document is open to correction when it's wrong. Those two are not — they're the two things about ASTRANET that were right from the start, and the risk with a large refinement pass is that "fixing" things nearby drifts into "changing" things that never needed it.

**Why RSS, multi-language, embed codes, PWA installability, satellite trains, conjunctions, eclipses, and comparison mode aren't in this version:** all were real, considered ideas — none were cut for being bad ones. They were cut because this version's scope is deliberately the features that reuse data and infrastructure already in place. They remain a clearly separate future list, not abandoned.
