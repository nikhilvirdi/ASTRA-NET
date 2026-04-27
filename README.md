# AstraNET: Unified Space and Earth Intelligence Platform

![System](https://img.shields.io/badge/AstraNET-Core_Engine-blue?style=for-the-badge)
![Tech](https://img.shields.io/badge/Stack-TypeScript_%7C_Python_%7C_PostgreSQL-green?style=for-the-badge)
![Architecture](https://img.shields.io/badge/Pattern-Microservices_Monorepo-orange?style=for-the-badge)

## Overview

AstraNET is a high-performance intelligence platform designed for the concurrent monitoring of terrestrial, solar, and orbital environments. It serves as a centralized hub for ingesting, processing, and visualizing complex datasets sourced from NASA, NOAA, and CelesTrak. The platform is engineered to handle massive time-series data streams, providing actionable insights into planetary health and space situational awareness.

---

## Key Features

*   **Multi-Source Data Ingestion:** Automated pipelines for real-time data retrieval from international space and environmental agencies.
*   **Time-Series Optimization:** Leverages TimescaleDB hypertables for ultra-fast querying of historical and real-time sensor data.
*   **Hybrid Processing Engine:** A dual-stack backend (Node.js for orchestration and Python for heavy mathematical analysis).
*   **Real-Time Propagation:** Orbital path prediction and satellite tracking using TLE (Two-Line Element) data.
*   **Environmental Anomaly Detection:** Monitoring of terrestrial thermal events and solar weather fluctuations.

---

## The Three Core Modules

### 1. Aditya (Solar Intelligence)
The Aditya module monitors heliophysics events that impact Earth's magnetosphere and technological infrastructure.
*   **Solar Wind Monitoring:** Tracking velocity and density of solar particles.
*   **Geomagnetic Storm Tracking:** Real-time analysis of the Kp-index and Bz component of the Interplanetary Magnetic Field (IMF).
*   **Event Logging:** Historical tracking of X-Ray flares and Coronal Mass Ejections (CMEs).

### 2. Bhumi (Terrestrial Intelligence)
The Bhumi module focuses on planetary observation and environmental risk assessment.
*   **Thermal Anomaly Tracking:** Integration with NASA FIRMS data to monitor global fire activity.
*   **Atmospheric Analysis:** Monitoring precipitation and environmental changes through GPM (Global Precipitation Measurement) data.
*   **Geospatial Visualization:** Mapping terrestrial events onto high-fidelity frontend interfaces.

### 3. Kaksha (Orbital Intelligence)
The Kaksha module provides Space Situational Awareness (SSA) by tracking orbital assets and debris.
*   **Satellite Propagation:** Using SGP4 algorithms to predict current and future positions of satellites.
*   **Orbital Data Ingestion:** Automated updates from CelesTrak to ensure satellite telemetry is always current.
*   **Collision Avoidance Intelligence:** Tracking orbital paths to identify potential conjunction events.

---

## Technical Architecture

### Backend Infrastructure
*   **Node.js & TypeScript:** Powering the primary API Gateway, service orchestration, and client communication.
*   **Python Engine:** A specialized microservice for heavy data processing, including solar propagation math and terrestrial data normalization.
*   **Prisma ORM:** Providing a type-safe interface for all database operations with automated schema migrations.

### Data Persistence
*   **PostgreSQL + TimescaleDB:** The primary database, optimized specifically for time-series data. 
*   **Hypertables:** Used to store high-velocity data points from solar sensors and satellite trackers, ensuring query performance remains constant even with millions of rows.

### Frontend Visualization (In Development)
*   **React & Vite:** Providing a lightning-fast UI for data visualization.
*   **Tailwind CSS:** A custom-designed, premium UI system for a mission-control aesthetic.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Languages** | TypeScript, Python, JavaScript |
| **Backend Framework** | Express.js |
| **Data Science** | NumPy, Pandas, Matplotlib |
| **Database** | PostgreSQL, TimescaleDB |
| **ORM** | Prisma |
| **Deployment** | Docker, Docker Compose |
| **Data Protocol** | REST API |

---

## Project Structure

```text
AstraNET/
├── backend/            # TypeScript API and Service Orchestration
├── python-service/     # Mathematical Analysis and Data Processing
├── frontend/           # React Visualization Dashboard (WIP)
├── prisma/             # Database Schema and Migrations
├── docker-compose.yml  # Container Orchestration
└── *.js                # Specialized Data Extraction & Build Scripts
```

---

## Setup and Installation

### Prerequisites
*   Node.js (v18+)
*   Python 3.10+
*   Docker & Docker Compose
*   PostgreSQL with TimescaleDB extension

### Quick Start
1. **Clone the repository:**
   ```bash
   git clone https://github.com/nikhilvirdi/ASTRA-NET.git
   ```
2. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install
   cd ../python-service && pip install -r requirements.txt
   ```
3. **Configure Environment:**
   Create a `.env` file in the `backend/` directory based on the provided templates.
4. **Launch Infrastructure:**
   ```bash
   docker-compose up -d
   ```
