# ASTRANET — External Data Sources

Reference for every external API and dataset. All are free. For each: what it powers, base endpoint, key requirement, rate limit, poll tier (from `ARCHITECTURE.md` §4), and the **fallback** when it's unavailable (from the degradation contract, `ARCHITECTURE.md` §5).

**Binding rules:**

- Every response is validated with **Zod** at the boundary before use (Phase 1). Never trust upstream shape.
- Polling is **central** — one poller hits each source and fans results to all users via the in-memory store + SSE. Upstream load is constant regardless of user count, which is what keeps every limit below comfortably satisfied.
- Every client implements timeout + retry-with-backoff and returns its documented fallback on failure — it must never throw up the stack.
- Log all `429`s; if any source ever approaches its limit, raise its poll interval, don't add keys.

---

## Rate-Budget Summary

Because polling is central and shared, real usage is roughly **(one call per source per poll interval)**, not per-user. Sanity check against the tightest limits:

| Source                         | Limit                              | Our central usage                             | Headroom   |
| ------------------------------ | ---------------------------------- | --------------------------------------------- | ---------- |
| N2YO                           | 1000 req/hr                        | ISS at fast tier ≈ 60–120/hr                  | ~10x under |
| NASA (DONKI/NeoWs, shared key) | ~1000 req/hr (data.gov key)        | slow tier, a handful/hr                       | massive    |
| NOAA SWPC                      | keyless, no hard limit (be polite) | fast + slow tiers                             | fine       |
| Open-Meteo                     | keyless, ~10k/day fair-use         | on-demand per Best-Spot query + light caching | fine       |
| CelesTrak                      | keyless, cache-encouraged          | slow tier, cached                             | fine       |
| JPL Horizons                   | keyless                            | slow tier                                     | fine       |

---

## Fast Tier (poll every 30–60s)

### N2YO — ISS & visual satellite passes

- **Powers:** live ISS position, visible-pass predictions (Explained Passes, overfly alerts).
- **Endpoint:** `https://api.n2yo.com/rest/v1/satellite/...`
- **Key:** required (free; register at n2yo.com, generate in profile). Store in `.env`.
- **Rate limit:** **1000 transactions/hour.** Comfortable at fast tier centrally.
- **Fallback:** if down, ISS card shows "position unavailable"; fall back to client-side `satellite.js` propagation from the last known TLE (CelesTrak) so the 3D scene still moves. Pass predictions degrade to "unavailable."

### NOAA SWPC — solar wind & Kp (real-time)

- **Powers:** current Kp-index, solar wind speed/density (Heliosphere Pulse, aurora odds input, Causal Engine).
- **Key:** none (keyless, no registration). **Rate limit:** none published — poll politely.
- **Confirmed live endpoints** (verified 2026-07-15; see DECISIONS.md for correction rationale):
  - `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json` — 1-min estimated Kp; array of `{time_tag, kp_index, estimated_kp, kp}`.
  - `https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json` — 1-min RTSW plasma (speed, density, temp); array of objects; `active: true` marks the primary source.
- **Fallback:** use last cached value with an aged freshness stamp; if never fetched this session, space-weather card shows "unavailable" and aurora confidence drops (no live Kp → engine leans on forecast only).

---

## Slow Tier (poll every 5–15 min)

### NOAA SWPC — 3-day forecast & propagated solar wind

- **Powers:** `Kp_predicted` (primary Kp for aurora, `FORMULAS.md` §7), solar wind speed/Bz for the Causal Engine, auroral oval overlay (Auroral Ring).
- **Key:** none. **Rate limit:** none published.
- **Confirmed live endpoints:**
  - `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` — 3-hour observed Kp, 7-day history; array of `{time_tag, Kp, a_running, station_count}`.
  - `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` — 3-day forecast; array of `{time_tag, kp, observed, noaa_scale}`; `observed` is `"observed"|"estimated"|"predicted"`.
  - `https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json` — propagated solar wind (speed, density, Bz, Bt); **tuple array** where row 0 is the header string array.
- **Fallback:** if forecast missing, fall back to latest real-time Kp as a proxy and lower confidence; if solar wind missing, Heliosphere Pulse shows "unavailable".

### NASA DONKI — CME & solar flares

- **Powers:** CME events feeding the Drag-Based arrival model (`FORMULAS.md` §6) and the cross-domain causal chain.
- **Endpoint:** `https://api.nasa.gov/DONKI/...`
- **Key:** NASA API key (free from api.nasa.gov; single key shared across DONKI + NeoWs).
- **Rate limit:** data.gov-style, ~1000 req/hr on a keyed plan — trivial at slow tier.
- **Fallback:** if down, no new CME predictions are generated; existing in-flight predictions continue. Causal card notes "no new solar events detected" vs. falsely implying calm.

### NASA NeoWs — near-Earth objects

- **Powers:** Threat Horizon (close approaches, diameter/miss-distance, `FORMULAS.md` §10).
- **Endpoint:** `https://api.nasa.gov/neo/rest/v1/...`
- **Key:** same NASA API key. **Rate limit:** ~1000 req/hr.
- **Fallback:** NEO card shows "unavailable"; never blocks the Brief.

### CelesTrak — satellite TLE/OMM

- **Powers:** orbital elements for all satellites/constellations; ISS fallback propagation.
- **Endpoint:** `https://celestrak.org/NORAD/elements/...` (JSON/OMM/TLE).
- **Key:** none. **Rate limit:** none published — caching explicitly encouraged; TLEs change slowly, cache aggressively.
- **Fallback:** use last cached TLE set (valid for hours/days); only if never fetched does satellite rendering degrade.

### JPL Horizons — planetary & solar-system positions

- **Powers:** true current positions of Sun, planets, probes (solar-system scene, Sun position for twilight §4).
- **Endpoint:** `https://ssd.jpl.nasa.gov/api/horizons.api`
- **Key:** none. **Rate limit:** none published — positions change slowly, cache long.
- **Fallback:** positions are highly cacheable (ephemerides are predictable); serve last computed set. Effectively never user-visible-down.

### NASA GIBS — Earth imagery

- **Powers:** live Earth texture / cloud imagery (Sentinels' Gaze, globe surface).
- **Endpoint:** `https://gibs.earthdata.nasa.gov/wmts/...` (WMTS tiles).
- **Key:** none. **Rate limit:** tile-server, generous.
- **Fallback:** fall back to a static high-res Earth texture from the CDN; scene never breaks.

### Open-Meteo — cloud cover

- **Powers:** clarity factor in Best-Spot score (`FORMULAS.md` §11).
- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Key:** none at all. **Rate limit:** ~10k calls/day fair-use.
- **Fallback:** fetched on-demand per Best-Spot query (not central-polled), lightly cached per grid cell; if down, Best-Spot shows "cloud data unavailable" and ranks on darkness + travel only, flagged as reduced confidence.

---

## Static Datasets (ingest once, self-host)

### Light-pollution atlas (Bortle)

- **Powers:** darkness factor in Best-Spot score (`FORMULAS.md` §11).
- **Source:** NASA Black Marble 2016 "Earth at Night" composite, `01deg` variant (`BlackMarble_2016_01deg.jpg`, 3600x1800, already at 0.1° resolution — no resize needed): `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg`.
- **Access:** download once, map luma → Bortle 1-9 via a fixed threshold table, self-host as `bortle-grid.bin` (`Uint8Array` of size 3600x1800 mapped directly to Bortle 1-9). No live dependency.
- **Important caveat:** this is a **rendered poster-image JPEG**, not calibrated VIIRS radiance data — Black Marble's science-grade GeoTIFF/HDF5 radiance products aren't JPEG-decodable by the ingestion tooling (Jimp). Bortle values are therefore a **luma-approximation**, not a physically calibrated light-pollution measurement. Good enough for relative darkness ranking in Best-Spot scoring, not for scientific radiance claims.
- **Fallback:** none needed — local data, always available.

### Bright-star catalog

- **Powers:** the real night-sky backdrop and Ground Truth Sky Anchor.
- **Source:** HYG Database (Hipparcos + Yale + Gliese), `hygdata_v41.csv`, filtered to `vmag <= 6.5`. Archived GitHub repo; raw CSV still served from `main`: `https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv`.
- **Access:** preprocess to a binary `Float32Array` containing raw `[ra_deg, dec_deg, dist_pc, vmag, colorIndex]` per star. `dist_pc` comes directly from HYG's `dist` column (already in parsecs, not inverted from parallax); bad/missing-parallax stars are HYG's own 100000 pc (100 kpc) sentinel, passed through unfiltered — this matches `FORMULAS.md` §1's "pin bad parallax to a 100 kpc shell" convention exactly. `colorIndex` is HYG's `ci` column (B-V directly, not Gaia bp_rp). No rows are dropped. Hosted as `stars.bin` on GitHub → jsDelivr CDN. Coordinate transforms to x/y/z and color mappings are done at runtime by the pure Math Engine.
- **Fallback:** static local asset — the highest-priority card in the degradation contract precisely because it never depends on a live source.

---

## Keys Needed (for `.env.example`)

```
NASA_API_KEY=        # api.nasa.gov — powers DONKI + NeoWs
N2YO_API_KEY=        # n2yo.com profile — powers ISS + passes
# NOAA SWPC, Open-Meteo, CelesTrak, JPL Horizons, GIBS = keyless
```

---

## Degradation Priority (recap from ARCHITECTURE §5)

```
Sky Anchor (static star catalog)   ← never fails, always renders
   > ISS (N2YO, satellite.js fallback)
      > space weather (SWPC)
         > NEO / imagery (NeoWs / GIBS)
```

The Brief renders if **any** card resolves. A single source failing blanks only its own card.
