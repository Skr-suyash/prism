"""
Audit Service — Enforcement Blindspot Detection (Feature 3).

Uses a pre-trained Isolation Forest to identify anomalous
operational buckets (police_station × hour_bin × violation_type).

Loads from JSON cache if available (instant), otherwise falls back
to full compute from CSV + .pkl model files.
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "datasets", "jan to may police violation_anonymized791b166.csv")
CACHE_DIR = Path(BASE_DIR) / "backend" / "cache"
MODELS_DIR = Path(BASE_DIR) / "backend" / "models"
LOCAL_TZ = "Asia/Kolkata"

# Feature order MUST match training pipeline exactly
FEATURE_COLS = ["volume_log", "sync_rate", "rejection_rate", "duplicate_rate"]


class AuditService:
    """In-memory store of blindspot audit data and loaded ML artifacts."""

    def __init__(self) -> None:
        self.scaler = None
        self.iso_forest = None
        self.quadrant_cache: list[dict] | None = None

    def initialize(self) -> None:
        """Load ML artifacts, then try cache; fall back to full compute."""
        self._load_models()

        if self._load_from_cache():
            print("[AuditService] Ready (loaded from cache).")
            return

        print("[AuditService] Cache not found, running full compute...")
        self.precompute_all()
        print("[AuditService] Ready.")

    # ── Model Loading ─────────────────────────────────────────────────────

    def _load_models(self) -> None:
        """Load the trained StandardScaler and IsolationForest from .pkl files."""
        scaler_path = MODELS_DIR / "blindspot_scaler.pkl"
        model_path = MODELS_DIR / "blindspot_isoforest.pkl"

        if not scaler_path.exists() or not model_path.exists():
            print("[AuditService] WARNING: Model files not found in backend/models/")
            return

        print("[AuditService] Loading Isolation Forest artifacts...")
        self.scaler = joblib.load(scaler_path)
        self.iso_forest = joblib.load(model_path)
        print("[AuditService] Models loaded successfully.")

    # ── Cache Loading ─────────────────────────────────────────────────────

    def _load_from_cache(self) -> bool:
        """Attempt to load the precomputed quadrant data from JSON cache."""
        cache_file = CACHE_DIR / "audit_quadrant.json"
        if not cache_file.exists():
            print("  Cache miss: audit_quadrant.json")
            return False

        print("[AuditService] Loading from cache...")
        with open(cache_file) as f:
            self.quadrant_cache = json.load(f)
        return True

    # ── Full Compute (Fallback) ───────────────────────────────────────────

    def precompute_all(self) -> None:
        """Aggregate raw data into operational buckets, score with Isolation Forest,
        and store the result in memory + write to cache."""
        if self.scaler is None or self.iso_forest is None:
            print("[AuditService] Cannot precompute — models not loaded.")
            return

        print("[AuditService] Loading dataset for aggregation...")
        df = pd.read_csv(DATASET_PATH)
        print(f"  Loaded {len(df):,} records")

        # --- Preprocessing (mirrors training script exactly) ---
        df["created_datetime"] = pd.to_datetime(df["created_datetime"], errors="coerce", format="mixed", utc=True).dt.tz_convert(LOCAL_TZ)
        df = df.dropna(subset=["police_station", "created_datetime", "violation_type"])

        # Hour bin in IST: 0=Night(0-5), 1=Morning(6-11), 2=Afternoon(12-17), 3=Evening(18-23)
        df["hour_bin"] = df["created_datetime"].dt.hour // 6

        # Standardize text
        df["validation_status"] = df["validation_status"].str.lower().fillna("unknown")
        df["data_sent_to_scita"] = df["data_sent_to_scita"].astype(bool)

        # Clean violation_type (extract primary violation before comma)
        df["violation_type"] = (
            df["violation_type"]
            .astype(str)
            .str.replace(r'\[|\]|"', "", regex=True)
            .str.split(",")
            .str[0]
            .str.strip()
        )

        # --- Binary flags ---
        df["is_synced"] = df["data_sent_to_scita"].astype(int)
        df["is_rejected"] = (df["validation_status"] == "rejected").astype(int)
        df["is_duplicate"] = (df["validation_status"] == "duplicate").astype(int)

        # --- Aggregate into operational buckets ---
        print("[AuditService] Aggregating operational buckets...")
        buckets_df = (
            df.groupby(["police_station", "hour_bin", "violation_type"])
            .agg(
                volume=("id", "count"),
                sync_rate=("is_synced", "mean"),
                rejection_rate=("is_rejected", "mean"),
                duplicate_rate=("is_duplicate", "mean"),
            )
            .reset_index()
        )

        # Filter for meaningful sample size
        buckets_df = buckets_df[buckets_df["volume"] >= 50].copy()
        print(f"  {len(buckets_df)} buckets with volume >= 50")

        # Log-transform volume
        buckets_df["volume_log"] = np.log1p(buckets_df["volume"])

        # --- Scale & Score ---
        X_scaled = self.scaler.transform(buckets_df[FEATURE_COLS])
        buckets_df["anomaly_score"] = self.iso_forest.score_samples(X_scaled) * -1
        buckets_df["is_blindspot"] = self.iso_forest.predict(X_scaled) == -1

        n_blindspots = buckets_df["is_blindspot"].sum()
        print(f"  Discovered {n_blindspots} blindspots out of {len(buckets_df)} buckets")

        # --- Build cache payload ---
        self.quadrant_cache = [
            {
                "station": str(row["police_station"]),
                "hour_bin": int(row["hour_bin"]),
                "violation": str(row["violation_type"]),
                "volume": int(row["volume"]),
                "sync_rate": round(float(row["sync_rate"]), 4),
                "rejection_rate": round(float(row["rejection_rate"]), 4),
                "duplicate_rate": round(float(row["duplicate_rate"]), 4),
                "anomaly_score": round(float(row["anomaly_score"]), 4),
                "is_blindspot": bool(row["is_blindspot"]),
            }
            for _, row in buckets_df.iterrows()
        ]

        # Write to cache for next startup
        self._save_cache()

    def _save_cache(self) -> None:
        """Write quadrant data to JSON cache atomically."""
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path = CACHE_DIR / "audit_quadrant.json"
        tmp = path.with_suffix(".tmp")
        with open(tmp, "w") as f:
            json.dump(self.quadrant_cache, f)
        tmp.replace(path)
        print(f"  [OK] Wrote audit_quadrant.json ({os.path.getsize(path) / 1024:.0f} KB)")

    # ── Real-time Inference ───────────────────────────────────────────────

    def infer_new_bucket(
        self,
        sync_rate: float,
        rejection_rate: float,
        duplicate_rate: float,
        volume: int,
    ) -> dict:
        """Score a single new operational bucket against the Isolation Forest.

        Feature order: ['volume_log', 'sync_rate', 'rejection_rate', 'duplicate_rate']
        """
        if self.scaler is None or self.iso_forest is None:
            raise RuntimeError("Audit models not loaded.")

        volume_log = float(np.log1p(volume))
        features = np.array([[volume_log, sync_rate, rejection_rate, duplicate_rate]])
        scaled = self.scaler.transform(features)

        anomaly_score = float(self.iso_forest.score_samples(scaled)[0]) * -1
        prediction = int(self.iso_forest.predict(scaled)[0])
        is_blindspot = prediction == -1

        return {
            "anomaly_score": round(anomaly_score, 4),
            "is_blindspot": is_blindspot,
        }

    # ── API Methods ───────────────────────────────────────────────────────

    def get_quadrant(self) -> list[dict]:
        """Return the precomputed quadrant data."""
        return self.quadrant_cache or []
