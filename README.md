# PRISM v2.0 — Operational Priority Scoring System

## Problem Statement

> How can AI-driven parking intelligence detect illegal parking hotspots and quantify their impact on traffic flow to enable targeted enforcement?

Enforcement is historically patrol-based and reactive. No heatmap of parking violations vs. actual congestion impact exists, making it difficult to prioritize enforcement zones. PRISM produces a **per-violation operational priority score** by combining two independent components:

- **Component A** — A transparent, domain-justified **congestion impact formula** (rule-based)
- **Component B** — A learned **escalation propensity model** (XGBoost v2.3 classifier with 24 engineered features)

Neither alone is sufficient. Together they answer: *"Which violations are both high-impact AND being systematically ignored by the pipeline?"*

---

## Quick Start

PRISM v2.0 has been upgraded to a production-grade microservices architecture.

### 1. Build the Analytics Cache
PRISM uses a lightning-fast caching layer. Before starting the backend for the first time, you must run the precompute script. This processes all ~300k records through the XGBoost, K-Means, and NetworkX pipelines and saves them to JSON.
```bash
# From the repository root
python precompute.py
```

### 2. Start the FastAPI Backend
Once the cache is built, the backend starts in under 2 seconds.
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 2. Start the Next.js Frontend
The frontend is a React 19 / Next.js application featuring an interactive dual heatmap and live rank-flip tables.
```bash
# In a new terminal
cd frontend
npm install
npm run dev
```

Visit the live dashboard at **http://localhost:3000**

---

## Architecture Blueprint

```
flipkard-prism/
├── backend/                  # FastAPI Application
│   ├── api/                  # REST endpoints (/zones, /rank-flip, /heatmap, /score)
│   ├── engine/
│   │   ├── rules.py          # Component A (1.0 - 5.0 String-matching weights)
│   │   └── inference.py      # Component B (24-feature XGBoost Inference)
│   ├── services/
│   │   └── priority_service.py # Core orchestration and caching
│   └── models/               # XGBoost v2.3 artifacts
├── frontend/                 # Next.js App Router
│   ├── app/                  # Main dashboard layout
│   └── components/
│       ├── DualHeatmap.tsx   # React-Leaflet synced maps
│       ├── RankFlipTable.tsx # Diverging bar chart for zone priority
│       └── MetricsCards.tsx  # KPI summary
└── datasets/                 # Raw anonymized CSV
```

---

## Component A — Congestion Impact Formula

A transparent multiplicative formula evaluating the physical gridlock potential of a violation:

```
congestion_impact = base_offence_weight × junction_multiplier × vehicle_weight × hour_multiplier
```

### Weight Tables (Upgraded to v2.3 Scale)
The old integer lookup has been replaced with fuzzy string matching against violation names (Scale 1.0 - 5.0).
- **Offence Weights**: "BLOCKING THE PASSAGE" (5.0), "DOUBLE PARKING" (4.2), "PARKING NEAR ROAD CROSSING" (4.0).
- **Junction Multiplier**: No Junction = 1.0, Named Junction = 1.6
- **Vehicle Weight**: Scooter = 1.0, Auto = 1.2, Car = 1.4, Bus/Truck = 2.2
- **Hour Multiplier**: Peak (7-9 AM, 5-7 PM) = 1.5, Midnight (12-4 AM) = 0.6, Other = 1.0

---

## Component B — Escalation Propensity Model

An XGBoost classifier modeling human/institutional dispatch behaviour.
- **Model**: XGBoost v2.3
- **Features**: 24 engineered features (Cyclic time encodings, Target Mean Encoding, Frequency Encoding, Spatial Distance).
- **Purpose**: Calculates the probability `(0.0 to 1.0)` that the institution will actually enforce/escalate the ticket without algorithmic intervention.

---

## The Operational Priority Formula

We are looking for hidden bottlenecks—high-impact violations that the system currently ignores.

```
operational_priority = congestion_impact × (1 − escalation_propensity)
```

A **high-severity violation with low escalation propensity** is the most dangerous case — real-world impact is massive (Component A), but the system is statistically predicted to ignore it (Component B). The `(1 - P)` formula mathematically elevates these hidden bottlenecks to the top of the dispatch queue.

---

## Dashboard Visualizations

### 1. Dual Heatmap ("Count vs. Priority")
- **Left Map**: Raw violation density. Highlights where the most tickets are written (often noise).
- **Right Map**: Operational Priority. Highlights where the actual high-impact, ignored gridlock is occurring.
- **Yellow Markers**: Pinpoints the top 500 most critical individual violations in the city.

### 2. Rank Flip Table ("The System Is Patrolling the Wrong Places")
Compares a zone's naive ranking (by raw ticket volume) against its priority ranking (by the model's score). 
- **Green Arrows (Positive Flip)**: Underpatrolled zones. Low raw volume, but highly severe ignored violations.
- **Red Arrows (Negative Flip)**: Overpatrolled zones. Massive ticket volume, but mostly low-severity noise.

---

## Dependencies

**Backend**
- `fastapi >= 0.115`
- `uvicorn >= 0.30`
- `xgboost >= 3.0`
- `pandas >= 2.0`, `scikit-learn >= 1.8`

**Frontend**
- `next >= 15.0`
- `react >= 19.0`
- `leaflet` & `leaflet.heat`
- `tailwindcss`
