"""
Phase 3: Escalation Propensity Model (Component B — XGBoost Classifier)
=======================================================================
Target variable: validation_status == 'approved' (binary)
  - 1 = approved (institution chose to process fully)
  - 0 = rejected (institution declined to pursue)

This models *institutional behaviour*, not congestion cost.
"Which violations, given their characteristics, are operationally worth
pursuing based on historical enforcement decisions?"

Training data:  approved (115,400) + rejected (49,754) = 165,154 records
Excluded:       NaN, created1, processing, duplicate = 133,296 records
                (scored at inference, not used for training)

Features: is_junction, vehicle_type_encoded, hour_ist,
          violation_type_encoded, police_station_encoded,
          day_of_week, center_code
"""

import os
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for saving plots
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
    accuracy_score,
    f1_score,
)
import xgboost as xgb

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEATURES = [
    "is_junction",
    "vehicle_type_encoded",
    "hour_ist",
    "violation_type_encoded",
    "police_station_encoded",
    "day_of_week",
    "center_code",
]

FEATURE_DISPLAY_NAMES = {
    "is_junction": "Junction Proximity",
    "vehicle_type_encoded": "Vehicle Type",
    "hour_ist": "Hour of Day (IST)",
    "violation_type_encoded": "Violation Type",
    "police_station_encoded": "Police Station (Zone)",
    "day_of_week": "Day of Week",
    "center_code": "Center Code",
}

OUTPUTS_DIR = "outputs"
MODEL_PATH = os.path.join(OUTPUTS_DIR, "escalation_model.json")
METRICS_PATH = os.path.join(OUTPUTS_DIR, "model_metrics.txt")
ROC_CURVE_PATH = os.path.join(OUTPUTS_DIR, "roc_curve.png")
CONFUSION_MATRIX_PATH = os.path.join(OUTPUTS_DIR, "confusion_matrix.png")
FEATURE_IMPORTANCE_PATH = os.path.join(OUTPUTS_DIR, "xgb_feature_importance.png")


def prepare_training_data(df: pd.DataFrame) -> tuple:
    """
    Prepare training data from records with known outcomes.

    Training set: validation_status in ['approved', 'rejected']
    Target: 1 = approved, 0 = rejected
    """
    print("[Escalation Model] Preparing training data ...")

    # Filter to records with known outcomes
    train_mask = df["validation_status"].isin(["approved", "rejected"])
    df_train = df[train_mask].copy()

    # Create binary target
    df_train["target"] = (df_train["validation_status"] == "approved").astype(int)

    # Separate features and target
    X = df_train[FEATURES].copy()
    y = df_train["target"].copy()

    # Verify no NaN in features
    nan_counts = X.isnull().sum()
    if nan_counts.sum() > 0:
        print(f"  WARNING: NaN values in features:\n{nan_counts[nan_counts > 0]}")
        # Fill NaN with median for numeric features
        X = X.fillna(X.median())

    print(f"  Training records: {len(X):,}")
    print(f"  Approved (1): {y.sum():,} ({100 * y.mean():.1f}%)")
    print(f"  Rejected (0): {(1 - y).sum():,} ({100 * (1 - y.mean()):.1f}%)")

    return X, y


def train_model(X: pd.DataFrame, y: pd.Series) -> tuple:
    """
    Train XGBoost classifier with 80/20 stratified split.

    Returns: (model, X_test, y_test, X_train, y_train)
    """
    print("[Escalation Model] Training XGBoost classifier ...")

    # Stratified train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

    # Class imbalance handling
    n_rejected = (y_train == 0).sum()
    n_approved = (y_train == 1).sum()
    scale_pos_weight = n_rejected / n_approved
    print(f"  scale_pos_weight: {scale_pos_weight:.4f} (rejected/approved ratio)")

    # Model configuration
    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=42,
        verbosity=1,
    )

    # Train with early stopping on validation set
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    return model, X_test, y_test, X_train, y_train


def evaluate_model(model, X_test, y_test) -> dict:
    """
    Evaluate model performance and generate metrics + plots.

    Returns: dict of key metrics
    """
    print("\n[Escalation Model] Evaluating model ...")
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    # Predictions
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc_roc = roc_auc_score(y_test, y_prob)
    report = classification_report(y_test, y_pred, target_names=["Rejected", "Approved"])

    metrics = {
        "accuracy": accuracy,
        "f1_score": f1,
        "auc_roc": auc_roc,
    }

    print(f"\n  Accuracy:  {accuracy:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  AUC-ROC:   {auc_roc:.4f}")
    print(f"\n{report}")

    # Save metrics to file
    with open(METRICS_PATH, "w") as f:
        f.write("Escalation Propensity Model - Evaluation Metrics\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Accuracy:  {accuracy:.4f}\n")
        f.write(f"F1 Score:  {f1:.4f}\n")
        f.write(f"AUC-ROC:   {auc_roc:.4f}\n\n")
        f.write("Classification Report:\n")
        f.write(report + "\n")
    print(f"  Saved metrics to {METRICS_PATH}")

    # --- ROC Curve ---
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot(fpr, tpr, color="#4A90D9", linewidth=2,
            label=f"XGBoost (AUC = {auc_roc:.3f})")
    ax.plot([0, 1], [0, 1], color="gray", linestyle="--", linewidth=1)
    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate", fontsize=12)
    ax.set_title("ROC Curve - Escalation Propensity Model", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=11)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(ROC_CURVE_PATH, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved ROC curve to {ROC_CURVE_PATH}")

    # --- Confusion Matrix ---
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(7, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=["Rejected", "Approved"],
                yticklabels=["Rejected", "Approved"], ax=ax)
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("Actual", fontsize=12)
    ax.set_title("Confusion Matrix - Escalation Propensity Model",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(CONFUSION_MATRIX_PATH, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved confusion matrix to {CONFUSION_MATRIX_PATH}")

    # --- XGBoost Native Feature Importance ---
    importance = model.feature_importances_
    feature_names = [FEATURE_DISPLAY_NAMES.get(f, f) for f in FEATURES]
    sorted_idx = np.argsort(importance)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh(range(len(sorted_idx)), importance[sorted_idx], color="#4A90D9")
    ax.set_yticks(range(len(sorted_idx)))
    ax.set_yticklabels([feature_names[i] for i in sorted_idx], fontsize=11)
    ax.set_xlabel("Feature Importance (Gain)", fontsize=12)
    ax.set_title("XGBoost Feature Importance - Escalation Propensity",
                 fontsize=14, fontweight="bold")
    ax.grid(axis="x", alpha=0.3)
    fig.tight_layout()
    fig.savefig(FEATURE_IMPORTANCE_PATH, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved feature importance to {FEATURE_IMPORTANCE_PATH}")

    return metrics


def predict_all(model, df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate escalation propensity scores for ALL records (including
    those excluded from training — NaN, created1, processing, duplicate).
    """
    print("\n[Escalation Model] Scoring all records ...")

    X_all = df[FEATURES].copy()

    # Fill any NaN with median (should be rare after preprocessing)
    for col in X_all.columns:
        if X_all[col].isnull().any():
            X_all[col] = X_all[col].fillna(X_all[col].median())

    # Predict probability of approval (escalation propensity)
    df["escalation_propensity"] = model.predict_proba(X_all)[:, 1]

    print(f"  Scored {len(df):,} records")
    print(f"  Propensity range: {df['escalation_propensity'].min():.4f} - "
          f"{df['escalation_propensity'].max():.4f}")
    print(f"  Mean propensity:  {df['escalation_propensity'].mean():.4f}")
    print(f"  Median propensity: {df['escalation_propensity'].median():.4f}")

    # Breakdown by validation status
    print(f"\n  Mean propensity by validation_status:")
    for status in ["approved", "rejected"]:
        mask = df["validation_status"] == status
        if mask.any():
            mean_p = df.loc[mask, "escalation_propensity"].mean()
            print(f"    {status}: {mean_p:.4f}")
    # NaN status (unresolved)
    mask_nan = df["validation_status"].isna()
    if mask_nan.any():
        mean_p = df.loc[mask_nan, "escalation_propensity"].mean()
        print(f"    NaN (unresolved): {mean_p:.4f}")

    return df


def save_model(model):
    """Save the trained model to disk."""
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    model.save_model(MODEL_PATH)
    print(f"\n[Escalation Model] Saved model to {MODEL_PATH}")


def train_and_evaluate(df: pd.DataFrame) -> tuple:
    """
    Full pipeline: prepare data, train, evaluate, predict all, save.

    Returns: (model, df_with_predictions, metrics)
    """
    X, y = prepare_training_data(df)
    model, X_test, y_test, X_train, y_train = train_model(X, y)
    metrics = evaluate_model(model, X_test, y_test)
    df = predict_all(model, df)
    save_model(model)
    return model, df, metrics


# ---------------------------------------------------------------------------
# Run standalone (for testing)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from data_preprocessing import preprocess
    from congestion_impact import compute_congestion_impact

    df, encoders = preprocess(save_parquet=False)
    df = compute_congestion_impact(df)
    model, df, metrics = train_and_evaluate(df)

    print(f"\n{'=' * 60}")
    print(f"FINAL METRICS")
    print(f"{'=' * 60}")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")
