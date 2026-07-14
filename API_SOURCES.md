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

| Source | Limit | Our central usage | Headroom |
|---|---|---|---|
| N2YO | 1000 req/hr | ISS at fast tier ≈ 60–120/hr | ~10x under |
| NASA (DONKI/NeoWs, shared key) | ~1000 req/hr (data.gov key) | slow tier, a handful/hr | massive |
| NOAA SWPC | keyless, no hard limit (be polite) | fast + slow tiers | fine |
| Open-Meteo | keyless, ~10k/day fair-use | on-demand per Best-Spot query + light caching | fine |
| CelesTrak | keyless, cache-encouraged | slow tier, cached | fine |
| JPL Horizons | keyless | slow tier | fine |

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
- **Endpoint:** `https://services.swpc.noaa.gov/...` (JSON products).
- **Key:** none (keyless, no registration).
- **Rate limit:** none published — poll politely, cache between ticks.
- **Fallback:** use last cached value with an aged freshness stamp; if never fetched this session, space-weather card shows "unavailable" and aurora confidence drops (no live Kp → engine leans on forecast only).

---

## Slow Tier (poll every 5–15 min)

### NOAA SWPC — 3-day forecast & OVATION oval
- **Powers:** `Kp_predicted` (primary Kp for aurora, `FORMULAS.md` §7), auroral oval overlay (Auroral Ring).
- **Endpoint:** `https://services.swpc.noaa.gov/...` (forecast + OVATION products).
- **Key:** none. **Rate limit:** none published.
- **Fallback:** if forecast missing, fall back to latest real-time Kp as a proxy and lower confidence; if OVATION missing, render the ring from the Kp→boundary formula (§7) instead of the live oval.

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
- **Source:** David Lorenz Light Pollution Atlas / VIIRS Black Marble (NASA, CC0).
- **Access:** download once, preprocess, self-host. No live dependency.
- **Fallback:** none needed — local data, always available.

### Bright-star catalog
- **Powers:** the real night-sky backdrop and Ground Truth Sky Anchor.
- **Source:** Yale Bright Star Catalog / Hipparcos subset (public domain; a few thousand stars, right-sized — no full Gaia pipeline).
- **Access:** preprocess to a binary `Float32Array`, host on GitHub → jsDelivr CDN.
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
