"""
Export Data for Feature 2 Web Dashboard
=======================================
Reads the full scored_violations.csv and exports optimized JSON files
for the frontend dashboard to consume without a backend server.
"""

import os
import json
import pandas as pd
import numpy as np

OUTPUTS_DIR = "outputs"
DASHBOARD_DATA_DIR = os.path.join("dashboard", "data")
SCORED_CSV = os.path.join(OUTPUTS_DIR, "scored_violations.csv")

# Constants for sampling
MAX_HEATMAP_POINTS = 15000  # Max points to send to frontend for performance


def clean_dict(d):
    """Convert numpy types to native Python types for JSON serialization."""
    clean = {}
    for k, v in d.items():
        if isinstance(v, (np.int64, np.int32)):
            clean[k] = int(v)
        elif isinstance(v, (np.float64, np.float32)):
            if pd.isna(v):
                clean[k] = None
            else:
                clean[k] = float(v)
        elif isinstance(v, dict):
            clean[k] = clean_dict(v)
        else:
            clean[k] = v
    return clean


def main():
    print("Exporting data for Web Dashboard...")
    os.makedirs(DASHBOARD_DATA_DIR, exist_ok=True)
    
    if not os.path.exists(SCORED_CSV):
        print(f"Error: {SCORED_CSV} not found. Please run the main pipeline first.")
        return

    print(f"Loading {SCORED_CSV}...")
    df = pd.read_csv(SCORED_CSV)
    
    # 1. Zone Summary
    print("Generating zone_summary.json...")
    zone_agg = df.groupby("police_station").agg(
        count=("id", "count"),
        lat=("latitude", "mean"),
        lng=("longitude", "mean"),
        mean_priority=("operational_priority", "mean"),
        total_priority=("operational_priority", "sum"),
        mean_congestion=("congestion_impact", "mean"),
        mean_propensity=("escalation_propensity", "mean"),
        junction_pct=("is_junction", "mean"),
    ).reset_index()

    zone_agg["count_rank"] = zone_agg["count"].rank(ascending=False).astype(int)
    zone_agg["priority_rank"] = zone_agg["total_priority"].rank(ascending=False).astype(int)
    zone_agg["rank_change"] = zone_agg["count_rank"] - zone_agg["priority_rank"]
    
    # Normalize priority for radius scaling
    min_p, max_p = zone_agg["total_priority"].min(), zone_agg["total_priority"].max()
    if max_p > min_p:
        zone_agg["priority_norm"] = (zone_agg["total_priority"] - min_p) / (max_p - min_p)
    else:
        zone_agg["priority_norm"] = 0.5

    zones_list = [clean_dict(row) for row in zone_agg.to_dict(orient="records")]
    with open(os.path.join(DASHBOARD_DATA_DIR, "zone_summary.json"), "w") as f:
        json.dump(zones_list, f)

    # 2. Sampled Violations for Heatmap & Highlights
    print(f"Generating violations_sample.json (Sample size: {MAX_HEATMAP_POINTS})...")
    # Always include top 1000 highest priority
    top_priority = df.nlargest(1000, "operational_priority")
    
    # Sample the rest randomly
    remaining_needed = max(0, MAX_HEATMAP_POINTS - len(top_priority))
    if remaining_needed > 0 and remaining_needed < len(df):
        # Exclude already selected
        rest = df.drop(top_priority.index)
        sample = rest.sample(n=min(remaining_needed, len(rest)), random_state=42)
        final_sample = pd.concat([top_priority, sample])
    else:
        final_sample = df.copy()
        
    final_sample = final_sample.sample(frac=1).reset_index(drop=True) # Shuffle
    
    # Normalize priority for coloring top markers
    min_p_sample, max_p_sample = final_sample["operational_priority"].min(), final_sample["operational_priority"].max()
    final_sample["priority_norm"] = (final_sample["operational_priority"] - min_p_sample) / (max_p_sample - min_p_sample)
    
    points = []
    for _, row in final_sample.iterrows():
        points.append(clean_dict({
            "id": row["id"],
            "lat": row["latitude"],
            "lng": row["longitude"],
            "hour": row["hour_ist"],
            "vehicle": row["resolved_vehicle_type"],
            "violation": row["primary_violation_type"],
            "zone": row["police_station"],
            "priority": row["operational_priority"],
            "priority_norm": row["priority_norm"]
        }))
        
    with open(os.path.join(DASHBOARD_DATA_DIR, "violations_sample.json"), "w") as f:
        json.dump(points, f)

    # 3. Hourly Distribution
    print("Generating hourly_distribution.json...")
    hourly = df.groupby("hour_ist").agg(
        count=("id", "count"),
        mean_priority=("operational_priority", "mean")
    ).reset_index()
    hourly_data = {
        "hours": hourly["hour_ist"].tolist(),
        "counts": [int(x) for x in hourly["count"].tolist()],
        "priority": [float(x) for x in hourly["mean_priority"].tolist()]
    }
    with open(os.path.join(DASHBOARD_DATA_DIR, "hourly_distribution.json"), "w") as f:
        json.dump(hourly_data, f)
        
    # 4. Vehicle Distribution
    print("Generating vehicle_distribution.json...")
    vehicle = df.groupby("resolved_vehicle_type").agg(
        count=("id", "count"),
        mean_priority=("operational_priority", "mean")
    ).reset_index().sort_values("count", ascending=False).head(10) # Top 10
    
    vehicle_data = {
        "vehicles": vehicle["resolved_vehicle_type"].tolist(),
        "counts": [int(x) for x in vehicle["count"].tolist()],
        "priority": [float(x) for x in vehicle["mean_priority"].tolist()]
    }
    with open(os.path.join(DASHBOARD_DATA_DIR, "vehicle_distribution.json"), "w") as f:
        json.dump(vehicle_data, f)

    # 5. Model Metrics & SHAP (Static for now, hardcoded from plan results)
    print("Generating explainability data...")
    shap_data = {
        "labels": ["Hour of Day (IST)", "Violation Type", "Vehicle Type", "Center Code", "Day of Week", "Police Station", "Junction Proximity"],
        "values": [0.2503, 0.1838, 0.1754, 0.1160, 0.1143, 0.1125, 0.0361]
    }
    with open(os.path.join(DASHBOARD_DATA_DIR, "shap_importance.json"), "w") as f:
        json.dump(shap_data, f)

    print("Dashboard data export complete!")

if __name__ == "__main__":
    main()
