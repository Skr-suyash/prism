"""
Misclassification Service — Vehicle Type Misclassification Pattern.

Loads from JSON cache files if available, otherwise computes from DataFrame.
"""

import json
import os
from pathlib import Path

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = Path(BASE_DIR) / "backend" / "cache"


class MisclassificationService:
    def __init__(self):
        self.summary_cache = None
        self.confusion_matrix_cache = None
        self.temporal_cache = None
        self.station_cache = None

    def initialize(self, df: pd.DataFrame = None):
        """Try cache first. If unavailable and df is provided, compute from df."""
        if self._load_from_cache():
            print("[MisclassificationService] Ready (loaded from cache).")
            return

        if df is None:
            print("[MisclassificationService] No cache and no DataFrame provided!")
            return

        print("[MisclassificationService] Cache not found, computing from DataFrame...")
        self._compute_from_df(df)
        print("[MisclassificationService] Ready.")

    def _load_from_cache(self) -> bool:
        required = [
            "misclass_summary.json", "misclass_confusion.json",
            "misclass_temporal.json", "misclass_stations.json"
        ]
        for fname in required:
            if not (CACHE_DIR / fname).exists():
                return False

        print("[MisclassificationService] Loading from cache...")
        with open(CACHE_DIR / "misclass_summary.json") as f:
            self.summary_cache = json.load(f)
        with open(CACHE_DIR / "misclass_confusion.json") as f:
            self.confusion_matrix_cache = json.load(f)
        with open(CACHE_DIR / "misclass_temporal.json") as f:
            self.temporal_cache = json.load(f)
        with open(CACHE_DIR / "misclass_stations.json") as f:
            self.station_cache = json.load(f)
        return True

    def _compute_from_df(self, df: pd.DataFrame):
        """Original compute logic — only used when cache is missing."""
        if 'vehicle_type' not in df.columns or 'vehicle_class' not in df.columns:
            print("[MisclassificationService] Missing required columns!")
            return

        vt = df['vehicle_type'].astype(str).str.strip().str.upper()
        uvt = df['vehicle_class'].astype(str).str.strip().str.upper()

        has_update_mask = df['vehicle_class'].notna() & (df['vehicle_class'] != '') & (uvt != 'NAN') & (uvt != 'NULL')
        records_with_update = has_update_mask.sum()

        mismatch_mask = has_update_mask & (vt != uvt)
        mismatches = mismatch_mask.sum()

        mismatch_rate = round(float(mismatches / records_with_update * 100), 2) if records_with_update > 0 else 0.0

        mismatch_df = df[mismatch_mask].copy()
        mismatch_df['from_to'] = vt[mismatch_mask] + " → " + uvt[mismatch_mask]
        top_swaps = mismatch_df['from_to'].value_counts().head(5).to_dict()

        self.summary_cache = {
            "total_records": int(len(df)),
            "records_updated": int(records_with_update),
            "mismatches": int(mismatches),
            "mismatch_rate": mismatch_rate,
            "top_swaps": [{"swap": k, "count": v} for k, v in top_swaps.items()]
        }

        cm = mismatch_df.groupby([vt[mismatch_mask], uvt[mismatch_mask]]).size().reset_index(name='count')
        cm.columns = ['from_type', 'to_type', 'count']
        self.confusion_matrix_cache = cm.to_dict(orient='records')

        mismatch_df['hour'] = mismatch_df['created_datetime'].dt.hour
        df_has_update = df[has_update_mask].copy()
        df_has_update['hour'] = df_has_update['created_datetime'].dt.hour

        total_by_hour = df_has_update.groupby('hour').size()
        mismatch_by_hour = mismatch_df.groupby('hour').size()

        temporal = []
        for h in range(24):
            tot = int(total_by_hour.get(h, 0))
            err = int(mismatch_by_hour.get(h, 0))
            rate = round(float(err / tot * 100), 2) if tot > 0 else 0.0
            temporal.append({"hour": h, "total": tot, "corrections": err, "rate": rate})
        self.temporal_cache = temporal

        total_by_station = df_has_update.groupby('police_station').size()
        mismatch_by_station = mismatch_df.groupby('police_station').size()

        stations = []
        for station in mismatch_by_station.index:
            tot = int(total_by_station.get(station, 0))
            err = int(mismatch_by_station.get(station, 0))
            if tot > 50:
                rate = round(float(err / tot * 100), 2)
                stations.append({"station": str(station), "total": tot, "corrections": err, "rate": rate})

        stations.sort(key=lambda x: x['rate'], reverse=True)
        self.station_cache = stations[:50]

    def get_summary(self):
        return self.summary_cache

    def get_confusion_matrix(self):
        return self.confusion_matrix_cache

    def get_temporal(self):
        return self.temporal_cache

    def get_stations(self):
        return self.station_cache
