"""
Precompute Script — Runs the full analytics pipeline once and writes
all API-ready payloads to JSON files in backend/cache/.

Usage:
    python precompute.py

This must be run:
  - Once after initial setup
  - Whenever the raw CSV dataset is updated
  - Via the /admin/recompute API endpoint
"""

import ast
import json
import os
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd

# ── Configuration ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "datasets" / "jan to may police violation_anonymized791b166.csv"
CACHE_DIR = BASE_DIR / "backend" / "cache"
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


def save_json(data, filename):
    """Atomically write JSON to cache dir."""
    path = CACHE_DIR / filename
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f)
    tmp.replace(path)
    print(f"    [OK] Wrote {path.name} ({os.path.getsize(path) / 1024:.0f} KB)")


def run_precompute():
    """Execute the full precompute pipeline."""
    total_start = time.time()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # ── Phase 1: Load & Preprocess ─────────────────────────────────────────
    t = time.time()
    print("\n[Phase 1] Loading dataset...")
    df = pd.read_csv(DATASET_PATH, names=COLUMNS)
    print(f"  Loaded {len(df):,} records in {time.time() - t:.1f}s")

    t = time.time()
    print("[Phase 1] Preprocessing...")
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
    print(f"  Done in {time.time() - t:.1f}s")

    # ── Phase 2: Component A (Congestion Impact) ───────────────────────────
    t = time.time()
    print("[Phase 2] Computing Component A (congestion impact)...")
    from backend.engine.rules import compute_congestion_impact
    df = compute_congestion_impact(df)
    print(f"  Done in {time.time() - t:.1f}s")

    # ── Phase 3: Component B (XGBoost Escalation Propensity) ───────────────
    t = time.time()
    print("[Phase 3] Loading XGBoost model & computing Component B...")
    from backend.engine.inference import EscalationModel
    model = EscalationModel()
    model.load()

    global_freqs = {
        "police_station": df["police_station"].value_counts(normalize=True).to_dict(),
        "vehicle_type_clean": df["vehicle_type_clean"].value_counts(normalize=True).to_dict(),
        "primary_violation": df["primary_violation"].value_counts(normalize=True).to_dict(),
    }
    df = model.predict_batch(df, global_freqs)
    df["operational_priority"] = df["congestion_impact"] * (1.0 - df["escalation_propensity"])
    print(f"  Done in {time.time() - t:.1f}s")

    # Save global_freqs for real-time scoring
    save_json(global_freqs, "priority_global_freqs.json")

    # ── Phase 4: Priority Service Caches ───────────────────────────────────
    t = time.time()
    print("[Phase 4] Building Priority Service caches...")

    # Zone aggregation
    z = df.groupby("police_station").agg(
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
    save_json(z.round(4).to_dict(orient="records"), "priority_zones.json")

    # Heatmap sample
    top = df.nlargest(1000, "operational_priority")
    remaining = max(0, MAX_HEATMAP_POINTS - len(top))
    if remaining > 0 and remaining < len(df):
        rest = df.drop(top.index).sample(n=remaining, random_state=42)
        sample = pd.concat([top, rest])
    else:
        sample = df.copy()
    mn, mx = sample["operational_priority"].min(), sample["operational_priority"].max()
    sample["priority_norm"] = (sample["operational_priority"] - mn) / (mx - mn) if mx > mn else 0.5
    heatmap = [
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
    save_json(heatmap, "priority_heatmap.json")

    # Hourly
    h = df.groupby("hour").agg(count=("id", "count"), mean_priority=("operational_priority", "mean")).reset_index()
    hourly = {
        "hours": h["hour"].tolist(),
        "counts": [int(x) for x in h["count"].tolist()],
        "priority": [round(float(x), 4) for x in h["mean_priority"].tolist()],
    }
    save_json(hourly, "priority_hourly.json")

    # Metrics
    ci_threshold = df["congestion_impact"].quantile(0.75)
    ep_threshold = df["escalation_propensity"].quantile(0.25)
    ignored = df[(df["congestion_impact"] >= ci_threshold) & (df["escalation_propensity"] <= ep_threshold)]
    metrics = {
        "total_records": len(df),
        "zones_tracked": int(df["police_station"].nunique()),
        "ignored_high_impact": len(ignored),
        "mean_congestion": round(float(df["congestion_impact"].mean()), 4),
        "mean_propensity": round(float(df["escalation_propensity"].mean()), 4),
        "mean_priority": round(float(df["operational_priority"].mean()), 4),
    }
    save_json(metrics, "priority_metrics.json")
    print(f"  Done in {time.time() - t:.1f}s")

    # ── Phase 5: Misclassification Service Caches ──────────────────────────
    t = time.time()
    print("[Phase 5] Building Misclassification Service caches...")

    if 'vehicle_type' in df.columns and 'vehicle_class' in df.columns:
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

        save_json({
            "total_records": int(len(df)),
            "records_updated": int(records_with_update),
            "mismatches": int(mismatches),
            "mismatch_rate": mismatch_rate,
            "top_swaps": [{"swap": k, "count": v} for k, v in top_swaps.items()]
        }, "misclass_summary.json")

        cm = mismatch_df.groupby([vt[mismatch_mask], uvt[mismatch_mask]]).size().reset_index(name='count')
        cm.columns = ['from_type', 'to_type', 'count']
        save_json(cm.to_dict(orient='records'), "misclass_confusion.json")

        mismatch_df['hour'] = mismatch_df['created_datetime'].dt.hour
        df_has_update = df[has_update_mask].copy()
        df_has_update['hour'] = df_has_update['created_datetime'].dt.hour
        total_by_hour = df_has_update.groupby('hour').size()
        mismatch_by_hour = mismatch_df.groupby('hour').size()
        temporal = []
        for hr in range(24):
            tot = int(total_by_hour.get(hr, 0))
            err = int(mismatch_by_hour.get(hr, 0))
            rate = round(float(err / tot * 100), 2) if tot > 0 else 0.0
            temporal.append({"hour": hr, "total": tot, "corrections": err, "rate": rate})
        save_json(temporal, "misclass_temporal.json")

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
        save_json(stations[:50], "misclass_stations.json")
    else:
        print("  ⚠ Missing vehicle_type or vehicle_class columns, skipping misclass cache.")

    print(f"  Done in {time.time() - t:.1f}s")

    # ── Phase 6: Network Service Caches (K-Means + NetworkX) ───────────────
    t = time.time()
    print("[Phase 6] Building Network Service caches (K-Means + NetworkX)...")

    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans
    import networkx as nx

    if 'device_id' in df.columns:
        vc = df['device_id'].value_counts()
        repeaters = vc[vc >= 3].index
        df_repeat = df[df['device_id'].isin(repeaters)]

        if len(df_repeat) > 0:
            print(f"  Found {len(repeaters)} repeat offenders")

            def get_top(x):
                return x.value_counts().index[0] if len(x) > 0 else 'Unknown'

            veh = df_repeat.groupby('device_id').agg(
                violation_count=('id', 'count'),
                distinct_zones=('police_station', 'nunique'),
                mean_hour=('hour', 'mean'),
                junction_pct=('is_junction', 'mean'),
                mean_priority=('operational_priority', 'mean'),
                most_common_violation=('primary_violation', get_top)
            ).reset_index()

            features = ['violation_count', 'distinct_zones', 'mean_hour', 'junction_pct', 'mean_priority']
            X = veh[features].values
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            k = 4
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            veh['cluster'] = kmeans.fit_predict(X_scaled)

            centroids = veh.groupby('cluster')[features].mean()
            archetype_labels = {}
            highest_junction = centroids['junction_pct'].idxmax()
            highest_priority = centroids['mean_priority'].idxmax()
            highest_roaming = centroids['distinct_zones'].idxmax()
            highest_volume = centroids['violation_count'].idxmax()

            for c in range(k):
                if c == highest_junction and centroids.loc[c, 'junction_pct'] > 0.5:
                    label = "Junction Bottleneck Creators"
                elif c == highest_roaming and centroids.loc[c, 'distinct_zones'] > 2:
                    label = "City-Wide Roaming Fleets"
                elif c == highest_volume and centroids.loc[c, 'violation_count'] > 5:
                    label = "Chronic Habitual Offenders"
                elif c == highest_priority:
                    label = "High-Severity Nuisance Vehicles"
                else:
                    label = "Localized Persistent Violators"
                if label in archetype_labels.values():
                    label = f"{label} (C{c})"
                archetype_labels[c] = label

            veh['archetype'] = veh['cluster'].map(archetype_labels)

            # Clusters payload
            scatter = veh[['device_id', 'violation_count', 'mean_priority', 'cluster', 'archetype', 'most_common_violation']].to_dict(orient='records')
            # Convert numpy types to native Python for JSON serialization
            for row in scatter:
                for key, val in row.items():
                    if isinstance(val, (np.integer,)):
                        row[key] = int(val)
                    elif isinstance(val, (np.floating,)):
                        row[key] = float(val)

            save_json({
                "archetypes": {str(k_): v_ for k_, v_ in archetype_labels.items()},
                "scatter_data": scatter
            }, "network_clusters.json")

            # Offenders payload
            offenders = {}
            for c in range(k):
                top = veh[veh['cluster'] == c].nlargest(20, 'violation_count').fillna("Unknown")
                records = top.to_dict(orient='records')
                for row in records:
                    for key, val in row.items():
                        if isinstance(val, (np.integer,)):
                            row[key] = int(val)
                        elif isinstance(val, (np.floating,)):
                            row[key] = float(val)
                offenders[archetype_labels[c]] = records
            save_json(offenders, "network_offenders.json")

            # NetworkX hubs
            print("  Building bipartite graph...")
            G = nx.Graph()
            repeat_ids = set(veh['device_id'])
            graph_df = df[df['device_id'].isin(repeat_ids)]
            edges = graph_df.groupby(['device_id', 'police_station']).size().reset_index(name='weight')

            for _, row in edges.iterrows():
                G.add_edge(row['device_id'], row['police_station'], weight=int(row['weight']))

            zone_set = set(df['police_station'].unique().astype(str))
            zones = [n for n in G.nodes() if str(n) in zone_set]
            centrality = nx.degree_centrality(G)

            hubs = []
            for zone in zones:
                hubs.append({
                    "zone": str(zone),
                    "centrality_score": round(centrality.get(zone, 0), 4),
                    "unique_offenders": int(G.degree(zone)),
                    "total_repeat_violations": int(edges[edges['police_station'] == zone]['weight'].sum())
                })
            hubs.sort(key=lambda x: x['centrality_score'], reverse=True)
            save_json(hubs[:50], "network_hubs.json")

        else:
            print("  ⚠ No repeat offenders found.")
    else:
        print("  ⚠ Missing device_id column, skipping network cache.")

    print(f"  Done in {time.time() - t:.1f}s")

    # ── Summary ────────────────────────────────────────────────────────────
    total = time.time() - total_start
    files = list(CACHE_DIR.glob("*.json"))
    total_kb = sum(f.stat().st_size for f in files) / 1024
    print(f"\n{'=' * 60}")
    print(f"  Precompute complete!")
    print(f"  {len(files)} cache files written ({total_kb:.0f} KB total)")
    print(f"  Total time: {total:.1f}s")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    run_precompute()
