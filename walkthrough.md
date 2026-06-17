# Walkthrough — Operational Priority Scoring System

## What Was Built

A complete end-to-end pipeline that scores 298,450 parking violations with an **operational priority score** combining:

1. **Congestion Impact Formula** (Component A) — transparent, rule-based
2. **Escalation Propensity Model** (Component B) — XGBoost classifier

## Files Created

| File | Purpose |
|------|---------|
| [data_preprocessing.py](file:///d:/Projects/GridLock Round 2/data_preprocessing.py) | Phase 1: Data loading, IST conversion, feature engineering |
| [congestion_impact.py](file:///d:/Projects/GridLock Round 2/congestion_impact.py) | Phase 2: Congestion impact formula (Component A) |
| [escalation_model.py](file:///d:/Projects/GridLock Round 2/escalation_model.py) | Phase 3: XGBoost escalation propensity classifier |
| [shap_analysis.py](file:///d:/Projects/GridLock Round 2/shap_analysis.py) | Phase 4: SHAP feature importance analysis |
| [priority_scoring.py](file:///d:/Projects/GridLock Round 2/priority_scoring.py) | Phase 5: Combined scoring, zone rankings, rank flip table |
| [main.py](file:///d:/Projects/GridLock Round 2/main.py) | Phase 6: End-to-end orchestrator |
| [README.md](file:///d:/Projects/GridLock Round 2/README.md) | Project documentation (source of truth) |

## Key Results

### Model Performance
- **AUC-ROC**: 0.6798 (expected for institutional behavior modeling)
- **F1 Score**: 0.7119
- Mean approved propensity: 0.556 vs rejected: 0.445

### SHAP Feature Importance (Surprising Finding)
The original hypothesis predicted junction proximity would dominate. In reality:

1. **Hour of Day** (6.9×) dominates — the institution cares most about WHEN
2. **Junction Proximity** (1.0×) ranks LAST — the institution under-weights location

This divergence is the key insight: the congestion formula correctly weights location, while the institution's historical decisions prioritize time. The combined score bridges both perspectives.

### Rank Flip Table (The Demo Moment)
- **Cubbon Park** jumps +11 ranks (85% junction density, massively underpatrolled)
- **HSR Layout** drops -14 ranks (0% junctions, overpatrolled by count alone)
- **12,279 high-impact ignored violations** identified across the dataset

## Verification

- Full pipeline runs via `python main.py` in ~24 seconds
- All 15 output files generated successfully
- All 298,450 records scored with congestion_impact, escalation_propensity, and operational_priority
- Rank flip chart visualizes the 54 zones with clear underpatrolled vs overpatrolled patterns

## Output Directory

15 files in [outputs/](file:///d:/Projects/GridLock Round 2/outputs/):
- CSVs: scored_violations, zone_rankings, rank_flip_table, high_priority_ignored
- Plots: SHAP summary, SHAP bar, ROC curve, confusion matrix, feature importance, rank flip chart
- Model: escalation_model.json, model_metrics.txt, shap_analysis.txt
- Data: processed_violations.parquet, label_encoders.pkl
