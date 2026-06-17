# GridLock Round 2 — Operational Priority Scoring System

## Problem Statement

> How can AI-driven parking intelligence detect illegal parking hotspots and quantify their impact on traffic flow to enable targeted enforcement?

Enforcement is patrol-based and reactive. No heatmap of parking violations vs. congestion impact exists, and it is difficult to prioritize enforcement zones. This system produces a **per-violation operational priority score** by combining two independent components:

- **Component A** — A transparent, domain-justified **congestion impact formula** (rule-based)
- **Component B** — A learned **escalation propensity model** (XGBoost classifier)

Neither alone is sufficient. Together they answer: *"Which violations are both high-impact AND being systematically ignored by the pipeline?"*

---

## Quick Start

```bash
# Run the full pipeline (all 6 phases)
python main.py

# Run without SHAP analysis (if shap not installed)
python main.py --skip-shap

# Run individual phases
python data_preprocessing.py
python congestion_impact.py
python escalation_model.py
python shap_analysis.py
python priority_scoring.py
```

**Runtime**: ~24 seconds for the full pipeline on 298,450 records.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    data_preprocessing.py                     │
│  Load CSV → Parse Datetime (IST) → Feature Engineering       │
│  → Filter Non-Parking → Label Encode → Save Parquet          │
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
    ┌─────────────▼──────────┐   ┌────────────▼──────────────┐
    │  congestion_impact.py  │   │   escalation_model.py     │
    │  Component A (Formula) │   │  Component B (XGBoost)    │
    │                        │   │                           │
    │  base_offence_weight   │   │  Target: approved/rejected│
    │  × junction_multiplier │   │  Features: 7 features     │
    │  × vehicle_weight      │   │  AUC-ROC: 0.6798         │
    │  × hour_multiplier     │   │                           │
    └─────────────┬──────────┘   └─────┬──────────┬──────────┘
                  │                    │          │
                  │                    │    ┌─────▼──────────┐
                  │                    │    │ shap_analysis.py│
                  │                    │    │ SHAP Explainer  │
                  │                    │    └────────────────┘
                  │                    │
           ┌──────▼────────────────────▼────────┐
           │        priority_scoring.py          │
           │                                     │
           │  operational_priority =              │
           │    congestion_impact ×               │
           │    escalation_propensity             │
           │                                     │
           │  → Zone Rankings                    │
           │  → Rank Flip Table                  │
           │  → High-Priority Ignored List       │
           └─────────────────────────────────────┘
```

---

## Component A — Congestion Impact Formula

A transparent multiplicative formula. No model, no proxy — defensible domain logic:

```
congestion_impact = base_offence_weight × junction_multiplier × vehicle_weight × hour_multiplier
```

### Weight Tables

**Base Offence Weight** (by blocking severity):

| Code | Violation | Weight |
|------|-----------|--------|
| 107 | Parking in a Main Road | 2.5 |
| 109 | Double Parking | 2.5 |
| 108 | Parking Opposite Another Vehicle | 2.2 |
| 104 | Parking Near Road Crossing | 2.0 |
| 106 | Parking Near Traffic Light/Zebra | 2.0 |
| 111 | Parking Near Bus Stop/School/Hospital | 1.8 |
| 105 | Parking on Footpath | 1.5 |
| 112 | Wrong Parking | 1.3 |
| 113 | No Parking | 1.3 |

**Junction Multiplier**: No Junction = 1.0, Named Junction = 1.6

**Vehicle Weight**: Scooter/Moped = 1.0, Auto = 1.2, Car = 1.4, Maxi-Cab/LGV = 1.8, Bus/HGV = 2.2

**Hour Multiplier** (IST): Peak (7-10 AM, 5-8 PM) = 1.5, Midnight (12-5 AM) = 0.6, Other = 1.0

**Result**: Scores range from 0.78 to 13.20 (mean: 2.27)

---

## Component B — Escalation Propensity Model

An XGBoost classifier modeling institutional behaviour:
- **Target**: `validation_status == 'approved'` (binary)
- **Training data**: 115,400 approved + 49,754 rejected = 165,154 records
- **Excluded from training**: 133,296 records (NaN, created1, processing, duplicate) — scored at inference

### Model Performance

| Metric | Value |
|--------|-------|
| AUC-ROC | 0.6798 |
| Accuracy | 63.5% |
| F1 Score | 0.7119 |

### SHAP Feature Importance

| Rank | Feature | Relative Importance |
|------|---------|-------------------|
| 1 | Hour of Day (IST) | 6.9× |
| 2 | Violation Type | 5.1× |
| 3 | Vehicle Type | 4.9× |
| 4 | Center Code | 3.2× |
| 5 | Day of Week | 3.2× |
| 6 | Police Station | 3.1× |
| 7 | Junction Proximity | 1.0× |

**Key Finding**: The institution's escalation decisions are dominated by *when* a violation occurs (hour, day), not *where* (junction). This divergence from the congestion formula is actionable — enforcement prioritization is time-driven, while congestion impact is location-driven. The combined score corrects for this.

---

## Combined Priority Score

```
operational_priority = congestion_impact × escalation_propensity
```

A **high-severity violation with low escalation propensity** is the most dangerous case — real-world impact is high but the system historically fails to pursue it.

- **12,279 high-impact ignored violations** identified
- Top affected zones: Shivajinagar (2,509), Vijayanagara (1,109), City Market (892)

---

## Rank Flip Table — "The System Is Patrolling the Wrong Places"

| Zone | Count Rank | Priority Rank | Change | Junction% |
|------|-----------|--------------|--------|-----------|
| Cubbon Park | 28 | 17 | **+11** | 85% |
| Wilson Garden | 30 | 20 | **+10** | 79% |
| Chamarajpet | 23 | 16 | **+7** | 98% |
| HSR Layout | 15 | 29 | **-14** | 0% |
| Pulikeshinagar | 20 | 32 | **-12** | 0% |
| Electronic City | 19 | 30 | **-11** | 0% |

Zones with high junction density are systematically under-prioritized despite their congestion impact. Zones with zero junctions are over-patrolled.

---

## Output Files

All outputs are saved to `outputs/`:

| File | Description |
|------|-------------|
| `scored_violations.csv` | Per-violation scores (298,450 records) |
| `zone_rankings.csv` | Zone-level ranking table (54 zones) |
| `rank_flip_table.csv` | Naive count vs priority rank comparison |
| `high_priority_ignored.csv` | High-impact, low-propensity violations (12,279) |
| `model_metrics.txt` | Classification report |
| `escalation_model.json` | Saved XGBoost model |
| `shap_summary.png` | SHAP beeswarm plot |
| `shap_bar.png` | SHAP bar plot |
| `shap_analysis.txt` | SHAP numerical analysis |
| `roc_curve.png` | ROC curve |
| `confusion_matrix.png` | Confusion matrix |
| `xgb_feature_importance.png` | XGBoost native feature importance |
| `rank_flip_chart.png` | Zone rank flip visualization |
| `processed_violations.parquet` | Preprocessed data |
| `label_encoders.pkl` | Fitted label encoders |

---

## Dataset

- **Source**: Bengaluru parking violations (Nov 2023 – May 2024)
- **Records**: 298,450 with 24 columns
- **File**: `datasets/jan to may police violation_anonymized791b166.csv`

---

## Dependencies

```
pandas >= 3.0
numpy >= 2.0
scikit-learn >= 1.9
xgboost >= 3.2
shap >= 0.52
matplotlib >= 3.10
seaborn >= 0.13
```

Install SHAP: `pip install shap`
