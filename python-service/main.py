"""
ASTRA-NET Python Orbit Service (Astra-Kaksha)
Provides:
- /propagate     — Propagate a single TLE to XYZ coords at given time
- /propagate/batch — Propagate multiple TLEs (up to 100 at a time)
- /conjunction   — Simple conjunction risk detector across a set of TLEs
- /visibility    — Check ISS pass over a ground location
- /health        — Healthcheck
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import math
import datetime
import httpx
from sgp4.api import Satrec, jday
from sgp4.api import SGP4_ERRORS

app = FastAPI(title="ASTRA-NET Orbit Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────
#  MODELS
# ─────────────────────────────────────────────────────────────────

class TLEInput(BaseModel):
    name: str
    tle1: str
    tle2: str

class PropagateRequest(BaseModel):
    tle1: str
    tle2: str
    timestamp: Optional[str] = None  # ISO8601, defaults to now

class BatchPropagateRequest(BaseModel):
    satellites: List[TLEInput]
    timestamp: Optional[str] = None

class ConjunctionRequest(BaseModel):
    satellites: List[TLEInput]
    threshold_km: float = 5.0   # Flag if two sats come within this distance
    timestamp: Optional[str] = None

class VisibilityRequest(BaseModel):
    tle1: str
    tle2: str
    lat: float
    lon: float
    minutes_ahead: int = 90


# ─────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────

def parse_time(ts_str: Optional[str]) -> datetime.datetime:
    if ts_str:
        return datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    return datetime.datetime.now(datetime.timezone.utc)


def propagate_tle(tle1: str, tle2: str, dt: datetime.datetime):
    """Propagate a TLE to a given datetime, return (x, y, z) km in TEME frame."""
    try:
        satellite = Satrec.twoline2rv(tle1, tle2)
        jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)
        e, r, v = satellite.sgp4(jd, fr)
        if e != 0:
            return None, None, str(SGP4_ERRORS[e])
        return r, v, None
    except Exception as ex:
        return None, None, str(ex)


def teme_to_latlon(r, dt: datetime.datetime):
    """Very rough TEME → geographic lat/lon (ignores polar/oblate corrections)."""
    x, y, z = r
    radius = math.sqrt(x*x + y*y + z*z)
    lat = math.degrees(math.asin(z / radius))

    # Greenwich Sidereal Angle (approximate)
    gst_rad = _gst(dt)
    lon = (math.degrees(math.atan2(y, x)) - math.degrees(gst_rad)) % 360
    if lon > 180:
        lon -= 360
    alt = radius - 6371.0  # approximate altitude km
    return lat, lon, alt


def _gst(dt: datetime.datetime) -> float:
    """Approximate Greenwich Sidereal Time in radians."""
    j2000 = datetime.datetime(2000, 1, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)
    d = (dt - j2000).total_seconds() / 86400.0
    theta = (280.46061837 + 360.98564736629 * d) % 360
    return math.radians(theta)


def distance_km(r1, r2):
    return math.sqrt(sum((a - b)**2 for a, b in zip(r1, r2)))


# ─────────────────────────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "astra-kaksha-orbit"}


@app.post("/propagate")
def propagate(req: PropagateRequest):
    dt = parse_time(req.timestamp)
    r, v, err = propagate_tle(req.tle1, req.tle2, dt)
    if err:
        raise HTTPException(status_code=400, detail=f"SGP4 error: {err}")

    lat, lon, alt = teme_to_latlon(r, dt)
    return {
        "timestamp": dt.isoformat(),
        "position_teme_km": {"x": r[0], "y": r[1], "z": r[2]},
        "velocity_km_s":    {"vx": v[0], "vy": v[1], "vz": v[2]},
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "altitude_km": round(alt, 2),
    }


@app.post("/propagate/batch")
def propagate_batch(req: BatchPropagateRequest):
    dt = parse_time(req.timestamp)
    results = []
    for sat in req.satellites[:100]:   # Safety cap
        r, v, err = propagate_tle(sat.tle1, sat.tle2, dt)
        if err or r is None:
            results.append({"name": sat.name, "error": err})
            continue
        lat, lon, alt = teme_to_latlon(r, dt)
        results.append({
            "name": sat.name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "altitude_km": round(alt, 2),
            "position_teme_km": {"x": round(r[0], 3), "y": round(r[1], 3), "z": round(r[2], 3)},
        })
    return {"timestamp": dt.isoformat(), "count": len(results), "satellites": results}


@app.post("/conjunction")
def conjunction_check(req: ConjunctionRequest):
    """Brute-force O(n^2) conjunction check for up to 200 sats."""
    dt = parse_time(req.timestamp)
    threshold = req.threshold_km

    positions = []
    for sat in req.satellites[:200]:
        r, _, err = propagate_tle(sat.tle1, sat.tle2, dt)
        if err or r is None:
            continue
        lat, lon, alt = teme_to_latlon(r, dt)
        positions.append({"name": sat.name, "r": r, "lat": lat, "lon": lon, "alt": alt})

    conjunctions = []
    for i in range(len(positions)):
        for j in range(i + 1, len(positions)):
            d = distance_km(positions[i]["r"], positions[j]["r"])
            if d <= threshold:
                prob = max(0.0, 1.0 - (d / threshold))
                risk = "LOW"
                if d < 1.0: risk = "CRITICAL"
                elif d < 2.0: risk = "HIGH"
                elif d < threshold: risk = "MEDIUM"
                conjunctions.append({
                    "primary":   positions[i]["name"],
                    "secondary": positions[j]["name"],
                    "distance_km": round(d, 4),
                    "probability": round(prob, 4),
                    "risk": risk,
                })

    # Sort by distance (closest first)
    conjunctions.sort(key=lambda c: c["distance_km"])

    return {
        "timestamp": dt.isoformat(),
        "threshold_km": threshold,
        "tracked": len(positions),
        "conjunctions": conjunctions[:50],  # top 50 closest approaches
        "critical_count": sum(1 for c in conjunctions if c["risk"] == "CRITICAL"),
        "high_count": sum(1 for c in conjunctions if c["risk"] == "HIGH"),
    }


@app.post("/visibility")
def iss_visibility(req: VisibilityRequest):
    """Check when the satellite passes near a ground location in the next N minutes."""
    step_seconds = 60
    dt_start = parse_time(None)
    passes = []

    lat_rad = math.radians(req.lat)
    lon_rad = math.radians(req.lon)
    EARTH_R = 6371.0

    for step in range(req.minutes_ahead):
        dt = dt_start + datetime.timedelta(seconds=step * step_seconds)
        r, _, err = propagate_tle(req.tle1, req.tle2, dt)
        if err or r is None:
            continue
        sat_lat, sat_lon, sat_alt = teme_to_latlon(r, dt)

        # Angular separation
        dlon = math.radians(sat_lon - req.lon)
        dlat = math.radians(sat_lat - req.lat)
        a = math.sin(dlat/2)**2 + math.cos(lat_rad)*math.cos(math.radians(sat_lat))*math.sin(dlon/2)**2
        ground_dist = 2 * EARTH_R * math.asin(math.sqrt(a))

        max_range = math.sqrt(sat_alt * (sat_alt + 2 * EARTH_R))
        if ground_dist <= max_range * 0.5:
            el = math.degrees(math.atan2(sat_alt, ground_dist))
            if el > 10:  # elevation > 10° = visible
                passes.append({"time": dt.isoformat(), "elevation_deg": round(el, 1), "altitude_km": round(sat_alt, 1)})

    if not passes:
        return {"message": "No visible passes in the next window.", "passes": []}

    return {"ground_lat": req.lat, "ground_lon": req.lon, "passes": passes}
