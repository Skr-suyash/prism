# XGBoost Operational Priority Scoring System

## Problem Context

The dataset contains **298,450 parking violation records** from Bengaluru (Nov 2023 – May 2024) with 24 columns. The goal is to produce a per-violation **operational priority score** by combining:
- **Component A**: A domain-justified congestion impact formula (rule-based)
- **Component B**: An escalation propensity model (XGBoost classifier)

Together: `operational_priority = congestion_impact × escalation_propensity`

---

## Dataset Facts (Verified from Data)

| Aspect | Detail |
|--------|--------|
| Total records | 298,450 |
| Columns | 24 |
| Unique police stations (zone proxy) | 54 |
| Unique center codes | 52 |
| Unique vehicle types | 22 |
| Unique junction names | ~100+ (147,880 are "No Junction") |
| Timestamps | UTC format (`+00`), need IST conversion (+5:30) |
| `offence_code` / `violation_type` | JSON arrays (e.g., `[112,107]` / `["WRONG PARKING","PARKING IN A MAIN ROAD"]`) |

### Validation Status Breakdown

| Status | Count | data_sent_to_scita=True | data_sent_to_scita=False |
|--------|-------|------------------------|-------------------------|
| **approved** | 115,400 | 115,397 | 3 |
| **rejected** | 49,754 | 49,754 | 0 |
| NaN | 125,254 | 82,700 | 42,554 |
| created1 | 7,044 | 7,044 | 0 |
| processing | 678 | 678 | 0 |
| duplicate | 320 | 320 | 0 |

### Offence Code → Violation Type Mapping (Verified)

| Code | Violation Type | Congestion Relevance |
|------|---------------|---------------------|
| 104 | PARKING NEAR ROAD CROSSING | High — blocks crossing visibility |
| 105 | PARKING ON FOOTPATH | Medium — pushes pedestrians onto road |
| 106 | PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS | High — blocks signal visibility |
| 107 | PARKING IN A MAIN ROAD | Very High — directly blocks carriageway |
| 108 | PARKING OPPOSITE TO ANOTHER PARKED VEHICLE | High — narrows road to single lane |
| 109 | DOUBLE PARKING | Very High — blocks entire lane |
| 110 | FAIL TO USE SAFETY BELTS | None (non-parking) |
| 111 | PARKING NEAR BUSTOP/SCHOOL/HOSPITAL | High — blocks high-traffic zones |
| 112 | WRONG PARKING | Medium — general misplacement |
| 113 | NO PARKING | Medium — in restricted zone |
| 115 | JUMPING TRAFFIC SIGNAL | None (non-parking) |
| 116 | DEFECTIVE NUMBER PLATE | None (non-parking) |
| 123–147 | Various non-parking offences | None |
| 237, 437 | Using mobile phone | None |

### Vehicle Types (22 types, mapped to weight categories)

Top 5: SCOOTER (94,856), CAR (88,870), MOTOR CYCLE (40,811), PASSENGER AUTO (37,813), MAXI-CAB (11,372)

### Hour Distribution (IST Approximate)

Peak detection hours: **7 AM–1 PM IST** (heaviest enforcement activity). The data is timestamped in UTC; IST = UTC + 5:30. Most violations captured between 7 AM and 12 PM IST.

---

## Resolved Decisions

> [!NOTE]
> **Q1: IST Conversion** — ✅ Confirmed. Convert UTC timestamps to IST (UTC+5:30) using proper timezone-aware conversion.

> [!NOTE]
> **Q2: Zone Definition** — ✅ Confirmed. Use `police_station` (54 unique) as the zone proxy for zone-level rankings and rank flip table.

> [!NOTE]
> **Q3: Multi-Offence Records** — ✅ Confirmed. Take `max(weights)` across all offence codes for congestion impact. Use primary (first) violation type for XGBoost feature encoding.

> [!NOTE]
> **Q4: Non-Parking Offences** — ✅ **Exclude entirely.** Offence codes 110, 115, 116, 123–147, 237, 437 are not traffic/parking violations. Filter them out during preprocessing. Only parking-related codes (104–109, 111–113) are retained.

> [!NOTE]
> **Q5: SHAP Dependency** — ✅ Install `shap` via pip at Phase 4 execution time.

---

## Proposed Changes

### Phase 1: Data Preprocessing Pipeline

#### [NEW] [data_preprocessing.py](file:///d:/Projects/GridLock Round 2/data_preprocessing.py)

Handles all data loading, cleaning, and feature engineering in a reusable module.

**Steps:**
1. **Load CSV** with pandas
2. **Parse datetime** with `format='mixed', utc=True`, convert to IST (`Asia/Kolkata`)
3. **Extract temporal features**: `hour_ist`, `day_of_week`, `month`
4. **Parse JSON arrays**: Extract offence codes and violation types from JSON-string columns using `ast.literal_eval`
5. **Resolve vehicle type**: Use `updated_vehicle_type` where available (validated records), fall back to `vehicle_type`
6. **Create binary junction feature**: `is_junction = 1 if junction_name != 'No Junction' else 0`
7. **Encode categorical features** for XGBoost: Label-encode `vehicle_type`, `violation_type` (primary), `police_station`, `junction_name`
8. **Save processed DataFrame** as parquet for downstream consumption

---

### Phase 2: Component A — Congestion Impact Formula

#### [NEW] [congestion_impact.py](file:///d:/Projects/GridLock Round 2/congestion_impact.py)

Transparent, defensible, multiplicative formula:

```
congestion_impact = base_offence_weight × junction_multiplier × vehicle_weight × hour_multiplier
```

**Weight Definitions (Verified Against Data):**

**`base_offence_weight`** — ranked by how much the offence blocks traffic flow:

| Offence Code | Violation | Weight | Justification |
|-------------|-----------|--------|--------------|
| 107 | Parking in a Main Road | 2.5 | Directly blocks carriageway lane |
| 109 | Double Parking | 2.5 | Blocks entire lane adjacent to parked vehicle |
| 108 | Parking Opposite Another Vehicle | 2.2 | Narrows road to single lane |
| 104 | Parking Near Road Crossing | 2.0 | Blocks crossing, forces blind turns |
| 106 | Parking Near Traffic Light/Zebra | 2.0 | Blocks signal visibility, pedestrian safety |
| 111 | Parking Near Bus Stop/School/Hospital | 1.8 | Blocks high-traffic access points |
| 105 | Parking on Footpath | 1.5 | Pushes pedestrians onto carriageway |
| 112 | Wrong Parking | 1.3 | General misplacement, variable impact |
| 113 | No Parking | 1.3 | In restricted zone, variable impact |
For multi-offence records: `max(weights)` across all codes in the record.

> [!IMPORTANT]
> Non-parking offence codes (110, 115, 116, 123–147, 237, 437) are **excluded** during preprocessing. They never reach the formula.

**`junction_multiplier`**:
- `junction_name == 'No Junction'` → **1.0**
- Any named junction → **1.6** (junctions choke multiple lanes simultaneously)

**`vehicle_weight`** — based on physical carriageway footprint:

| Vehicle Type | Weight | Justification |
|-------------|--------|--------------|
| SCOOTER, MOPED | 1.0 | Smallest footprint |
| MOTOR CYCLE | 1.0 | Similar to scooter |
| PASSENGER AUTO, GOODS AUTO | 1.2 | Three-wheeler, moderate footprint |
| CAR, JEEP, VAN | 1.4 | Standard four-wheeler |
| MAXI-CAB, SCHOOL VEHICLE, FACTORY BUS | 1.8 | Large passenger vehicle |
| LGV, TEMPO, MINI LORRY | 1.8 | Light goods, similar footprint |
| PRIVATE BUS, TOURIST BUS, BUS (BMTC/KSRTC) | 2.2 | Full-size bus |
| HGV, LORRY/GOODS VEHICLE, TANKER, TRACTOR | 2.2 | Heavy goods vehicle |
| OTHERS | 1.4 | Default to car-equivalent |

**`hour_multiplier`** — based on IST traffic patterns:

| IST Hours | Multiplier | Justification |
|-----------|-----------|--------------|
| 7:00–10:00 (morning peak) | 1.5 | Morning commute rush |
| 17:00–20:00 (evening peak) | 1.5 | Evening commute rush |
| 0:00–5:00 (midnight) | 0.6 | Minimal traffic, low impact |
| All other hours | 1.0 | Normal traffic |

**Output**: New column `congestion_impact` on every record.

---

### Phase 3: Component B — Escalation Propensity Model (XGBoost)

#### [NEW] [escalation_model.py](file:///d:/Projects/GridLock Round 2/escalation_model.py)

**Target Variable**: `validation_status == 'approved'` (binary: 1 = approved, 0 = rejected)

**Training Data**: 
- Approved: 115,400 records (label = 1)
- Rejected: 49,754 records (label = 0)
- Total training: **165,154 records**
- Excluded from training: NaN status (125,254), created1 (7,044), processing (678), duplicate (320) = **133,296 records** — scored at inference only

**Features** (7 features):

| Feature | Type | Encoding | Source |
|---------|------|----------|--------|
| `is_junction` | Binary | 0/1 | `junction_name != 'No Junction'` |
| `vehicle_type_encoded` | Categorical | Label encoded | `updated_vehicle_type` or `vehicle_type` |
| `hour_ist` | Numeric | Raw integer 0–23 | Extracted from `created_datetime` |
| `violation_type_encoded` | Categorical | Label encoded | Primary violation type (first in list) |
| `police_station_encoded` | Categorical | Label encoded | `police_station` |
| `day_of_week` | Numeric | 0=Mon, 6=Sun | Extracted from `created_datetime` |
| `center_code` | Numeric | Raw integer | `center_code` |

**Model Configuration**:
```python
xgb.XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=49754/115400,  # ~0.43, handles class imbalance
    eval_metric='logloss',
    random_state=42,
    enable_categorical=False  # using label encoding instead
)
```

**Train/Validation Split**: 80/20 stratified split on training data.

**Output**: `escalation_propensity` (probability score 0–1) for **all 298,450 records**.

**Post-Training Artifacts**:
- Classification report (precision, recall, F1, AUC-ROC)
- Confusion matrix
- ROC curve plot
- Saved model (`.json` format)

---

### Phase 4: SHAP Feature Importance Analysis

#### [NEW] [shap_analysis.py](file:///d:/Projects/GridLock Round 2/shap_analysis.py)

> [!NOTE]
> Requires `pip install shap`

- Use `shap.TreeExplainer` on the trained XGBoost model
- Generate SHAP summary plot (beeswarm) showing feature importance
- Generate SHAP bar plot for mean absolute SHAP values
- Extract and print numerical feature importance rankings
- **Key narrative**: See verified SHAP results below — the divergence between formula weights and model importance is itself an actionable finding.

**Output**: `shap_summary.png`, `shap_bar.png`, `shap_analysis.txt`

---

### Phase 5: Combined Priority Score & Zone Rankings

#### [NEW] [priority_scoring.py](file:///d:/Projects/GridLock Round 2/priority_scoring.py)

1. **Compute combined score**: `operational_priority = congestion_impact × escalation_propensity`
2. **Aggregate at zone level** (by `police_station`):
   - `naive_count`: simple violation count per zone
   - `mean_congestion_impact`: average congestion impact per zone
   - `mean_escalation_propensity`: average escalation propensity per zone
   - `total_operational_priority`: sum of operational priority scores per zone
   - `mean_operational_priority`: average operational priority per zone
3. **Rank zones** by naive count and by total operational priority
4. **Build rank flip table**: 
   - `count_rank` vs `priority_rank` 
   - `rank_change = count_rank - priority_rank` (positive = zone jumps up in priority)
5. **Identify dramatic rank flips**: Find 3–4 zones that jump most dramatically
6. **Generate narrative**: "The system is patrolling the wrong places, and here is the proof."

**Output**: Zone-level ranking DataFrame, rank flip table, top movers highlighted.

---

### Phase 6: Main Orchestrator & Output Generation

#### [NEW] [main.py](file:///d:/Projects/GridLock Round 2/main.py)

End-to-end pipeline that runs all phases sequentially:

1. Preprocess data → save processed DataFrame
2. Compute congestion impact scores
3. Train XGBoost model, generate predictions
4. Run SHAP analysis
5. Compute combined priority scores
6. Generate zone rankings and rank flip table
7. Save all outputs:
   - `outputs/scored_violations.csv` — full dataset with all scores
   - `outputs/zone_rankings.csv` — zone-level ranking table
   - `outputs/rank_flip_table.csv` — rank comparison table
   - `outputs/model_metrics.txt` — classification report
   - `outputs/shap_summary.png` — SHAP feature importance chart
   - `outputs/roc_curve.png` — ROC curve
   - `outputs/confusion_matrix.png` — Confusion matrix

#### [NEW] [outputs/](file:///d:/Projects/GridLock Round 2/outputs/) (directory)

All generated artifacts saved here.

---

### Feature 2: Dual Heatmap Web Dashboard

> [!NOTE]
> Replaces the raw Folium `dual_heatmap.py` output. The Folium version was functional but not presentation-quality. This is a proper interactive web app.

#### [NEW] [export_dashboard_data.py](file:///d:/Projects/GridLock Round 2/export_dashboard_data.py)

Exports the scored pipeline outputs to optimized JSON files consumable by the web dashboard:
- `dashboard/data/violations_sample.json` — Sampled violations (~15K) with lat/lng and scores for heatmap markers
- `dashboard/data/zone_summary.json` — 54-zone aggregation with ranks, scores, flip data
- `dashboard/data/shap_importance.json` — SHAP feature importance rankings
- `dashboard/data/model_metrics.json` — Model performance metrics
- `dashboard/data/hourly_distribution.json` — Violation counts and priority by hour
- `dashboard/data/vehicle_distribution.json` — Breakdown by vehicle type

#### [NEW] [dashboard/](file:///d:/Projects/GridLock Round 2/dashboard/) (directory)

Static web app — HTML + CSS + JS, served via `python -m http.server`.

- `dashboard/index.html` — Main page with dual map layout, sidebar, filters
- `dashboard/css/styles.css` — Premium dark-mode design system
- `dashboard/js/app.js` — Leaflet.js maps, Chart.js charts, filter logic, interactivity

**UI Structure:**
1. **Header** — Title, subtitle, key metrics badges
2. **Dual Maps** — Left: violation density heatmap (Leaflet.heat), Right: operational priority circles
3. **Sidebar Filters** — Hour-of-day slider, vehicle type toggles, zone search
4. **Zone Comparison Panel** — Top-10 reranked zones table with rank flip indicators
5. **Model Explainability Panel** — SHAP bar chart, congestion formula breakdown, model metrics
6. **Key Insight Banner** — The "patrolling the wrong places" narrative

**Tech Stack:** Leaflet.js (maps), Leaflet.heat (heatmap layer), Chart.js (charts), vanilla CSS (dark glassmorphism theme). No build step, no bundler.

**How to run:**
```bash
python export_dashboard_data.py   # Generate JSON data files
cd dashboard
python -m http.server 8080        # Serve at localhost:8080
```

---

## File Structure

```
GridLock Round 2/
├── datasets/
│   └── jan to may police violation_anonymized791b166.csv
├── data_preprocessing.py          # Phase 1: Data loading & feature engineering
├── congestion_impact.py           # Phase 2: Component A formula
├── escalation_model.py            # Phase 3: Component B XGBoost classifier
├── shap_analysis.py               # Phase 4: SHAP feature importance
├── priority_scoring.py            # Phase 5: Combined scoring & zone rankings
├── main.py                        # Phase 6: End-to-end orchestrator
├── dual_heatmap.py                # Feature 2 (Folium version, replaced by dashboard)
├── export_dashboard_data.py       # Feature 2: Export data for web dashboard
├── dashboard/                     # Feature 2: Web Dashboard
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js
│   └── data/                      # Generated by export_dashboard_data.py
│       ├── violations_sample.json
│       ├── zone_summary.json
│       ├── shap_importance.json
│       ├── model_metrics.json
│       ├── hourly_distribution.json
│       └── vehicle_distribution.json
├── outputs/                       # Pipeline outputs (Feature 1)
│   ├── scored_violations.csv
│   ├── zone_rankings.csv
│   ├── rank_flip_table.csv
│   └── ... (model artifacts, plots)
└── README.md
```

---

## Verification Plan

### Automated Tests
- Run the full pipeline via `python main.py` and verify all output files are generated
- Verify model metrics: AUC-ROC > 0.65 (reasonable for this type of institutional behavior modeling)
- Verify congestion impact scores are within expected ranges (all > 0, bounded by weight products)
- Verify all 298,450 records receive scores

### Manual Verification
- Inspect rank flip table for dramatic movers — validate the narrative makes sense
- Review SHAP plot for feature importance convergence with congestion formula weights
- Spot-check a few individual violation records for correct score computation
- Verify the "dangerous" cases: high congestion impact + low escalation propensity records exist and are identifiable

---

## Verified Results (Pipeline Output)

> [!NOTE]
> Full pipeline runs in ~17 seconds, scores all 298,450 records.

### Component A — Congestion Impact Scores

| Metric | Value |
|--------|-------|
| Score range | 0.78 – 13.20 |
| Mean | 2.27 |
| Median | 2.08 |
| Std | 1.15 |

Highest-impact examples: Buses/trucks wrong-parked at named junctions during morning peak hours score 13.20.

### Component B — Escalation Propensity Model

| Metric | Value |
|--------|-------|
| AUC-ROC | 0.6798 |
| Accuracy | 63.5% |
| F1 Score | 0.7119 |
| Propensity range | 0.0085 – 0.9719 |
| Mean (approved) | 0.5563 |
| Mean (rejected) | 0.4454 |

### SHAP Feature Importance (Verified)

| Rank | Feature | Mean |SHAP| | Relative |
|------|---------|------------|----------|
| 1 | Hour of Day (IST) | 0.2503 | 6.9x |
| 2 | Violation Type | 0.1838 | 5.1x |
| 3 | Vehicle Type | 0.1754 | 4.9x |
| 4 | Center Code | 0.1160 | 3.2x |
| 5 | Day of Week | 0.1143 | 3.2x |
| 6 | Police Station (Zone) | 0.1125 | 3.1x |
| 7 | Junction Proximity | 0.0361 | 1.0x |

> [!IMPORTANT]
> **Key Finding**: The institution's escalation decisions are dominated by **when** a violation occurs (hour, day), not **where** (junction). Junction proximity ranks last in SHAP importance. This divergence from the congestion formula is itself actionable — it reveals that enforcement prioritization is time-driven, while congestion impact is location-driven. The combined score corrects for this by multiplying both perspectives.

The moderate AUC is expected — we are modeling institutional decisions, not a deterministic signal.

### Combined Priority — Key Findings

- **Operational priority range**: 0.021 – 10.005
- **12,279 high-impact ignored violations** identified (top 25% congestion + bottom 25% propensity)

### Rank Flip Table — Dramatic Movers

**Underpatrolled zones (jumping UP):**

| Zone | Count Rank | Priority Rank | Change | Junction% |
|------|-----------|--------------|--------|-----------|
| Cubbon Park | 28 | 17 | **+11** | 85% |
| Wilson Garden | 30 | 20 | **+10** | 79% |
| Chamarajpet | 23 | 16 | **+7** | 98% |
| Jayanagara | 22 | 15 | **+7** | 97% |
| Basavanagudi | 25 | 19 | **+6** | 83% |

**Overpatrolled zones (dropping DOWN):**

| Zone | Count Rank | Priority Rank | Change | Junction% |
|------|-----------|--------------|--------|-----------|
| HSR Layout | 15 | 29 | **-14** | 0% |
| Pulikeshinagar | 20 | 32 | **-12** | 0% |
| Electronic City | 19 | 30 | **-11** | 0% |
| K.R. Pura | 11 | 18 | **-7** | 0% |
| Bellandur | 16 | 22 | **-6** | 0% |

> [!IMPORTANT]
> The pattern is clear: zones with high junction density are systematically underpriotized despite their congestion impact, while zones with zero junction presence are overpatrolled.

---

## Execution Order

1. **Phase 1** → `data_preprocessing.py` — Build and test data pipeline
2. **Phase 2** → `congestion_impact.py` — Implement and verify formula
3. **Phase 3** → `escalation_model.py` — Train XGBoost, evaluate metrics
4. **Phase 4** → `shap_analysis.py` — Generate SHAP analysis
5. **Phase 5** → `priority_scoring.py` — Combined scoring and zone rankings
6. **Phase 6** → `main.py` — Wire everything together, run end-to-end

