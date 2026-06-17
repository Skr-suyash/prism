"""
GridLock Round 2 — Main Orchestrator
=====================================
End-to-end pipeline that runs all phases sequentially:

  Phase 1: Data Preprocessing (load, clean, feature engineer)
  Phase 2: Congestion Impact Formula (Component A)
  Phase 3: XGBoost Escalation Propensity Model (Component B)
  Phase 4: SHAP Feature Importance Analysis
  Phase 5: Combined Priority Scoring + Zone Rankings

Outputs (in outputs/ directory):
  - scored_violations.csv          Per-violation scores
  - zone_rankings.csv              Zone-level ranking table
  - rank_flip_table.csv            Rank comparison table
  - high_priority_ignored.csv      High-impact, low-propensity violations
  - model_metrics.txt              Classification report
  - shap_summary.png               SHAP beeswarm plot
  - shap_bar.png                   SHAP bar plot
  - shap_analysis.txt              SHAP numerical analysis
  - roc_curve.png                  ROC curve
  - confusion_matrix.png           Confusion matrix
  - xgb_feature_importance.png     XGBoost native feature importance
  - rank_flip_chart.png            Zone rank flip visualization
  - escalation_model.json          Saved XGBoost model
  - processed_violations.parquet   Preprocessed data
  - label_encoders.pkl             Fitted label encoders

Usage:
  python main.py                   Run full pipeline
  python main.py --skip-shap       Run without SHAP (if shap not installed)
"""

import sys
import os
import time

from data_preprocessing import preprocess
from congestion_impact import compute_congestion_impact
from escalation_model import train_and_evaluate
from priority_scoring import run_priority_scoring


def main(skip_shap: bool = False):
    """Run the full analysis pipeline."""
    start_time = time.time()

    print("=" * 70)
    print("  GRIDLOCK ROUND 2 - OPERATIONAL PRIORITY SCORING PIPELINE")
    print("=" * 70)
    print()

    # Phase 1: Preprocessing
    print(">>> PHASE 1: DATA PREPROCESSING")
    print("-" * 50)
    df, encoders = preprocess(save_parquet=True)
    print()

    # Phase 2: Congestion Impact
    print(">>> PHASE 2: CONGESTION IMPACT FORMULA (Component A)")
    print("-" * 50)
    df = compute_congestion_impact(df)
    print()

    # Phase 3: XGBoost Model
    print(">>> PHASE 3: ESCALATION PROPENSITY MODEL (Component B)")
    print("-" * 50)
    model, df, metrics = train_and_evaluate(df)
    print()

    # Phase 4: SHAP Analysis
    if not skip_shap:
        try:
            print(">>> PHASE 4: SHAP FEATURE IMPORTANCE ANALYSIS")
            print("-" * 50)
            from shap_analysis import run_shap_analysis
            importance = run_shap_analysis(model, df)
            print()
        except ImportError:
            print(">>> PHASE 4: SKIPPED (shap not installed)")
            print("   Install with: pip install shap")
            print()
    else:
        print(">>> PHASE 4: SKIPPED (--skip-shap flag)")
        print()

    # Phase 5: Priority Scoring
    print(">>> PHASE 5: COMBINED PRIORITY SCORING & ZONE RANKINGS")
    print("-" * 50)
    df, zone_agg, flip_table = run_priority_scoring(df)
    print()

    # Final summary
    elapsed = time.time() - start_time
    print("=" * 70)
    print("  PIPELINE COMPLETE")
    print("=" * 70)
    print(f"  Total time:     {elapsed:.1f}s")
    print(f"  Records scored: {len(df):,}")
    print(f"  Zones ranked:   {len(zone_agg)}")
    print(f"")
    print(f"  Model metrics:")
    for k, v in metrics.items():
        print(f"    {k}: {v:.4f}")
    print(f"")
    print(f"  Output files in: {os.path.abspath('outputs')}/")
    for f in sorted(os.listdir("outputs")):
        size_mb = os.path.getsize(os.path.join("outputs", f)) / (1024 * 1024)
        print(f"    {f:45s} ({size_mb:.2f} MB)")
    print("=" * 70)


if __name__ == "__main__":
    skip_shap = "--skip-shap" in sys.argv
    main(skip_shap=skip_shap)
