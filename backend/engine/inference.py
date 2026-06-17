"""
Component B — XGBoost Escalation Propensity Inference.

Loads the pretrained v2.3 model and preprocessing artifacts, engineers
all 24 features to exactly match the training script, and runs inference.
"""

import json
import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
BENGALURU_LAT, BENGALURU_LON = 12.9766, 77.5713


class EscalationModel:
    """Stateful wrapper around the pretrained XGBoost model and its artifacts."""

    def __init__(self) -> None:
        self.model: xgb.XGBClassifier | None = None
        self.artifacts: dict | None = None
        self.feature_cols: list[str] | None = None

    def load(self) -> None:
        with open(MODELS_DIR / "feature_config.json") as f:
            self.feature_cols = json.load(f)["feature_columns"]
        with open(MODELS_DIR / "preprocessing_artifacts.pkl", "rb") as f:
            self.artifacts = pickle.load(f)
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(MODELS_DIR / "xgb_escalation_model.json"))

    def _engineer_features(
        self, df: pd.DataFrame, global_freqs: dict | None = None
    ) -> pd.DataFrame:
        le_map = self.artifacts["label_encoders"]
        te_lookups = self.artifacts["target_encoding_lookups"]
        global_mean = self.artifacts["target_encoding_global_mean"]

        hour = df["hour"].fillna(0)
        dow = df["day_of_week"].fillna(0)

        df["hour_sin"] = np.sin(2 * np.pi * hour / 24)
        df["hour_cos"] = np.cos(2 * np.pi * hour / 24)
        df["dow_sin"] = np.sin(2 * np.pi * dow / 7)
        df["dow_cos"] = np.cos(2 * np.pi * dow / 7)

        df["is_peak_hour"] = (hour.between(7, 9) | hour.between(17, 19)).astype(int)
        df["is_night"] = hour.between(0, 4).astype(int)
        df["is_weekend"] = (dow >= 5).astype(int)

        df["hour_bin"] = pd.cut(
            hour,
            bins=[0, 5, 10, 14, 17, 20, 24],
            labels=[0, 1, 2, 3, 4, 5],
            right=False,
            include_lowest=True,
        )
        df["hour_bin"] = df["hour_bin"].astype(float).fillna(-1).astype(int)

        df["peak_x_junction"] = df["is_peak_hour"] * df["is_junction"]
        df["weekend_x_night"] = df["is_weekend"] * df["is_night"]

        for col in ["primary_violation", "vehicle_type_clean"]:
            le = le_map[col]
            raw = df[col].fillna("UNKNOWN").astype(str)
            known = set(le.classes_)
            fallback = le.classes_[0]
            safe = raw.apply(lambda x: x if x in known else (
                "UNKNOWN" if "UNKNOWN" in known else fallback
            ))
            df[f"{col}_encoded"] = le.transform(safe)

        for col in ["police_station", "vehicle_type_clean", "primary_violation"]:
            col_name = f"{col.replace('_clean', '').replace('primary_', '')}_freq"
            if global_freqs and col in global_freqs:
                df[col_name] = df[col].map(global_freqs[col]).fillna(0)
            else:
                freq = df[col].value_counts(normalize=True)
                df[col_name] = df[col].map(freq).fillna(0)

        for col in ["police_station", "center_code"]:
            lookup = te_lookups.get(col, {})
            df[f"{col}_te"] = df[col].astype(str).map(lookup).fillna(global_mean)

        df["dist_from_center"] = np.sqrt(
            (df["latitude"] - BENGALURU_LAT) ** 2
            + (df["longitude"] - BENGALURU_LON) ** 2
        )

        return df

    def predict_batch(
        self, df: pd.DataFrame, global_freqs: dict | None = None
    ) -> pd.DataFrame:
        df = self._engineer_features(df, global_freqs)
        X = df[self.feature_cols].values.astype(np.float32)
        df["escalation_propensity"] = self.model.predict_proba(X)[:, 1]
        return df

    def predict_single(self, record: dict, global_freqs: dict) -> float:
        df = pd.DataFrame([record])
        df = self._engineer_features(df, global_freqs)
        X = df[self.feature_cols].values.astype(np.float32)
        return float(self.model.predict_proba(X)[0, 1])
