<div align="center">

<img src="https://img.shields.io/badge/Status-Active%20Development-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" />
<img src="https://img.shields.io/badge/Platform-Unified%20Threat%20Intelligence-ff6b35?style=for-the-badge" />
<img src="https://img.shields.io/badge/Focus-Space%20%2B%20Earth%20Monitoring-1f6feb?style=for-the-badge" />
<img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Processing-Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/API-Express.js-404D59?style=for-the-badge&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/UI-Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/Time--Series-TimescaleDB-FDB515?style=for-the-badge" />
<img src="https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
<img src="https://img.shields.io/badge/Cache-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
<img src="https://img.shields.io/badge/Solar-NASA%20DONKI%20%2B%20NOAA-orange?style=for-the-badge" />
<img src="https://img.shields.io/badge/Earth-NASA%20FIRMS%20%2B%20GPM-2ea043?style=for-the-badge" />
<img src="https://img.shields.io/badge/Orbital-CelesTrak%20%2B%20SGP4-8b5cf6?style=for-the-badge" />
<img src="https://img.shields.io/badge/Realtime-Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" />
<img src="https://img.shields.io/badge/Visualization-Three.js%20%2B%20Cesium-111111?style=for-the-badge&logo=threedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/Maps-Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
<img src="https://img.shields.io/badge/Charts-Recharts-FF6384?style=for-the-badge" />
<img src="https://img.shields.io/badge/AI-Claude%20Mission%20Briefings-d97706?style=for-the-badge" />
<img src="https://img.shields.io/badge/Deployment-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />

# AstraNET

### Unified Space and Earth Intelligence Platform

AstraNET is a high-performance intelligence platform for concurrent monitoring
of terrestrial, solar, and orbital environments. It ingests, correlates,
processes, and visualizes large-scale datasets from agencies such as NASA,
NOAA, and CelesTrak to deliver actionable situational awareness for
planetary health, space weather, and orbital risk intelligence. [file:53]

[Report Bug](https://github.com/nikhilvirdi/ASTRA-NET/issues) · [Request Feature](https://github.com/nikhilvirdi/ASTRA-NET/issues) · [Documentation](#documentation)

</div>

---

## Table of Contents

- [The Problem](#the-problem)
- [What is AstraNET](#what-is-astranet)
- [Core Modules](#core-modules)
- [Features](#features)
- [Unified Threat Score](#unified-threat-score)
- [How It Stands Out](#how-it-stands-out)
- [Tech Stack](#tech-stack)
- [Documentation](#documentation)
- [License](#license)

---

## The Problem

India faces three major categories of planetary-scale threats at the same
time: solar space weather events, near-Earth orbital hazards, and terrestrial
disasters such as fires, floods, and heatwaves. The data for these threats
already exists across multiple public sources, but it is fragmented,
specialist-heavy, and operationally disconnected. [file:53]

The core problem is not data scarcity. It is the absence of a unified,
correlated, and actionable intelligence layer that can translate raw
scientific feeds into decisions that agencies can act on immediately. No
existing platform combines these domains into one operational view or surfaces
compound risk scenarios across them in real time. [file:53]

AstraNET is built to solve that.

---

## What is AstraNET

AstraNET, the Advanced Space Threat Response and Analysis Network, is a
unified planetary threat monitoring and decision intelligence platform built
specifically for India. It aggregates solar, orbital, and terrestrial hazard
signals into one mission-control style platform, computes a Unified Threat
Score, identifies compound risk conditions, and generates AI-powered plain-
English operational briefings. [file:53]

The platform is designed for operational users such as ISRO, NDMA, NDRF,
aviation authorities, power grid operators, telecom infrastructure teams, and
research institutions that need faster, clearer, and more geographically
relevant intelligence than fragmented monitoring tools can provide. [file:53]

---

## Core Modules

### Aditya — Solar Intelligence
The Aditya module tracks heliophysics activity that can affect Earth’s
magnetosphere and critical infrastructure. It monitors solar wind, Kp index,
Bz component, solar flares, and Coronal Mass Ejections, while estimating
downstream operational effects on Indian systems. [file:53]

### Bhumi — Terrestrial Intelligence
The Bhumi module focuses on Earth observation and environmental risk
assessment. It ingests NASA FIRMS fire data, GPM precipitation and flood
signals, NDVI-based land stress indicators, heatwave conditions, and seismic
events to produce India-focused hazard intelligence. [file:53]

### Kaksha — Orbital Intelligence
The Kaksha module handles space situational awareness by ingesting TLE data,
propagating satellite positions with SGP4, tracking ISRO assets, and
identifying possible conjunction and collision-risk scenarios in orbit. [file:53]

---

## Features

### Unified Mission Control
- Single-screen dashboard combining all three domains simultaneously. [file:53]
- Prominent Unified Threat Score with domain-level sub-scores. [file:53]
- AI mission brief panel written for operators, not scientists. [file:53]
- India-centric threat overlays and infrastructure impact visibility. [file:53]

### Cross-Domain Correlation
- Detects compound risk when multiple domains are simultaneously elevated. [file:53]
- Surfaces scenarios that isolated monitoring tools cannot identify. [file:53]
- Elevates decision-making from reactive to predictive and preventive. [file:53]

### Solar Intelligence
- Solar flare and CME monitoring through NASA and NOAA sources. [file:53]
- Real-time Kp index and solar wind condition tracking. [file:53]
- CME arrival estimation and downstream infrastructure relevance. [file:53]

### Earth Hazard Intelligence
- Fire hotspot detection through NASA FIRMS. [file:53]
- Flood and precipitation anomaly analysis through NASA GPM. [file:53]
- Heatwave, landslide, and seismic context for India-focused risk tracking. [file:53]

### Orbital Intelligence
- Continuous TLE ingestion from CelesTrak. [file:53]
- SGP4-based orbital propagation and pass prediction. [file:53]
- ISRO watchlist support and conjunction warning analysis. [file:53]

### Operational Intelligence Layer
- AI-generated situational briefings using structured context objects. [file:53]
- Infrastructure overlays for airports, substations, telecom towers, and ground stations. [file:53]
- Time-series storage for incident history, trend analysis, and institutional memory. [file:53]
- Alert subscriptions via thresholds, threat types, and regions. [file:53]

---

## Unified Threat Score

The Unified Threat Score, or UTS, is AstraNET’s core risk metric. It converts
multi-domain complexity into a single score from 0 to 100 by combining solar,
terrestrial, and orbital sub-scores with weighted logic and a cascade
multiplier when multiple domains are elevated simultaneously. [file:53]

The documented weighting gives 35 percent to Aditya, 40 percent to Bhumi, and
25 percent to Kaksha, then applies a multiplier when two or three domains
cross elevated thresholds together. This is what allows AstraNET to recognize
compound planetary risk rather than treating each domain in isolation. [file:53]

### Alert Bands
- **Nominal:** 0–20 [file:53]
- **Elevated:** 21–40 [file:53]
- **Advisory:** 41–60 [file:53]
- **Warning:** 61–80 [file:53]
- **Critical:** 81–100 [file:53]

---

## How It Stands Out

AstraNET is not just a visualization layer over public APIs. It is designed
as a decision intelligence platform that correlates heterogeneous scientific
signals, translates them into operationally useful scores and briefings, and
ties them directly to India-specific geography and infrastructure exposure. [file:53]

Compared with single-domain tools such as NOAA SWPC, NASA FIRMS, CelesTrak,
or IMD portals, AstraNET’s advantage is the unified dashboard, cross-domain
correlation engine, AI briefing layer, infrastructure overlays, and
TimescaleDB-backed long-term incident memory. That combination is the actual
product differentiation. [file:53]

---

## Tech Stack

| Category | Technologies |
|---|---|
| Languages | TypeScript, Python, JavaScript [file:53] |
| Backend | Node.js 20, Express, TypeScript, Socket.io, node-cron, Axios, Zod, Winston [file:53] |
| Python Service | Python 3.11, FastAPI, Uvicorn, Pydantic, sgp4, skyfield [file:53] |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4, React Router DOM [file:53] |
| State and Data | Zustand, TanStack Query, Axios, Socket.io Client [file:53] |
| Visualization | Three.js, CesiumJS, Leaflet, React-Leaflet, Recharts, Turf.js [file:53] |
| Fonts | Orbitron, Rajdhani, JetBrains Mono [file:53] |
| Database | PostgreSQL 15, TimescaleDB, Prisma [file:53] |
| Cache | Redis 7, Upstash [file:53] |
| AI | Claude Sonnet for mission brief generation [file:53] |
| Data Sources | NASA DONKI, NOAA SWPC, NOAA DSCOVR, NASA FIRMS, NASA GPM, USGS, CelesTrak, Space-Track, OSM Overpass [file:53] |
| DevOps | Docker, Docker Compose, Vercel, Railway, Render, Supabase [file:53] |

---

## Documentation

| Document | Description |
|---|---|
| `PROJECT-DOCS.md` | Full product, architecture, scoring, modules, infrastructure, and roadmap documentation. [file:53] |
| `README.md` | Public project overview and feature summary. |
| `ARCHITECTURE.md` | System components, data flow, correlation engine, and module boundaries. |
| `THREAT-SCORE.md` | Unified Threat Score design and cascade multiplier logic. |
| `DATA-SOURCES.md` | External APIs, ingestion sources, and refresh strategy. |

---

## License

Copyright (c) 2025 Nikhil Virdi. All rights reserved.

This project and its source code are proprietary. No part of this codebase
may be copied, modified, distributed, or used in any form without explicit
written permission from the author.

---

<div align="center">

Built for planetary awareness. Designed for India-first operational intelligence.

**AstraNET** — One platform for solar, terrestrial, and orbital risk.

</div>
