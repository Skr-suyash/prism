"""
Priority Service — Core business logic orchestrator.

Handles:
  1. Startup: load from JSON cache (fast) OR full compute (slow fallback)
  2. Zone aggregation & rank flip computation
  3. Heatmap sampling
  4. Single-violation real-time scoring
"""

import ast
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from backend.engine.inference import EscalationModel
from backend.engine.rules import compute_congestion_impact, compute_single

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "datasets", "jan to may police violation_anonymized791b166.csv")
CACHE_DIR = Path(BASE_DIR) / "backend" / "cache"
MAX_HEATMAP_POINTS = 15_000

COLUMNS = [
    'id', 'latitude', 'longitude', 'address', 'device_id', 'vehicle_type', 'brand',
    'violation_type', 'offence_code', 'created_datetime', 'col10', 'updated_datetime',
    'developer_id', 'user_id', 'center_code', 'police_station', 'is_active',
    'junction_name', 'col18', 'col19', 'col20', 'vehicle_class', 'validation_status', 'approved_datetime'
]


def _safe_parse_json(val):
    if pd.isna(val):
        return []
    try:
        parsed = ast.literal_eval(val)
        return parsed if isinstance(parsed, list) else [parsed]
    except (ValueError, SyntaxError):
        items = re.findall(r'"([^"]*)"', str(val))
        return items if items else [str(val)]


class PriorityService:
    """In-memory store of all scored data and the loaded model."""

    def __init__(self) -> None:
        self.model = EscalationModel()
        self.df: pd.DataFrame | None = None
        self.zone_cache: list[dict] | None = None
        self.heatmap_cache: list[dict] | None = None
        self.hourly_cache: dict | None = None
        self.metrics_cache: dict | None = None
        self.global_freqs: dict = {}

    def initialize(self) -> None:
        """Try loading from cache first, fall back to full compute."""
        print("[PriorityService] Loading model artifacts ...")
        self.model.load()

        if self._load_from_cache():
            print("[PriorityService] Ready (loaded from cache).")
            return

        print("[PriorityService] Cache not found, running full compute...")
        self._full_compute()
        print("[PriorityService] Ready.")

    def _load_from_cache(self) -> bool:
        """Attempt to load all payloads from JSON cache files."""
        required = [
            "priority_zones.json", "priority_heatmap.json",
            "priority_hourly.json", "priority_metrics.json",
            "priority_global_freqs.json"
        ]
        for fname in required:
            if not (CACHE_DIR / fname).exists():
                print(f"  Cache miss: {fname}")
                return False

        print("[PriorityService] Loading from cache...")
        with open(CACHE_DIR / "priority_zones.json") as f:
            self.zone_cache = json.load(f)
        with open(CACHE_DIR / "priority_heatmap.json") as f:
            self.heatmap_cache = json.load(f)
        with open(CACHE_DIR / "priority_hourly.json") as f:
            self.hourly_cache = json.load(f)
        with open(CACHE_DIR / "priority_metrics.json") as f:
            self.metrics_cache = json.load(f)
        with open(CACHE_DIR / "priority_global_freqs.json") as f:
            self.global_freqs = json.load(f)
        return True

    def _full_compute(self) -> None:
        """Full compute path (original logic). Only used if cache is missing."""
        print("[PriorityService] Loading dataset ...")
        df = pd.read_csv(DATASET_PATH, names=COLUMNS, header=0)
        print(f"  Loaded {len(df):,} records")

        df = self._preprocess(df)
        print("[PriorityService] Computing Component A (congestion impact) ...")
        df = compute_congestion_impact(df)

        print("[PriorityService] Computing global frequencies ...")
        self.global_freqs = {
            "police_station": df["police_station"].value_counts(normalize=True).to_dict(),
            "vehicle_type_clean": df["vehicle_type_clean"].value_counts(normalize=True).to_dict(),
            "primary_violation": df["primary_violation"].value_counts(normalize=True).to_dict(),
        }

        print("[PriorityService] Computing Component B (escalation propensity) ...")
        df = self.model.predict_batch(df, self.global_freqs)

        print("[PriorityService] Computing operational priority ...")
        df["operational_priority"] = df["congestion_impact"] * (1.0 - df["escalation_propensity"])

        self.df = df
        self._build_zone_cache()
        self._build_heatmap_cache()
        self._build_hourly_cache()
        self._build_metrics_cache()

    def _preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        print("[PriorityService] Preprocessing ...")
        df["created_datetime"] = pd.to_datetime(df["created_datetime"], errors="coerce", utc=True)
        df["hour"] = df["created_datetime"].dt.hour
        df["day_of_week"] = df["created_datetime"].dt.dayofweek
        df["month"] = df["created_datetime"].dt.month
        df["is_weekend"] = (df["day_of_week"].fillna(-1) >= 5).astype(int)

        df["violation_type_list"] = df["violation_type"].apply(_safe_parse_json)
        df["offence_code_list"] = df["offence_code"].apply(_safe_parse_json)
        df["n_violations"] = df["violation_type_list"].apply(len)

        df["primary_violation"] = df["violation_type_list"].apply(
            lambda x: x[0].strip().upper() if len(x) > 0 else "UNKNOWN"
        )
        df["primary_offence_code"] = df["offence_code_list"].apply(
            lambda x: int(x[0]) if len(x) > 0 and str(x[0]).isdigit() else -1
        )
        df["vehicle_type_clean"] = df["vehicle_type"].fillna("UNKNOWN").str.strip().str.upper()
        df["is_junction"] = (df["junction_name"].fillna("UNKNOWN") != "No Junction").astype(int)
        df["center_code"] = df["center_code"].fillna(-1).astype(int)
        return df

    def _build_zone_cache(self) -> None:
        z = self.df.groupby("police_station").agg(
            count=("id", "count"),
            lat=("latitude", "mean"),
            lng=("longitude", "mean"),
            mean_priority=("operational_priority", "mean"),
            total_priority=("operational_priority", "sum"),
            mean_congestion=("congestion_impact", "mean"),
            mean_propensity=("escalation_propensity", "mean"),
            junction_pct=("is_junction", "mean"),
        ).reset_index()
        z["count_rank"] = z["count"].rank(ascending=False).astype(int)
        z["priority_rank"] = z["total_priority"].rank(ascending=False).astype(int)
        z["rank_change"] = z["count_rank"] - z["priority_rank"]
        self.zone_cache = z.round(4).to_dict(orient="records")

    def _build_heatmap_cache(self) -> None:
        df = self.df
        top = df.nlargest(1000, "operational_priority")
        remaining = max(0, MAX_HEATMAP_POINTS - len(top))
        if remaining > 0 and remaining < len(df):
            rest = df.drop(top.index).sample(n=remaining, random_state=42)
            sample = pd.concat([top, rest])
        else:
            sample = df.copy()

        mn, mx = sample["operational_priority"].min(), sample["operational_priority"].max()
        sample["priority_norm"] = (sample["operational_priority"] - mn) / (mx - mn) if mx > mn else 0.5

        self.heatmap_cache = [
            {
                "lat": float(r["latitude"]),
                "lng": float(r["longitude"]),
                "hour": int(r["hour"]) if pd.notna(r["hour"]) else 0,
                "vehicle": str(r["vehicle_type_clean"]),
                "violation": str(r["primary_violation"]),
                "zone": str(r["police_station"]),
                "priority": round(float(r["operational_priority"]), 4),
                "priority_norm": round(float(r["priority_norm"]), 4),
            }
            for _, r in sample.iterrows()
        ]

    def _build_hourly_cache(self) -> None:
        h = self.df.groupby("hour").agg(
            count=("id", "count"),
            mean_priority=("operational_priority", "mean"),
        ).reset_index()
        self.hourly_cache = {
            "hours": h["hour"].tolist(),
            "counts": [int(x) for x in h["count"].tolist()],
            "priority": [round(float(x), 4) for x in h["mean_priority"].tolist()],
        }

    def _build_metrics_cache(self) -> None:
        ci_threshold = self.df["congestion_impact"].quantile(0.75)
        ep_threshold = self.df["escalation_propensity"].quantile(0.25)
        ignored = self.df[
            (self.df["congestion_impact"] >= ci_threshold)
            & (self.df["escalation_propensity"] <= ep_threshold)
        ]
        self.metrics_cache = {
            "total_records": len(self.df),
            "zones_tracked": int(self.df["police_station"].nunique()),
            "ignored_high_impact": len(ignored),
            "mean_congestion": round(float(self.df["congestion_impact"].mean()), 4),
            "mean_propensity": round(float(self.df["escalation_propensity"].mean()), 4),
            "mean_priority": round(float(self.df["operational_priority"].mean()), 4),
        }

    # ── API methods ────────────────────────────────────────────────────────

    def get_zones(self) -> list[dict]:
        return self.zone_cache

    def get_rank_flip(self, top_n: int = 10) -> list[dict]:
        zones = self.zone_cache
        sorted_zones = sorted(zones, key=lambda z: abs(z.get("rank_change", 0)), reverse=True)
        return sorted_zones[:top_n]

    def get_metrics(self) -> dict:
        return self.metrics_cache

    def get_heatmap(self, hour: int | None = None) -> list[dict]:
        if hour is not None:
            return [p for p in self.heatmap_cache if p["hour"] == hour]
        return self.heatmap_cache

    def get_zone_circles(self) -> list[dict]:
        zones = self.zone_cache
        priorities = [z["total_priority"] for z in zones]
        mn, mx = min(priorities), max(priorities)
        result = []
        for z in zones:
            z_copy = dict(z)
            z_copy["priority_norm"] = round((z["total_priority"] - mn) / (mx - mn), 4) if mx > mn else 0.5
            result.append(z_copy)
        return result

    def get_hourly(self) -> dict:
        return self.hourly_cache

    def score_single(self, record: dict) -> dict:
        record.setdefault("vehicle_type_clean", str(record.get("vehicle_type", "UNKNOWN")).strip().upper())
        record.setdefault("primary_violation", str(record.get("violation_type", "UNKNOWN")).strip().upper())
        record.setdefault("is_junction", 0 if str(record.get("junction_name", "No Junction")).strip() == "No Junction" else 1)
        record.setdefault("n_violations", 1)
        record.setdefault("center_code", int(record.get("center_code", -1)))

        ci = compute_single(record)
        propensity = self.model.predict_single(record, self.global_freqs)
        priority = ci * (1.0 - propensity)

        return {
            "congestion_impact": round(ci, 4),
            "escalation_propensity": round(propensity, 4),
            "operational_priority": round(priority, 4),
        }
