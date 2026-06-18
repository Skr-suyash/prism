"""
Network Service — Repeat Offender Network (K-Means + NetworkX).

Loads from JSON cache files if available, otherwise computes from DataFrame.
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = Path(BASE_DIR) / "backend" / "cache"


class NetworkService:
    def __init__(self):
        self.clusters = {"archetypes": {}, "scatter_data": []}
        self.offenders = {}
        self.hubs = []

    def initialize(self, df: pd.DataFrame = None):
        """Try cache first. If unavailable and df is provided, compute from df."""
        if self._load_from_cache():
            print("[NetworkService] Ready (loaded from cache).")
            return

        if df is None:
            print("[NetworkService] No cache and no DataFrame provided!")
            return

        print("[NetworkService] Cache not found, computing from DataFrame...")
        self._compute_from_df(df)
        print("[NetworkService] Ready.")

    def _load_from_cache(self) -> bool:
        required = [
            "network_clusters.json", "network_offenders.json", "network_hubs.json"
        ]
        for fname in required:
            if not (CACHE_DIR / fname).exists():
                return False

        print("[NetworkService] Loading from cache...")
        with open(CACHE_DIR / "network_clusters.json") as f:
            self.clusters = json.load(f)
        with open(CACHE_DIR / "network_offenders.json") as f:
            self.offenders = json.load(f)
        with open(CACHE_DIR / "network_hubs.json") as f:
            self.hubs = json.load(f)
        return True

    def _compute_from_df(self, df: pd.DataFrame):
        """Full compute path — only used when cache is missing."""
        from sklearn.preprocessing import StandardScaler
        from sklearn.cluster import KMeans
        import networkx as nx

        if 'device_id' not in df.columns:
            print("[NetworkService] Missing device_id column!")
            return

        print("  - Engineering per-vehicle features...")
        vc = df['device_id'].value_counts()
        repeaters = vc[vc >= 3].index
        df_repeat = df[df['device_id'].isin(repeaters)]

        if len(df_repeat) == 0:
            print("[NetworkService] No repeat offenders found with >= 3 violations.")
            return

        print(f"  - Aggregating {len(repeaters)} repeat offenders...")

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

        if len(veh) == 0:
            print("[NetworkService] No repeat offenders found with >= 3 violations.")
            return

        print(f"  - Running K-Means on {len(veh)} repeat offenders...")
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

        self.clusters = {
            "archetypes": {str(k_): v_ for k_, v_ in archetype_labels.items()},
            "scatter_data": veh[['device_id', 'violation_count', 'mean_priority', 'cluster', 'archetype', 'most_common_violation']].to_dict(orient='records')
        }

        offenders = {}
        for c in range(k):
            top = veh[veh['cluster'] == c].nlargest(20, 'violation_count').fillna("Unknown")
            offenders[archetype_labels[c]] = top.to_dict(orient='records')
        self.offenders = offenders

        print("  - Building Bipartite Graph for Zone Hubs...")
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
        self.hubs = hubs[:50]

    def get_clusters(self):
        return self.clusters

    def get_offenders(self):
        return self.offenders

    def get_hubs(self):
        return self.hubs
