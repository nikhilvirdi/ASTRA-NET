# ASTRANET — Formulas (FROZEN)

**This document is non-negotiable.** Every constant, threshold, and formula here is frozen. Agents implement these **exactly** — do not invent alternatives, do not "improve," do not substitute different constants. If something appears wrong, **flag it in `DECISIONS.md`**; do not silently change it. Every engine function must cite the section number it implements in a code comment.

All angles are in **radians** internally unless a formula explicitly states degrees. All engine functions are **pure**: inputs in, result out, `now` injected as a parameter — no clock reads, no I/O.

---

## 0. Constants

```
AU        = 1.496e8      km      (astronomical unit)
R_SUN     = 6.957e5      km      (1 AU ≈ 215 R_SUN)
R_EARTH   = 6371         km
C_LIGHT   = 299792       km/s
PC_KM     = 3.0857e13    km      (1 parsec)
PC_LY     = 3.26156      ly      (1 parsec in light-years)
LD        = 384400       km      (lunar distance)

# Geomagnetic dipole North pole (drifts — refresh yearly or use IGRF)
GEOMAG_POLE_LAT = 80.7   deg N
GEOMAG_POLE_LON = -72.8  deg  (i.e. 72.8 W)

# Twilight thresholds (Sun elevation)
TWILIGHT_ISS_AURORA = -6   deg   (civil-ish: dark enough for ISS/aurora)
TWILIGHT_STARS      = -18  deg   (astronomical: faint-star realism)
```

---

## 1. Star Position (catalog → 3D)

Distance from parallax (mas):

```
d_pc = 1000 / parallax_mas
```

**Decision — bad parallax:** if `parallax_mas <= 0.2` OR negative → **drop the star**, or pin it to a fixed 100 kpc shell. Never let it produce NaN/negative distance.

Cartesian (RA, Dec in radians; d in parsecs):

```
x = d_pc * cos(dec) * cos(ra)
y = d_pc * cos(dec) * sin(ra)
z = d_pc * sin(dec)
```

Light-travel context:

```
years_ago = d_pc * PC_LY
```

---

## 2. Star Render

Brightness from apparent magnitude:

```
m_ref     = 6.0
brightness = 10 ^ (-0.4 * (m - m_ref))       # clamp to [0, 1]
```

Point size:

```
m_limit    = 6.5
k          = 0.35
point_size = base_size * (1 + k * (m_limit - m))
```

Color temperature (Ballesteros; needs B−V). Convert Gaia `bp_rp` → B−V:

```
B_V = 0.85 * bp_rp

T_kelvin = 4600 * ( 1 / (0.92 * B_V + 1.7)
                  + 1 / (0.92 * B_V + 0.62) )
```

**RGB rendering — explicitly NOT part of the frozen engine (resolved
2026-07-15):** Mapping `T_kelvin` to an RGB color is a rendering/visual-
approximation choice, not a physical constant — competing curves (Tanner
Helland's piecewise fit, Mitchell Charity's lookup table) disagree at the
±5-10% level with no single correct answer. This step lives in `apps/web`
as a rendering-side utility using **Tanner Helland's blackbody-to-RGB
approximation**, not in `packages/shared`. The shared engine's contract
ends at `T_kelvin` — do not add an RGB function to `packages/shared`.

---

## 3. Local Sky Dome (Ground Truth Sky Anchor)

Julian day offset:

```
d_UT1 = JD - 2451545.0
```

Local Sidereal Time (degrees; lon_east positive):

```
LST_deg = (280.4606 + 360.9857 * d_UT1 + lon_east) mod 360
```

Hour angle:

```
H = LST - RA            # (in matching units; convert to radians for trig)
```

Altitude / azimuth (φ = observer latitude):

```
sin(alt) = sin(dec)*sin(φ) + cos(dec)*cos(φ)*cos(H)

az = atan2( -cos(dec)*sin(H),
             sin(dec)*cos(φ) - cos(dec)*sin(φ)*cos(H) )
```

---

## 4. Sun Position

Use **Meeus low-precision** solar position (accuracy ≥ 0.01°). Outputs the Sun's RA/Dec and, via §3, its altitude for the observer.

Twilight decisions (Sun elevation for the observer):

```
ISS / aurora usable   when  sun_alt < TWILIGHT_ISS_AURORA   (-6°)
faint-star realism    when  sun_alt < TWILIGHT_STARS        (-18°)
```

---

## 5. Satellite / ISS Visible Pass

satellite.js gives ECI position/velocity; derive look-angles (elevation, azimuth, range) for the observer.

**A pass is "visible" only if ALL three hold:**

```
1) elevation >= 10°
2) sun_alt_observer < -6°                         (observer in darkness, §4)
3) satellite is sunlit:
      let  s_hat = unit vector toward Sun
      let  r     = satellite geocentric position vector
      in_shadow = (dot(r, s_hat) < 0)  AND
                  ( | r - dot(r, s_hat) * s_hat | < R_EARTH )
      sunlit    = NOT in_shadow
```

---

## 6. CME Arrival — Drag-Based Model (Vršnak 2013)

Analytic DBM. Inputs:

```
v0    = CME initial speed        (km/s, from DONKI)
w     = ambient solar wind speed (km/s, from SWPC; default 400 if missing)
gamma = 0.5e-7                   (km^-1, drag parameter)
r0    = 21.5 * R_SUN             (km, DONKI inner boundary)
sign  = +1 if v0 > w else -1     (decel if faster than wind, else accel)
```

Position over time:

```
r(t) - r0 = (1/gamma) * sign * ln( 1 + sign * gamma * (v0 - w) * t )
            + w * t
```

Solve `r(t) = 1 AU` for `t` by **bisection** (r is monotonic in t) → arrival time.

**Arrival uncertainty:** propagate ±error in `v0` through the same solve → produces the ±Δt arrival window.

---

## 7. Aurora Visibility

Geomagnetic latitude (dipole approximation; φ, lon in radians; pole from §0):

```
sin(λ_m) = sin(φ)*sin(φ_p) + cos(φ)*cos(φ_p)*cos(θ - θ_p)
```

where `(φ_p, θ_p)` = geomagnetic pole lat/lon, `(φ, θ)` = observer lat/lon.

Equatorward auroral-oval boundary (geomagnetic latitude, degrees):

```
λ_b = 66 - 2 * Kp
```

Horizon-view margin (aurora at ~110 km is visible low on the horizon from further south):

```
margin_deg = 4
```

**User can see aurora if:**

```
|λ_m| >= λ_b - margin_deg
```

Strength cue:

```
strength = |λ_m| - (λ_b - margin_deg)     # larger = better placed
```

**Kp source:** primary = SWPC 3-day forecast Kp (`Kp_predicted`). The CME-derived Kp (§8) is used **only** for the agreement factor, never as the primary.

---

## 8. Causal Engine — Confidence

Three factors, **multiplicative**. All produce values in (0, 1].

Lead-time factor (`t_remaining` = hours until predicted arrival):

```
tau     = 24                                  # hours
f_lead  = 0.3 + 0.7 * exp(-t_remaining / tau)
```

Source-agreement factor:

```
sigma   = 2
f_agree = exp( -|Kp_cme - Kp_swpc| / sigma )
```

History factor (Beta posterior mean; `hits`, `trials` from the accuracy loop):

```
f_hist  = (hits + 2) / (trials + 4)
```

Final confidence and bands:

```
C = f_lead * f_agree * f_hist

C > 0.66          -> "high"
0.33 <= C <= 0.66 -> "moderate"
C < 0.33          -> "low"
```

CME-speed → Kp heuristic (used **only** for `Kp_cme` in the agreement factor):

```
Kp_cme = clamp( round( 1.5 + 2.3 * log10(v0 / 400) ), 0, 9 )
```

---

## 9. Accuracy Loop

For each stored prediction, once its `target_time` has elapsed, fetch observed Kp and score:

```
hit = ( |predicted_kp - actual_kp| <= 1 )
```

Rolling `hits` / `trials` feed §8's `f_hist`. Start from the Beta prior (the +2 / +4 in `f_hist`), so early predictions get a neutral, honest prior rather than overconfident 0% or 100%.

---

## 10. Near-Earth Objects

Diameter from absolute magnitude H (assumed albedo 0.14):

```
D_km = (1329 / sqrt(0.14)) * 10 ^ (-0.2 * H)
```

Miss distance in lunar distances:

```
miss_LD = miss_distance_km / LD
```

---

## 11. Best-Spot Score

Each factor in [0, 1]; **multiplicative** so any zero kills the site.

```
clarity  = 1 - cloud_fraction                 # Open-Meteo
darkness = (9 - bortle) / 8                    # Bortle 1 (dark) → 1.0, Bortle 9 → 0
travel   = exp( -distance_km / 50 )            # decays with travel distance

score    = clarity * darkness * travel
```

For aurora nights, multiply by the aurora-visibility factor (from §7 `strength`, normalized to [0,1]):

```
score_aurora = score * aurora_factor
```

**Aurora-strength normalization (resolved 2026-07-15):**

```
AURORA_STRENGTH_SATURATION_DEG = 20
aurora_factor = clamp(strength_deg / 20, 0, 1)
```

Rationale: 20° of margin inside the auroral oval boundary (§7)
comfortably represents "deep in the oval, excellent view"; 0° is exactly
at the visibility threshold. `aurora_factor` is only meaningful when
`strength_deg >= 0` (i.e., §7's `canSeeAurora` is true). **When aurora is
not visible, do not compute `score_aurora` at all** — use plain `score`
(clarity × darkness × travel). Passing a clamped-to-0 factor into
`score_aurora` would incorrectly zero out an otherwise-good site; the
aurora factor should only ever multiply in when it's actually relevant
to that night's ranking, not as a universal fourth term.

Rank candidate sites by `score` (or `score_aurora`, on aurora nights);
recommend the maximum.

---

## Implementation Notes (binding)

- **Inject `now`.** No engine reads the system clock directly — the current time is always a parameter, so tests are deterministic.
- **Units at boundaries.** Convert degrees↔radians explicitly at function edges; keep internals in radians.
- **Clamp where stated.** Brightness [0,1], Kp [0,9], factors (0,1]. Never emit out-of-range values.
- **Monotonic solves use bisection** (§6), not Newton — no derivative fragility, guaranteed convergence on a bracketed monotonic function.
- **Edge cases are required tests** (Phase 2): negative parallax, Kp = 0 and 9, v0 ≤ w vs v0 > w, cloud_fraction = 0 and 1, observer at/near the geomagnetic pole, arrival window crossing tests.
