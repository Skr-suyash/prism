"""
Component B — XGBoost Escalation Propensity Inference.

Loads the pretrained v2.3 model and preprocessing artifacts, engineers
all 26 features to exactly match the training script, and runs inference.

Geospatial enrichment:
  - Loads bangalore_pois.geojson at startup, projects to EPSG:3857
  - Builds a scipy cKDTree for O(log n) nearest-neighbour lookup
  - Adds `nearest_poi_type_encoded` and `distance_to_poi` columns
"""

import json
import os
import pickle
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
BASE_DIR = Path(__file__).resolve().parent.parent.parent
POI_DATA_PATH = BASE_DIR / "datasets" / "bangalore_pois.geojson"

BENGALURU_LAT, BENGALURU_LON = 12.9766, 77.5713

# Default fallback coordinates (Bengaluru centre) — same as training script
DEFAULT_LAT, DEFAULT_LON = 12.9716, 77.5946


class POISpatialIndex:
    """Pre-built spatial index over Point-of-Interest data for fast lookups.

    Uses pyproj for coordinate projection and scipy.spatial.cKDTree for
    nearest-neighbour queries.  Falls back gracefully if any geospatial
    library is unavailable.
    """

    def __init__(self) -> None:
        self.tree = None
        self.poi_types: np.ndarray | None = None
        self.transformer = None
        self.ready = False

    def build(self, geojson_path: Path) -> None:
        """Load GeoJSON, project to EPSG:3857, and build a cKDTree."""
        try:
            import geopandas as gpd
            from scipy.spatial import cKDTree
            from pyproj import Transformer

            if not geojson_path.exists():
                logger.warning("POI GeoJSON not found at %s — spatial enrichment disabled.", geojson_path)
                return

            logger.info("Loading POI data from %s ...", geojson_path)
            gdf = gpd.read_file(str(geojson_path))

            if "poi_type" not in gdf.columns:
                gdf["poi_type"] = "UNKNOWN"

            # Project to EPSG:3857 (metres) for distance calculation
            gdf = gdf.to_crs("EPSG:3857")

            coords = np.column_stack([gdf.geometry.x.values, gdf.geometry.y.values])
            self.tree = cKDTree(coords)
            self.poi_types = gdf["poi_type"].fillna("UNKNOWN").values.astype(str)

            # Build a reusable transformer: EPSG:4326 → EPSG:3857
            self.transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

            self.ready = True
            logger.info("POI spatial index built — %d POIs indexed.", len(coords))

        except ImportError as exc:
            logger.warning("Geospatial libraries missing (%s) — spatial enrichment disabled.", exc)
        except Exception as exc:
            logger.warning("POI spatial index build failed (%s) — falling back to defaults.", exc)

    def query_single(self, lat: float, lon: float) -> tuple[str, float]:
        """Return (poi_type, distance_metres) for a single WGS-84 point."""
        if not self.ready:
            return "UNKNOWN", -1.0
        try:
            x, y = self.transformer.transform(lon, lat)
            dist, idx = self.tree.query([x, y])
            return str(self.poi_types[idx]), float(dist)
        except Exception:
            return "UNKNOWN", -1.0

    def query_batch(self, lats: np.ndarray, lons: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Return (poi_types, distances) arrays for batch WGS-84 points."""
        n = len(lats)
        default_types = np.full(n, "UNKNOWN", dtype=object)
        default_dists = np.full(n, -1.0, dtype=np.float64)

        if not self.ready:
            return default_types, default_dists

        try:
            xs, ys = self.transformer.transform(lons, lats)
            coords = np.column_stack([xs, ys])
            dists, idxs = self.tree.query(coords)
            types = self.poi_types[idxs]
            return types, dists.astype(np.float64)
        except Exception as exc:
            logger.warning("Batch POI query failed (%s) — returning defaults.", exc)
            return default_types, default_dists


class EscalationModel:
    """Stateful wrapper around the pretrained XGBoost model and its artifacts."""

    def __init__(self) -> None:
        self.model: xgb.XGBClassifier | None = None
        self.artifacts: dict | None = None
        self.feature_cols: list[str] | None = None
        self.poi_index = POISpatialIndex()

    def load(self) -> None:
        with open(MODELS_DIR / "feature_config.json") as f:
            self.feature_cols = json.load(f)["feature_columns"]
        with open(MODELS_DIR / "preprocessing_artifacts.pkl", "rb") as f:
            self.artifacts = pickle.load(f)
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(MODELS_DIR / "xgb_escalation_model.json"))

        # Build the spatial index for POI enrichment
        self.poi_index.build(POI_DATA_PATH)

    # ── Geospatial enrichment ─────────────────────────────────────────────

    def _enrich_poi_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add nearest_poi_type and distance_to_poi columns to a DataFrame."""
        lats = df["latitude"].fillna(DEFAULT_LAT).values.astype(np.float64)
        lons = df["longitude"].fillna(DEFAULT_LON).values.astype(np.float64)

        types, dists = self.poi_index.query_batch(lats, lons)
        df["nearest_poi_type"] = types
        df["distance_to_poi"] = dists
        return df

    def _enrich_poi_single(self, record: dict) -> dict:
        """Add nearest_poi_type and distance_to_poi to a single record dict."""
        lat = float(record.get("latitude", DEFAULT_LAT) or DEFAULT_LAT)
        lon = float(record.get("longitude", DEFAULT_LON) or DEFAULT_LON)
        poi_type, dist = self.poi_index.query_single(lat, lon)
        record["nearest_poi_type"] = poi_type
        record["distance_to_poi"] = dist
        return record

    # ── Feature engineering ───────────────────────────────────────────────

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

        # Label-encode low-cardinality categoricals (including nearest_poi_type)
        for col in ["primary_violation", "vehicle_type_clean", "nearest_poi_type"]:
            le = le_map.get(col)
            if le is None:
                # Safety: if encoder is missing, use 0
                df[f"{col}_encoded"] = 0
                continue
            raw = df[col].fillna("UNKNOWN").astype(str)
            known = set(le.classes_)
            fallback = le.classes_[0]
            safe = raw.apply(lambda x, _known=known, _fallback=fallback: x if x in _known else (
                "UNKNOWN" if "UNKNOWN" in _known else _fallback
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

    # ── Prediction entry-points ───────────────────────────────────────────

    def predict_batch(
        self, df: pd.DataFrame, global_freqs: dict | None = None
    ) -> pd.DataFrame:
        df = self._enrich_poi_batch(df)
        df = self._engineer_features(df, global_freqs)
        X = df[self.feature_cols].values.astype(np.float32)
        df["escalation_propensity"] = self.model.predict_proba(X)[:, 1]
        return df

    def predict_single(self, record: dict, global_freqs: dict) -> float:
        record = self._enrich_poi_single(record)
        df = pd.DataFrame([record])
        df = self._engineer_features(df, global_freqs)
        X = df[self.feature_cols].values.astype(np.float32)
        return float(self.model.predict_proba(X)[0, 1])
