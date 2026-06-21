#!/usr/bin/env python3
"""
Feature 3 - Hourly Violation Forecasting Model (XGBoost) - v2 ENHANCED
Training & Evaluation Script

Improvements over v1:
  - Cyclical time encoding (sin/cos for hour and day_of_week)
  - Station-level context features (avg volume, std, peak ratio)
  - Expanded lag features (1h, 2h, 3h, 6h) + momentum diffs
  - Rolling stats at multiple windows (24h, 3d, 7d) with mean AND std
  - EMA baseline per (station, hour) as feature
  - Log1p target transformation for skewed count distribution
  - Lower learning rate (0.01) with more trees (3000) and higher patience (150)
  - Improved evaluation: weighted MAE, peak-hour RMSE, MAPE for top stations

Outputs:
  - Evaluation metrics (MAE, RMSE, weighted MAE, MAPE per station and overall)
  - 4 PNG charts (heatmap, forecast vs actual, peak hour bar, residual analysis)
  - Trained model artifacts for backend integration
  - Printed summary
"""

import warnings
warnings.filterwarnings("ignore")

import os
import json
import pickle
import numpy as np
import pandas as pd
from itertools import product
from pathlib import Path

from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

# --- Configuration ---
DATA_PATH = "C:/programming/Hackathons/FK Gridlock round2/jan to may police violation_anonymized791b166.csv"
OUTPUT_DIR = Path("c:/programming/Hackathons/FK Gridlock round2/flipkard-gridlock/backend/models")
CHART_DIR = Path("c:/programming/Hackathons/FK Gridlock round2/flipkard-gridlock/forecast_charts")
HOLDOUT_DAYS = 7
RANDOM_STATE = 42

CHART_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("  Feature 3 - Hourly Violation Forecasting (XGBoost v2 - ENHANCED)")
print("=" * 80)

# =========================================================================
# STEP 1: BUILD HOURLY TIME SERIES PER STATION
# =========================================================================
print("\n[STEP 1] Loading data and building hourly time series...")

df = pd.read_csv(DATA_PATH)
print(f"  Loaded {len(df):,} records")

df["created_datetime"] = pd.to_datetime(df["created_datetime"], format="mixed", utc=True)
df["date_hour"] = df["created_datetime"].dt.floor("h")

print(f"  Date range: {df['date_hour'].min()} -> {df['date_hour'].max()}")
df["police_station"] = df["police_station"].astype(str).str.strip()
df = df[~df["police_station"].isin(["nan", "NaN", "None", "", "UNKNOWN"])]
print(f"  Unique stations after clean: {df['police_station'].nunique()}")

df["police_station"] = df["police_station"].astype(str)
df = df[df["police_station"] != "nan"]
df = df[df["police_station"] != "NaN"]
hourly = df.groupby(["police_station", "date_hour"]).size().reset_index(name="violation_count")
print(f"  Raw hourly records: {len(hourly):,}")

# Zero-fill missing hours for each station
all_hours = pd.date_range(
    start=df["date_hour"].min(),
    end=df["date_hour"].max(),
    freq="h",
    tz="UTC",
)
all_stations = df["police_station"].unique()
full_index = pd.DataFrame(
    list(product(all_stations, all_hours)),
    columns=["police_station", "date_hour"],
)
hourly = full_index.merge(hourly, on=["police_station", "date_hour"], how="left").fillna(0)
hourly["violation_count"] = hourly["violation_count"].astype(int)

total_slots = len(all_stations) * len(all_hours)
filled_slots = (hourly["violation_count"] > 0).sum()
print(f"  Total hourly slots: {total_slots:,}")
print(f"  Non-zero slots: {filled_slots:,} ({filled_slots/total_slots*100:.1f}%)")
print(f"  Zero-filled slots: {total_slots - filled_slots:,}")

# =========================================================================
# STEP 2: FEATURE ENGINEERING (v2 ENHANCED)
# =========================================================================
print("\n[STEP 2] Engineering features (v2 - enhanced)...")

hourly = hourly.sort_values(["police_station", "date_hour"]).reset_index(drop=True)

# -- 2a: Cyclical time encoding --
hourly["hour"] = hourly["date_hour"].dt.hour
hourly["day_of_week"] = hourly["date_hour"].dt.dayofweek
hourly["hour_sin"] = np.sin(2 * np.pi * hourly["hour"] / 24)
hourly["hour_cos"] = np.cos(2 * np.pi * hourly["hour"] / 24)
hourly["dow_sin"] = np.sin(2 * np.pi * hourly["day_of_week"] / 7)
hourly["dow_cos"] = np.cos(2 * np.pi * hourly["day_of_week"] / 7)
hourly["is_weekend"] = (hourly["day_of_week"] >= 5).astype(int)
hourly["is_peak_hour"] = hourly["hour"].isin([2, 3, 4, 5, 6]).astype(int)
hourly["day_of_month"] = hourly["date_hour"].dt.day
print("  [OK] Cyclical time features (hour_sin/cos, dow_sin/cos)")

# -- 2b: Station-level context features --
station_stats = hourly.groupby("police_station")["violation_count"].agg(
    station_avg_volume="mean",
    station_std_volume="std",
    station_median_volume="median",
    station_total_volume="sum",
).reset_index()
station_stats["station_peak_ratio"] = (
    station_stats["station_avg_volume"] / station_stats["station_avg_volume"].max()
)

station_hour_profile = hourly.groupby(["police_station", "hour"])["violation_count"].mean().reset_index(
    name="station_hour_profile"
)
station_dow_profile = hourly.groupby(["police_station", "day_of_week"])["violation_count"].mean().reset_index(
    name="station_dow_profile"
)

hourly = hourly.merge(station_stats[["police_station", "station_avg_volume", "station_std_volume",
                                      "station_median_volume", "station_peak_ratio"]],
                       on="police_station", how="left")
hourly = hourly.merge(station_hour_profile, on=["police_station", "hour"], how="left")
hourly = hourly.merge(station_dow_profile, on=["police_station", "day_of_week"], how="left")
print("  [OK] Station context features (avg, std, median, peak_ratio, hour_profile, dow_profile)")

# -- 2c: EMA baseline per (station, hour) --
hourly = hourly.sort_values(["police_station", "hour", "date_hour"]).reset_index(drop=True)
hourly["ema_baseline"] = (
    hourly.groupby(["police_station", "hour"])["violation_count"]
    .transform(lambda x: x.shift(1).ewm(alpha=0.3, adjust=False).mean())
)
hourly = hourly.sort_values(["police_station", "date_hour"]).reset_index(drop=True)
print("  [OK] EMA baseline per (station, hour) with alpha=0.3")

# -- 2d: Lag features (expanded) --
grp = hourly.groupby("police_station")["violation_count"]
hourly["lag_1h"] = grp.shift(1)
hourly["lag_2h"] = grp.shift(2)
hourly["lag_3h"] = grp.shift(3)
hourly["lag_6h"] = grp.shift(6)
hourly["lag_24h"] = grp.shift(24)
hourly["lag_48h"] = grp.shift(48)
hourly["lag_72h"] = grp.shift(72)
hourly["lag_168h"] = grp.shift(168)
hourly["lag_diff_24_48"] = hourly["lag_24h"] - hourly["lag_48h"]
hourly["lag_diff_168_336"] = hourly["lag_168h"] - grp.shift(336)
print("  [OK] Lag features (1h, 2h, 3h, 6h, 24h, 48h, 72h, 168h + momentum diffs)")

# -- 2e: Rolling features (multiple windows) --
hourly["rolling_24h_avg"] = grp.transform(lambda x: x.rolling(24, min_periods=6).mean())
hourly["rolling_24h_std"] = grp.transform(lambda x: x.rolling(24, min_periods=6).std())
hourly["rolling_3d_avg"] = grp.transform(lambda x: x.rolling(24*3, min_periods=24).mean())
hourly["rolling_7d_avg"] = grp.transform(lambda x: x.rolling(24*7, min_periods=24).mean())
hourly["rolling_7d_std"] = grp.transform(lambda x: x.rolling(24*7, min_periods=24).std())

hourly["past_7d_avg_same_hour"] = (
    hourly.groupby(["police_station", "hour"])["violation_count"]
    .transform(lambda x: x.shift(1).rolling(7, min_periods=1).mean())
)
hourly["past_7d_max_same_hour"] = (
    hourly.groupby(["police_station", "hour"])["violation_count"]
    .transform(lambda x: x.shift(1).rolling(7, min_periods=1).max())
)
hourly["past_7d_std_same_hour"] = (
    hourly.groupby(["police_station", "hour"])["violation_count"]
    .transform(lambda x: x.shift(1).rolling(7, min_periods=1).std())
)
hourly["past_4w_avg_same_hour_dow"] = (
    hourly.groupby(["police_station", "hour", "day_of_week"])["violation_count"]
    .transform(lambda x: x.shift(1).rolling(4, min_periods=1).mean())
)
print("  [OK] Rolling features (24h, 3d, 7d mean/std + same-hour + same-hour-dow)")

# -- 2f: Interaction features --
hourly["peak_x_station_avg"] = hourly["is_peak_hour"] * hourly["station_avg_volume"]
hourly["weekend_x_station_avg"] = hourly["is_weekend"] * hourly["station_avg_volume"]
hourly["lag_24h_ratio"] = hourly["lag_24h"] / (hourly["station_avg_volume"] + 0.1)
hourly["ema_deviation"] = hourly["lag_1h"] - hourly["ema_baseline"]
print("  [OK] Interaction features (peak*station, weekend*station, lag ratio, ema deviation)")

# -- 2g: Label encode stations --
le_station = LabelEncoder()
hourly["police_station"] = hourly["police_station"].astype(str)
hourly["station_encoded"] = le_station.fit_transform(hourly["police_station"])

# -- 2h: Drop rows with NaN lags --
lag_cols = ["lag_1h", "lag_2h", "lag_3h", "lag_6h",
            "lag_24h", "lag_48h", "lag_72h", "lag_168h",
            "lag_diff_24_48", "lag_diff_168_336",
            "rolling_24h_avg", "rolling_7d_avg", "ema_baseline"]

before_drop = len(hourly)
hourly_clean = hourly.dropna(subset=lag_cols).copy()

for col in ["rolling_24h_std", "rolling_7d_std", "past_7d_std_same_hour",
            "station_std_volume", "past_4w_avg_same_hour_dow",
            "station_hour_profile", "station_dow_profile", "ema_deviation"]:
    hourly_clean[col] = hourly_clean[col].fillna(0)

print(f"  Dropped {before_drop - len(hourly_clean):,} rows with NaN lags")
print(f"  Clean dataset: {len(hourly_clean):,} rows")

# -- Feature list (v2: 40 features) --
FEATURE_COLS = [
    "hour", "day_of_week", "day_of_month",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "is_weekend", "is_peak_hour",
    "station_avg_volume", "station_std_volume", "station_median_volume",
    "station_peak_ratio", "station_hour_profile", "station_dow_profile",
    "ema_baseline",
    "lag_1h", "lag_2h", "lag_3h", "lag_6h",
    "lag_24h", "lag_48h", "lag_72h", "lag_168h",
    "lag_diff_24_48", "lag_diff_168_336",
    "rolling_24h_avg", "rolling_24h_std",
    "rolling_3d_avg", "rolling_7d_avg", "rolling_7d_std",
    "past_7d_avg_same_hour", "past_7d_max_same_hour", "past_7d_std_same_hour",
    "past_4w_avg_same_hour_dow",
    "peak_x_station_avg", "weekend_x_station_avg", "lag_24h_ratio",
    "ema_deviation",
    "station_encoded",
]

print(f"\n  Total features: {len(FEATURE_COLS)}")

# =========================================================================
# STEP 3: TRAIN / EVALUATE (v2 ENHANCED)
# =========================================================================
print("\n[STEP 3] Training XGBoost model (v2 - enhanced)...")

cutoff = hourly_clean["date_hour"].max() - pd.Timedelta(days=HOLDOUT_DAYS)
train_mask = hourly_clean["date_hour"] <= cutoff
test_mask = hourly_clean["date_hour"] > cutoff

train_df = hourly_clean[train_mask]
test_df = hourly_clean[test_mask]
print(f"  Train: {len(train_df):,} rows  |  Test: {len(test_df):,} rows")
print(f"  Train period: {train_df['date_hour'].min()} -> {train_df['date_hour'].max()}")
print(f"  Test period:  {test_df['date_hour'].min()} -> {test_df['date_hour'].max()}")

X_train = train_df[FEATURE_COLS].values.astype(np.float32)
X_test = test_df[FEATURE_COLS].values.astype(np.float32)

# Log1p target transformation
y_train_raw = train_df["violation_count"].values.astype(np.float32)
y_test_raw = test_df["violation_count"].values.astype(np.float32)
y_train = np.log1p(y_train_raw)
y_test_log = np.log1p(y_test_raw)

print(f"  Target range (raw): [{y_train_raw.min():.0f}, {y_train_raw.max():.0f}]")
print(f"  Target range (log1p): [{y_train.min():.2f}, {y_train.max():.2f}]")

model = XGBRegressor(
    n_estimators=3000,
    max_depth=7,
    learning_rate=0.01,
    min_child_weight=3,
    subsample=0.85,
    colsample_bytree=0.85,
    colsample_bylevel=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    gamma=0.05,
    objective="reg:squarederror",
    random_state=RANDOM_STATE,
    tree_method="hist",
    verbosity=0,
    early_stopping_rounds=150,
)

model.fit(X_train, y_train, eval_set=[(X_test, y_test_log)], verbose=False)
print(f"  Best iteration: {model.best_iteration}")

# Predict and invert log1p
y_pred_log = model.predict(X_test)
y_pred = np.expm1(y_pred_log)
y_pred = np.maximum(y_pred, 0)

# Overall metrics
overall_mae = mean_absolute_error(y_test_raw, y_pred)
overall_rmse = np.sqrt(mean_squared_error(y_test_raw, y_pred))
weights = y_test_raw + 1
weighted_mae = float(np.average(np.abs(y_test_raw - y_pred), weights=weights))

test_df = test_df.copy()
test_df["predicted"] = y_pred

peak_mask = test_df["hour"].isin([2, 3, 4, 5, 6])
peak_mae = mean_absolute_error(test_df.loc[peak_mask, "violation_count"],
                                test_df.loc[peak_mask, "predicted"]) if peak_mask.sum() > 0 else 0
peak_rmse = np.sqrt(mean_squared_error(test_df.loc[peak_mask, "violation_count"],
                                        test_df.loc[peak_mask, "predicted"])) if peak_mask.sum() > 0 else 0

print(f"\n  +---------------------------------------------------+")
print(f"  |  OVERALL HOLD-OUT METRICS (v2 - ENHANCED)           |")
print(f"  |  MAE:          {overall_mae:.4f} violations/hour         |")
print(f"  |  RMSE:         {overall_rmse:.4f} violations/hour         |")
print(f"  |  Weighted MAE: {weighted_mae:.4f}                         |")
print(f"  |  Peak-Hr MAE:  {peak_mae:.4f}  (2-6 AM only)            |")
print(f"  |  Peak-Hr RMSE: {peak_rmse:.4f}  (2-6 AM only)            |")
print(f"  +---------------------------------------------------+")

# Per-station metrics
station_metrics = []
for station in sorted(test_df["police_station"].unique(), key=str):
    sdf = test_df[test_df["police_station"] == station]
    mae = mean_absolute_error(sdf["violation_count"], sdf["predicted"])
    rmse = np.sqrt(mean_squared_error(sdf["violation_count"], sdf["predicted"]))
    avg_actual = sdf["violation_count"].mean()

    nonzero_mask = sdf["violation_count"] > 0
    if nonzero_mask.sum() > 5:
        mape = float(np.mean(np.abs(sdf.loc[nonzero_mask, "violation_count"] - sdf.loc[nonzero_mask, "predicted"])
                       / sdf.loc[nonzero_mask, "violation_count"]) * 100)
    else:
        mape = None

    station_metrics.append({
        "station": str(station), "mae": round(float(mae), 4), "rmse": round(float(rmse), 4),
        "avg_actual": round(float(avg_actual), 2),
        "mape": round(mape, 1) if mape is not None else None,
        "test_rows": len(sdf),
    })

station_metrics_df = pd.DataFrame(station_metrics).sort_values("mae", ascending=False)
print("\n  Per-Station Metrics (Top 10 by MAE):")
print("  " + "-" * 80)
print(f"  {'Station':<25} {'MAE':>8} {'RMSE':>8} {'Avg Actual':>12} {'MAPE %':>8}")
print("  " + "-" * 80)
for _, row in station_metrics_df.head(10).iterrows():
    mape_str = f"{row['mape']:.0f}%" if row['mape'] is not None else "N/A"
    print(f"  {row['station']:<25} {row['mae']:>8.3f} {row['rmse']:>8.3f} {row['avg_actual']:>12.2f} {mape_str:>8}")

# Feature importance
print("\n  Feature Importances (Top 15):")
importances = sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1])
for fname, imp in importances[:15]:
    bar = "=" * int(imp * 50)
    print(f"    {fname:<25} {imp:.4f}  {bar}")

# =========================================================================
# STEP 4: FORECAST NEXT 24 HOURS
# =========================================================================
print("\n[STEP 4] Forecasting next 24 hours...")

last_time = hourly["date_hour"].max()
future_hours = pd.date_range(start=last_time + pd.Timedelta(hours=1), periods=24, freq="h", tz="UTC")

# Precompute lookups
station_stats_dict = {}
for station in all_stations:
    sdata = hourly[hourly["police_station"] == station]
    station_stats_dict[str(station)] = {
        "avg_volume": float(sdata["violation_count"].mean()),
        "std_volume": float(sdata["violation_count"].std()) if len(sdata) > 1 else 0.0,
        "median_volume": float(sdata["violation_count"].median()),
        "peak_ratio": float(sdata["violation_count"].mean() / hourly.groupby("police_station")["violation_count"].mean().max()),
    }

station_hour_prof_dict = {(str(k[0]), k[1]): float(v) for k, v in
    hourly.groupby(["police_station", "hour"])["violation_count"].mean().to_dict().items()}
station_dow_prof_dict = {(str(k[0]), k[1]): float(v) for k, v in
    hourly.groupby(["police_station", "day_of_week"])["violation_count"].mean().to_dict().items()}

# Last EMA per (station, hour)
ema_last = {}
for station in all_stations:
    sdata = hourly[hourly["police_station"] == station].sort_values("date_hour")
    for h in range(24):
        h_data = sdata[sdata["hour"] == h]["ema_baseline"].dropna()
        ema_last[(str(station), h)] = float(h_data.iloc[-1]) if len(h_data) > 0 else 0.0

forecasts = []
for station in all_stations:
    station_str = str(station)
    if station_str in ["nan", "NaN", "None", ""]:
        continue

    try:
        station_enc = le_station.transform([station_str])[0]
    except Exception:
        continue

    station_data = hourly[hourly["police_station"] == station].sort_values("date_hour")
    stats = station_stats_dict.get(station_str, {})

    for fh in future_hours:
        hour = fh.hour
        dow = fh.dayofweek
        dom = fh.day
        is_wknd = 1 if dow >= 5 else 0
        is_peak = 1 if hour in [2, 3, 4, 5, 6] else 0

        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        dow_sin = np.sin(2 * np.pi * dow / 7)
        dow_cos = np.cos(2 * np.pi * dow / 7)

        s_avg = stats.get("avg_volume", 0)
        s_std = stats.get("std_volume", 0)
        s_med = stats.get("median_volume", 0)
        s_peak = stats.get("peak_ratio", 0)
        s_hour_prof = station_hour_prof_dict.get((station_str, hour), 0)
        s_dow_prof = station_dow_prof_dict.get((station_str, dow), 0)
        ema_val = ema_last.get((station_str, hour), 0.0)

        def get_lag(offset_hours):
            target_time = fh - pd.Timedelta(hours=offset_hours)
            match = station_data[station_data["date_hour"] == target_time]
            return float(match["violation_count"].values[0]) if len(match) > 0 else 0.0

        lag_1h = get_lag(1); lag_2h = get_lag(2); lag_3h = get_lag(3); lag_6h = get_lag(6)
        lag_24h = get_lag(24); lag_48h = get_lag(48); lag_72h = get_lag(72); lag_168h = get_lag(168)
        lag_336h = get_lag(336)

        lag_diff_24_48 = lag_24h - lag_48h
        lag_diff_168_336 = lag_168h - lag_336h

        recent_24h = station_data["violation_count"].tail(24)
        recent_3d = station_data["violation_count"].tail(72)
        recent_7d = station_data["violation_count"].tail(168)

        r24_avg = float(recent_24h.mean()) if len(recent_24h) > 0 else 0
        r24_std = float(recent_24h.std()) if len(recent_24h) > 1 else 0
        r3d_avg = float(recent_3d.mean()) if len(recent_3d) > 0 else 0
        r7d_avg = float(recent_7d.mean()) if len(recent_7d) > 0 else 0
        r7d_std = float(recent_7d.std()) if len(recent_7d) > 1 else 0

        same_hour_data = station_data[station_data["hour"] == hour]["violation_count"].tail(7)
        past_7d_avg_sh = float(same_hour_data.mean()) if len(same_hour_data) > 0 else 0
        past_7d_max_sh = float(same_hour_data.max()) if len(same_hour_data) > 0 else 0
        past_7d_std_sh = float(same_hour_data.std()) if len(same_hour_data) > 1 else 0

        same_hour_dow = station_data[
            (station_data["hour"] == hour) & (station_data["day_of_week"] == dow)
        ]["violation_count"].tail(4)
        past_4w_avg_shd = float(same_hour_dow.mean()) if len(same_hour_dow) > 0 else 0

        peak_x_station = is_peak * s_avg
        wknd_x_station = is_wknd * s_avg
        lag24_ratio = lag_24h / (s_avg + 0.1)
        ema_dev = lag_1h - ema_val

        features = np.array([[
            hour, dow, dom,
            hour_sin, hour_cos, dow_sin, dow_cos,
            is_wknd, is_peak,
            s_avg, s_std, s_med, s_peak, s_hour_prof, s_dow_prof,
            ema_val,
            lag_1h, lag_2h, lag_3h, lag_6h,
            lag_24h, lag_48h, lag_72h, lag_168h,
            lag_diff_24_48, lag_diff_168_336,
            r24_avg, r24_std, r3d_avg, r7d_avg, r7d_std,
            past_7d_avg_sh, past_7d_max_sh, past_7d_std_sh,
            past_4w_avg_shd,
            peak_x_station, wknd_x_station, lag24_ratio,
            ema_dev,
            station_enc,
        ]], dtype=np.float32)

        pred_log = model.predict(features)[0]
        pred = max(0, float(np.expm1(pred_log)))

        forecasts.append({
            "station": station_str,
            "hour": hour,
            "datetime": fh,
            "predicted_violation_count": round(pred, 2),
        })

forecast_df = pd.DataFrame(forecasts).sort_values("predicted_violation_count", ascending=False)

# =========================================================================
# STEP 5: VISUALIZATIONS
# =========================================================================
print("\n[STEP 5] Creating visualizations...")

# Chart 1: Hourly Heatmap
print("  Creating Chart 1: Hourly Heatmap...")
pivot = forecast_df.pivot_table(index="station", columns="hour", values="predicted_violation_count", aggfunc="sum")
pivot = pivot.loc[pivot.sum(axis=1).sort_values(ascending=False).index]
fig, ax = plt.subplots(figsize=(16, 20))
sns.heatmap(pivot, cmap="YlOrRd", linewidths=0.3, linecolor="white", ax=ax,
            cbar_kws={"label": "Predicted Violations", "shrink": 0.6}, annot=False)
ax.set_title("Predicted Violations - Next 24h by Station x Hour", fontsize=16, fontweight="bold", pad=15)
ax.set_xlabel("Hour of Day", fontsize=12); ax.set_ylabel("Police Station", fontsize=12)
ax.tick_params(axis="y", labelsize=8); ax.tick_params(axis="x", labelsize=10)
plt.tight_layout()
plt.savefig(CHART_DIR / "chart1_hourly_heatmap.png", dpi=150, bbox_inches="tight"); plt.close()
print(f"    Saved: {CHART_DIR / 'chart1_hourly_heatmap.png'}")

# Chart 2: Forecast vs Actual (Top 5)
print("  Creating Chart 2: Forecast vs Actual (Top 5)...")
top5_stations = station_metrics_df.sort_values("avg_actual", ascending=False).head(5)["station"].tolist()
fig, axes = plt.subplots(5, 1, figsize=(18, 20), sharex=True)
for ax, station in zip(axes, top5_stations):
    sdf = test_df[test_df["police_station"] == station].sort_values("date_hour")
    ax.plot(sdf["date_hour"], sdf["violation_count"], label="Actual", color="#6366f1", linewidth=1.2, alpha=0.8)
    ax.plot(sdf["date_hour"], sdf["predicted"], label="Predicted", color="#f43f5e", linewidth=1.2, alpha=0.8, linestyle="--")
    ax.fill_between(sdf["date_hour"], sdf["violation_count"], alpha=0.15, color="#6366f1")
    mae_s = mean_absolute_error(sdf["violation_count"], sdf["predicted"])
    rmse_s = np.sqrt(mean_squared_error(sdf["violation_count"], sdf["predicted"]))
    ax.set_title(f"{station} (MAE: {mae_s:.2f}, RMSE: {rmse_s:.2f})", fontsize=12, fontweight="bold")
    ax.legend(loc="upper right", fontsize=9); ax.set_ylabel("Violations/Hour", fontsize=10); ax.grid(True, alpha=0.3)
axes[-1].set_xlabel("Date/Hour", fontsize=11)
plt.suptitle("Hold-Out: Actual vs Predicted (Top 5 Stations)", fontsize=14, fontweight="bold", y=1.01)
plt.tight_layout()
plt.savefig(CHART_DIR / "chart2_forecast_vs_actual.png", dpi=150, bbox_inches="tight"); plt.close()
print(f"    Saved: {CHART_DIR / 'chart2_forecast_vs_actual.png'}")

# Chart 3: Peak Hour Bar Chart
print("  Creating Chart 3: Peak Hour Bar Chart...")
peak_hours_df = forecast_df.loc[forecast_df.groupby("station")["predicted_violation_count"].idxmax()].sort_values("predicted_violation_count", ascending=True)
fig, ax = plt.subplots(figsize=(12, 18))
colors = ["#f43f5e" if v > peak_hours_df["predicted_violation_count"].quantile(0.75) else "#6366f1"
          for v in peak_hours_df["predicted_violation_count"]]
bars = ax.barh(peak_hours_df["station"], peak_hours_df["predicted_violation_count"], color=colors, edgecolor="white", linewidth=0.5)
for bar, (_, row) in zip(bars, peak_hours_df.iterrows()):
    ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height() / 2,
            f'{int(row["hour"]):02d}:00', va="center", fontsize=8, color="#64748b", fontweight="bold")
ax.set_title("Peak Predicted Hour per Station (Next 24h)", fontsize=14, fontweight="bold", pad=15)
ax.set_xlabel("Predicted Violations", fontsize=11); ax.tick_params(axis="y", labelsize=8); ax.grid(True, axis="x", alpha=0.3)
plt.tight_layout()
plt.savefig(CHART_DIR / "chart3_peak_hour_bar.png", dpi=150, bbox_inches="tight"); plt.close()
print(f"    Saved: {CHART_DIR / 'chart3_peak_hour_bar.png'}")

# Chart 4: Residual Analysis
print("  Creating Chart 4: Residual Analysis...")
fig, axes = plt.subplots(1, 3, figsize=(20, 6))
residuals = y_test_raw - y_pred
axes[0].hist(residuals, bins=60, color="#6366f1", alpha=0.7, edgecolor="white")
axes[0].axvline(0, color="#f43f5e", linestyle="--", linewidth=2)
axes[0].set_title("Residual Distribution", fontsize=13, fontweight="bold")
axes[0].set_xlabel("Residual (Actual - Predicted)"); axes[0].set_ylabel("Frequency")
axes[1].scatter(y_test_raw, y_pred, alpha=0.1, s=8, color="#6366f1")
max_val = max(y_test_raw.max(), y_pred.max())
axes[1].plot([0, max_val], [0, max_val], color="#f43f5e", linestyle="--", linewidth=2, label="Perfect")
axes[1].set_title("Actual vs Predicted", fontsize=13, fontweight="bold")
axes[1].set_xlabel("Actual"); axes[1].set_ylabel("Predicted"); axes[1].legend()
hourly_res = test_df.copy(); hourly_res["residual"] = residuals
res_by_hour = hourly_res.groupby("hour")["residual"].agg(["mean", "std"]).reset_index()
axes[2].bar(res_by_hour["hour"], res_by_hour["mean"], yerr=res_by_hour["std"], color="#6366f1", alpha=0.7, capsize=3)
axes[2].axhline(0, color="#f43f5e", linestyle="--", linewidth=2)
axes[2].set_title("Mean Residual by Hour", fontsize=13, fontweight="bold")
axes[2].set_xlabel("Hour"); axes[2].set_ylabel("Mean Residual"); axes[2].set_xticks(range(24))
plt.suptitle("Residual Analysis", fontsize=15, fontweight="bold", y=1.03)
plt.tight_layout()
plt.savefig(CHART_DIR / "chart4_residual_analysis.png", dpi=150, bbox_inches="tight"); plt.close()
print(f"    Saved: {CHART_DIR / 'chart4_residual_analysis.png'}")

# =========================================================================
# STEP 6: SUMMARY
# =========================================================================
print("\n" + "=" * 80)
print("  SUMMARY (v2 - ENHANCED)")
print("=" * 80)
total_predicted = forecast_df["predicted_violation_count"].sum()
print(f"\n  Total predicted violations (next 24h): {total_predicted:,.0f}")
top3_forecast = forecast_df.head(3)
print(f"\n  Top 3 highest-risk station-hours:")
for _, row in top3_forecast.iterrows():
    print(f"    {row['station']:<25} {int(row['hour']):02d}:00  ->  {row['predicted_violation_count']:.1f} violations")
print(f"\n  Metrics:")
print(f"    MAE (overall):      {overall_mae:.4f}")
print(f"    RMSE (overall):     {overall_rmse:.4f}")
print(f"    Weighted MAE:       {weighted_mae:.4f}")
print(f"    Peak-Hour MAE:      {peak_mae:.4f}")
print(f"    Best iteration:     {model.best_iteration}")
print(f"    Features used:      {len(FEATURE_COLS)}")

# =========================================================================
# EXPORT MODEL ARTIFACTS
# =========================================================================
print("\n[EXPORT] Saving model artifacts...")

model.save_model(str(OUTPUT_DIR / "xgb_forecast_model.json"))
print(f"  Saved: {OUTPUT_DIR / 'xgb_forecast_model.json'}")

with open(OUTPUT_DIR / "forecast_preprocessing.pkl", "wb") as f:
    pickle.dump({
        "label_encoder_station": le_station,
        "feature_columns": FEATURE_COLS,
        "station_stats": station_stats_dict,
        "station_hour_profile": station_hour_prof_dict,
        "station_dow_profile": station_dow_prof_dict,
        "ema_last": {f"{k[0]}_{k[1]}": v for k, v in ema_last.items()},
        "use_log1p": True,
        "model_version": "v2_enhanced",
    }, f)
print(f"  Saved: {OUTPUT_DIR / 'forecast_preprocessing.pkl'}")

last_data = {}
for station in all_stations:
    sdata = hourly[hourly["police_station"] == station].sort_values("date_hour").tail(336)
    last_data[str(station)] = {
        "violation_counts": [int(x) for x in sdata["violation_count"].tolist()],
        "date_hours": [str(dt) for dt in sdata["date_hour"].tolist()],
    }

with open(OUTPUT_DIR / "forecast_last_data.json", "w") as f:
    json.dump({"last_datetime": str(hourly["date_hour"].max()), "stations": last_data, "model_version": "v2_enhanced"}, f)
print(f"  Saved: {OUTPUT_DIR / 'forecast_last_data.json'}")

# Also save the forecast data as JSON for the backend API to serve
forecast_api_data = {
    "generated_at": str(pd.Timestamp.now(tz="UTC")),
    "forecast_start": str(future_hours[0]),
    "forecast_end": str(future_hours[-1]),
    "model_version": "v2_enhanced",
    "metrics": {
        "overall_mae": round(float(overall_mae), 4),
        "overall_rmse": round(float(overall_rmse), 4),
        "peak_hour_mae": round(float(peak_mae), 4),
        "best_iteration": int(model.best_iteration),
        "n_features": len(FEATURE_COLS),
    },
    "forecasts": forecast_df[["station", "hour", "predicted_violation_count"]].to_dict(orient="records"),
    "station_metrics": {
        row["station"]: {"mae": round(float(row["mae"]), 4), "mape": row["mape"]}
        for _, row in station_metrics_df.iterrows()
    },
    "heatmap_data": [],
}

# Build heatmap data for frontend
for station in forecast_df["station"].unique():
    sdf = forecast_df[forecast_df["station"] == station]
    heatmap_row = {"station": station, "hours": {}}
    for _, row in sdf.iterrows():
        heatmap_row["hours"][str(int(row["hour"]))] = round(float(row["predicted_violation_count"]), 2)
    forecast_api_data["heatmap_data"].append(heatmap_row)

# Top stations for dispatch priority
top_dispatch = forecast_df.head(20)[["station", "hour", "predicted_violation_count"]].to_dict(orient="records")
forecast_api_data["dispatch_priority"] = top_dispatch

with open(OUTPUT_DIR / "forecast_api_data.json", "w") as f:
    json.dump(forecast_api_data, f, indent=2)
print(f"  Saved: {OUTPUT_DIR / 'forecast_api_data.json'}")

eval_metrics = {
    "model_version": "v2_enhanced",
    "overall_mae": round(float(overall_mae), 4),
    "overall_rmse": round(float(overall_rmse), 4),
    "weighted_mae": round(float(weighted_mae), 4),
    "peak_hour_mae": round(float(peak_mae), 4),
    "peak_hour_rmse": round(float(peak_rmse), 4),
    "best_iteration": int(model.best_iteration),
    "holdout_days": HOLDOUT_DAYS,
    "train_rows": int(len(train_df)),
    "test_rows": int(len(test_df)),
    "n_features": len(FEATURE_COLS),
    "feature_importances": {
        fname: round(float(imp), 4) for fname, imp in zip(FEATURE_COLS, model.feature_importances_)
    },
    "per_station_mae": {
        row["station"]: round(float(row["mae"]), 4) for _, row in station_metrics_df.iterrows()
    },
    "per_station_mape": {
        row["station"]: round(float(row["mape"]), 1)
        for _, row in station_metrics_df.iterrows() if row["mape"] is not None
    },
}
with open(OUTPUT_DIR / "forecast_eval_metrics.json", "w") as f:
    json.dump(eval_metrics, f, indent=2)
print(f"  Saved: {OUTPUT_DIR / 'forecast_eval_metrics.json'}")

print("\n[SUCCESS] Training pipeline v2 (enhanced) completed successfully.")
