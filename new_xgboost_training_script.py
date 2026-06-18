#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  Feature 1 — Severity-Weighted Congestion Index (v2.3 — Pure ML)             ║
║  Kaggle Script · XGBoost Classifier + Domain Rule Engine                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import ast
import re
import json
import pickle
import os
from datetime import datetime

# ML
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, f1_score, log_loss
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

# ─── Configuration ───────────────────────────────────────────────────────────
DATA_PATH = "../input/datasets/vinay2047/traffic-violations/jan to may police violation_anonymized791b166.csv"
OUTPUT_DIR = "../working/"
RANDOM_STATE = 42
N_FOLDS = 5

print("=" * 80)
print("  Feature 1 — Severity-Weighted Congestion Index (v2.3 — Pure ML)")
print("=" * 80)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 0 & 1: DATA LOADING & PREPROCESSING
# ══════════════════════════════════════════════════════════════════════════════

print("\n[PHASE 0] Loading data...")
df = pd.read_csv(DATA_PATH)
print(f"  ✓ Loaded {len(df):,} records with {df.shape[1]} columns")

print("\n[PHASE 1] Engineering base features (EDA Removed)...")
df["created_datetime"] = pd.to_datetime(df["created_datetime"], errors="coerce", utc=True)
df["hour"] = df["created_datetime"].dt.hour
df["day_of_week"] = df["created_datetime"].dt.dayofweek
df["month"] = df["created_datetime"].dt.month
df["is_weekend"] = (df["day_of_week"].fillna(-1) >= 5).astype(int)

def safe_parse_json_array(val):
    if pd.isna(val):
        return []
    try:
        parsed = ast.literal_eval(val)
        return parsed if isinstance(parsed, list) else [parsed]
    except (ValueError, SyntaxError):
        items = re.findall(r'"([^"]*)"', str(val))
        return items if items else [str(val)]

df["violation_type_list"] = df["violation_type"].apply(safe_parse_json_array)
df["offence_code_list"] = df["offence_code"].apply(safe_parse_json_array)
df["n_violations"] = df["violation_type_list"].apply(len)

df["primary_violation"] = df["violation_type_list"].apply(
    lambda x: x[0].strip().upper() if len(x) > 0 else "UNKNOWN"
)
df["primary_offence_code"] = df["offence_code_list"].apply(
    lambda x: int(x[0]) if len(x) > 0 and str(x[0]).isdigit() else -1
)

df["vehicle_type_clean"] = df["vehicle_type"].fillna("UNKNOWN").str.strip().str.upper()
df["is_junction"] = (df["junction_name"].fillna("UNKNOWN") != "No Junction").astype(int)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: COMPONENT A — CONGESTION IMPACT FORMULA
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 80)
print("  PHASE 2: Component A — Congestion Impact Formula (Rule-Based)")
print("=" * 80)

OFFENCE_WEIGHT_MAP = {
    "BLOCKING THE PASSAGE/CARRIAGEWAY": 5.0, "PARKING IN A MAIN ROAD": 4.5,
    "PARKING NEAR ROAD CROSSING": 4.0, "PARKING NEAR TRAFFIC SIGNAL": 4.0,
    "PARKING NEAR BUS STOP": 3.8, "PARKING ON THE RIGHT SIDE": 3.5,
    "DOUBLE PARKING": 4.2, "WRONG PARKING": 3.0, "NO PARKING": 3.0,
    "PARKING ON YELLOW LINE": 3.2, "FOOTPATH PARKING": 2.5,
    "PARKING ON FOOTPATH": 2.5, "PARKING IN FRONT OF GATE/ENTRANCE": 2.5,
    "PARKING NEAR FIRE HYDRANT": 3.0, "PARKING IN FRONT OF A HOSPITAL/ENTRANCE": 3.0,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 3.5,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 2.8,
    "PARKING OTHER THAN BUS STOP": 2.5, "EXPIRED PARKING": 1.5,
    "NO VALID FITNESS": 1.0, "REGISTRATION CERTIFICATE SUSPENDED": 1.0,
    "DEFECTIVE NUMBER PLATE": 1.2,
}
DEFAULT_OFFENCE_WEIGHT = 2.0

VEHICLE_WEIGHT_MAP = {
    "SCOOTER": 1.0, "MOPED": 1.0, "MOTORCYCLE": 1.0, "MOTOR CYCLE": 1.0,
    "BIKE": 1.0, "PASSENGER AUTO": 1.2, "AUTO": 1.2, "AUTO RICKSHAW": 1.2,
    "GOODS AUTO": 1.4, "CAR": 1.4, "JEEP": 1.4, "SUV": 1.6, "VAN": 1.6,
    "LGV": 1.6, "MAXI-CAB": 1.8, "TAXI": 1.4, "MINI BUS": 1.8,
    "PRIVATE BUS": 2.0, "BUS": 2.2, "TRUCK": 2.2, "HEAVY VEHICLE": 2.2,
    "LORRY": 2.2, "TEMPO": 1.8, "TRACTOR": 2.0,
}
DEFAULT_VEHICLE_WEIGHT = 1.3

def compute_base_offence_weight(primary_violation):
    v = str(primary_violation).strip().upper()
    if v in OFFENCE_WEIGHT_MAP: return OFFENCE_WEIGHT_MAP[v]
    for key, weight in OFFENCE_WEIGHT_MAP.items():
        if key in v or v in key: return weight
    return DEFAULT_OFFENCE_WEIGHT

def compute_junction_multiplier(junction_name):
    if pd.isna(junction_name) or str(junction_name).strip().upper() == "NO JUNCTION":
        return 1.0
    return 1.6

def compute_vehicle_weight(vehicle_type):
    v = str(vehicle_type).strip().upper()
    if v in VEHICLE_WEIGHT_MAP: return VEHICLE_WEIGHT_MAP[v]
    for key, weight in VEHICLE_WEIGHT_MAP.items():
        if key in v or v in key: return weight
    return DEFAULT_VEHICLE_WEIGHT

def compute_hour_multiplier(hour):
    if pd.isna(hour): return 1.0
    h = int(hour)
    if 7 <= h <= 9 or 17 <= h <= 19: return 1.5
    elif 0 <= h <= 4: return 0.6
    return 1.0

print("\n[2.5] Computing congestion impact scores...")
df["base_offence_weight"] = df["primary_violation"].apply(compute_base_offence_weight)
df["junction_multiplier"] = df["junction_name"].apply(compute_junction_multiplier)
df["vehicle_weight"] = df["vehicle_type_clean"].apply(compute_vehicle_weight)
df["hour_multiplier"] = df["hour"].apply(compute_hour_multiplier)

df["congestion_impact"] = (
    df["base_offence_weight"] * df["junction_multiplier"] * df["vehicle_weight"] * df["hour_multiplier"]
)

print(f"  ✓ Congestion impact — min: {df['congestion_impact'].min():.2f}, "
      f"max: {df['congestion_impact'].max():.2f}, "
      f"mean: {df['congestion_impact'].mean():.2f}")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: COMPONENT B — ESCALATION PROPENSITY MODEL
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 80)
print("  PHASE 3: Component B — Escalation Propensity Model (v2.3 — Pure ML)")
print("=" * 80)

print("\n[3.1] Preparing target variable...")
df["target"] = np.nan
df.loc[df["validation_status"] == "approved", "target"] = 1.0
df.loc[df["validation_status"] == "rejected", "target"] = 0.0

train_mask = df["target"].notna()
inference_mask = ~train_mask

n_pos = int((df.loc[train_mask, "target"] == 1).sum())
n_neg = int((df.loc[train_mask, "target"] == 0).sum())
print(f"  ✓ Training samples: {train_mask.sum():,}")
print(f"    - Approved (target=1): {n_pos:,}")
print(f"    - Rejected (target=0): {n_neg:,}")

print("\n[3.2] Engineering features for XGBoost...")
df["hour_sin"] = np.sin(2 * np.pi * df["hour"].fillna(0) / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"].fillna(0) / 24)
df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"].fillna(0) / 7)
df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"].fillna(0) / 7)

df["is_peak_hour"] = ((df["hour"].fillna(-1).between(7, 9)) | (df["hour"].fillna(-1).between(17, 19))).astype(int)
df["is_night"] = (df["hour"].fillna(-1).between(0, 4)).astype(int)

df["hour_bin"] = pd.cut(
    df["hour"],
    bins=[0, 5, 10, 14, 17, 20, 24],
    labels=[0, 1, 2, 3, 4, 5],
    right=False,
    include_lowest=True,
)
df["hour_bin"] = df["hour_bin"].astype(float).fillna(-1).astype(int)

df["peak_x_junction"] = df["is_peak_hour"] * df["is_junction"]
df["weekend_x_night"] = df["is_weekend"] * df["is_night"]

for col in ["police_station", "vehicle_type_clean", "primary_violation"]:
    freq = df[col].value_counts(normalize=True)
    new_col_name = f"{col.replace('_clean', '').replace('primary_', '')}_freq"
    df[new_col_name] = df[col].map(freq).fillna(0)

BENGALURU_LAT, BENGALURU_LON = 12.9766, 77.5713
df["dist_from_center"] = np.sqrt((df["latitude"] - BENGALURU_LAT)**2 + (df["longitude"] - BENGALURU_LON)**2)

LOW_CARD_CATS = ["primary_violation", "vehicle_type_clean"]
label_encoders = {}
for col in LOW_CARD_CATS:
    le = LabelEncoder()
    df[f"{col}_encoded"] = le.fit_transform(df[col].fillna("UNKNOWN").astype(str))
    label_encoders[col] = le

HIGH_CARD_CATS = ["police_station", "center_code"]
for col in HIGH_CARD_CATS:
    df[f"{col}_te"] = np.nan 

df["center_code"] = df["center_code"].fillna(-1).astype(int)

# REMOVED Component A metrics from the feature list to prevent narrative contamination
FEATURE_COLS = [
    "primary_violation_encoded", "vehicle_type_clean_encoded", "police_station_te", "center_code_te",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos", "hour", "day_of_week",
    "is_peak_hour", "is_night", "is_weekend", "hour_bin", "is_junction",
    "peak_x_junction", "weekend_x_night", "police_station_freq", "vehicle_type_freq", "violation_freq",
    "latitude", "longitude", "dist_from_center", "n_violations"
]

def target_encode_column(train_df, val_df, col, target_col="target", smoothing=20.0, global_mean=None):
    if global_mean is None: global_mean = train_df[target_col].mean()
    stats = train_df.groupby(col)[target_col].agg(["mean", "count"])
    smoothed = (stats["count"] * stats["mean"] + smoothing * global_mean) / (stats["count"] + smoothing)
    return train_df[col].map(smoothed).fillna(global_mean), val_df[col].map(smoothed).fillna(global_mean)

# Adjusted Hyperparameters for better generalization
xgb_params = {
    "objective": "binary:logistic", "eval_metric": "auc", "tree_method": "hist",
    "device": "cuda", "max_depth": 6, "learning_rate": 0.05, "n_estimators": 2500,
    "min_child_weight": 10, "subsample": 0.75, "colsample_bytree": 0.7,
    "colsample_bylevel": 0.7, "reg_alpha": 0.5, "reg_lambda": 5.0,
    "gamma": 0.1, "random_state": RANDOM_STATE, "verbosity": 0,
}

print(f"\n[3.5] Running {N_FOLDS}-Fold Stratified CV with per-fold target encoding...")
df_train = df.loc[train_mask].copy()
y_train_full = df_train["target"].values.astype(int)
skf = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)

cv_results = {"fold": [], "train_auc": [], "val_auc": [], "val_f1": [], "val_logloss": []}
oof_preds = np.zeros(len(y_train_full))
fold_models = []
global_mean = df_train["target"].mean()

for fold_idx, (train_idx, val_idx) in enumerate(skf.split(df_train, y_train_full)):
    print(f"\n  ── Fold {fold_idx + 1}/{N_FOLDS} ──")
    fold_train = df_train.iloc[train_idx].copy()
    fold_val = df_train.iloc[val_idx].copy()

    for col in HIGH_CARD_CATS:
        col_str, col_str_val = fold_train[col].astype(str), fold_val[col].astype(str)
        te_train, te_val = target_encode_column(
            fold_train.assign(**{col: col_str}), fold_val.assign(**{col: col_str_val}),
            col, smoothing=20.0, global_mean=global_mean
        )
        fold_train[f"{col}_te"] = te_train.values
        fold_val[f"{col}_te"] = te_val.values

    X_tr, X_val = fold_train[FEATURE_COLS].values.astype(np.float32), fold_val[FEATURE_COLS].values.astype(np.float32)
    y_tr, y_val = fold_train["target"].values.astype(int), fold_val["target"].values.astype(int)

    model = xgb.XGBClassifier(**xgb_params, early_stopping_rounds=80)
    model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
    
    train_preds = model.predict_proba(X_tr)[:, 1]
    val_preds = model.predict_proba(X_val)[:, 1]
    
    train_auc = roc_auc_score(y_tr, train_preds)
    val_auc = roc_auc_score(y_val, val_preds)
    val_f1 = f1_score(y_val, (val_preds >= 0.5).astype(int))
    val_ll = log_loss(y_val, val_preds)
    
    cv_results["fold"].append(fold_idx + 1)
    cv_results["train_auc"].append(train_auc)
    cv_results["val_auc"].append(val_auc)
    cv_results["val_f1"].append(val_f1)
    cv_results["val_logloss"].append(val_ll)

    oof_preds[val_idx] = val_preds
    fold_models.append(model)
    
    print(f"    Train AUC: {train_auc:.4f}  |  Val AUC: {val_auc:.4f}  |  "
          f"Val F1: {val_f1:.4f}  |  Val LogLoss: {val_ll:.4f}  |  "
          f"Best iter: {model.best_iteration}")

cv_df = pd.DataFrame(cv_results)
print(f"\n  ┌─────────────────────────────────────────────────────┐")
print(f"  │  CV Summary (v2.3 — Pure ML)                        │")
print(f"  │  Mean Val AUC:     {cv_df['val_auc'].mean():.4f} ± {cv_df['val_auc'].std():.4f}         │")
print(f"  │  Mean Train AUC:   {cv_df['train_auc'].mean():.4f}                 │")
print(f"  └─────────────────────────────────────────────────────┘")

oof_auc = roc_auc_score(y_train_full, oof_preds)
print(f"  Overall OOF AUC: {oof_auc:.4f}")

print("\n[3.6] Training final model on full training data...")
for col in HIGH_CARD_CATS:
    col_str = df_train[col].astype(str)
    stats = df_train.groupby(col_str)["target"].agg(["mean", "count"])
    smoothed = (stats["count"] * stats["mean"] + 20.0 * global_mean) / (stats["count"] + 20.0)
    df[f"{col}_te"] = df[col].astype(str).map(smoothed).fillna(global_mean)

best_iterations = [m.best_iteration for m in fold_models]
xgb_params_final = xgb_params.copy()
xgb_params_final["n_estimators"] = int(np.median(best_iterations))

X_train_full_matrix = df.loc[train_mask, FEATURE_COLS].values.astype(np.float32)
final_model = xgb.XGBClassifier(**xgb_params_final)
final_model.fit(X_train_full_matrix, y_train_full, verbose=False)
print("  ✓ Final model trained.")

print("\n[3.7] Scoring all records...")
X_all = df[FEATURE_COLS].values.astype(np.float32)
df["escalation_propensity"] = final_model.predict_proba(X_all)[:, 1]
fold_preds_all = np.column_stack([m.predict_proba(X_all)[:, 1] for m in fold_models])
df["escalation_propensity_ensemble"] = fold_preds_all.mean(axis=1)

# Corrected logic: Priority = Impact * (1 - P_approved)
df["operational_priority"] = df["congestion_impact"] * (1 - df["escalation_propensity"])

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: EXPORT ARTIFACTS
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 80)
print("  PHASE 4: Exporting Artifacts")
print("=" * 80)

final_model.save_model(os.path.join(OUTPUT_DIR, "xgb_escalation_model.json"))
print("  ✓ Model exported")

te_lookups = {}
for col in HIGH_CARD_CATS:
    stats = df_train.groupby(df_train[col].astype(str))["target"].agg(["mean", "count"])
    te_lookups[col] = ((stats["count"] * stats["mean"] + 20.0 * global_mean) / (stats["count"] + 20.0)).to_dict()

with open(os.path.join(OUTPUT_DIR, "preprocessing_artifacts.pkl"), "wb") as f:
    pickle.dump({
        "label_encoders": label_encoders,
        "target_encoding_lookups": te_lookups,
        "target_encoding_global_mean": global_mean,
        "target_encoding_smoothing": 20.0,
    }, f)
print("  ✓ Preprocessing artifacts exported")

with open(os.path.join(OUTPUT_DIR, "feature_config.json"), "w") as f:
    json.dump({"feature_columns": FEATURE_COLS}, f, indent=2, default=str)
print("  ✓ Feature config exported")

export_cols = [
    "id", "police_station", "junction_name", "vehicle_type_clean",
    "primary_violation", "hour", "day_of_week", "latitude", "longitude",
    "base_offence_weight", "junction_multiplier", "vehicle_weight", "hour_multiplier",
    "congestion_impact", "escalation_propensity", "escalation_propensity_ensemble",
    "operational_priority", "validation_status",
]
df[export_cols].to_csv(os.path.join(OUTPUT_DIR, "scored_violations.csv"), index=False)
print("  ✓ Scored violations exported")

print("\n✓ Pipeline completed successfully.")