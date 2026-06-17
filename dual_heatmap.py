"""
Feature 2: Dual Heatmap — Count vs Impact
==========================================
Side-by-side Folium maps of the same city, same data, two different lenses.

Left map:  Raw violation DENSITY (what every competing team will produce)
Right map: OPERATIONAL PRIORITY index from Feature 1

The visual gap between them IS the argument, made spatial.
No ML — KDE is statistical. The power is clarity of presentation.

Built for policy makers: clear, defensible, immediately readable.
"""

import os
import json
import numpy as np
import pandas as pd
import folium
from folium.plugins import HeatMap, DualMap
from folium import IFrame
import branca.colormap as cm

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OUTPUTS_DIR = "outputs"
SCORED_CSV = os.path.join(OUTPUTS_DIR, "scored_violations.csv")
DUAL_MAP_PATH = os.path.join(OUTPUTS_DIR, "dual_heatmap.html")
ZONE_COMPARISON_PATH = os.path.join(OUTPUTS_DIR, "top10_reranked_zones.csv")

# Bengaluru center
CENTER_LAT = 12.9716
CENTER_LON = 77.5946
DEFAULT_ZOOM = 12

# Colour scale: blue (low) -> yellow (mid) -> red (high)
PRIORITY_COLORMAP = cm.LinearColormap(
    colors=["#3498DB", "#2ECC71", "#F1C40F", "#E67E22", "#E74C3C"],
    vmin=0, vmax=1,
    caption="Operational Priority (normalised)"
)

DENSITY_GRADIENT = {
    0.2: "#3498DB",   # blue (low)
    0.4: "#2ECC71",   # green
    0.6: "#F1C40F",   # yellow
    0.8: "#E67E22",   # orange
    1.0: "#E74C3C",   # red (high)
}

# Vehicle type groups for cleaner filtering
VEHICLE_GROUPS = {
    "Two-Wheeler": ["SCOOTER", "MOPED", "MOTOR CYCLE"],
    "Car/Jeep/Van": ["CAR", "JEEP", "VAN", "OTHERS"],
    "Auto": ["PASSENGER AUTO", "GOODS AUTO"],
    "Maxi-Cab/LGV": ["MAXI-CAB", "LGV", "TEMPO", "MINI LORRY", "SCHOOL VEHICLE", "FACTORY BUS"],
    "Bus": ["PRIVATE BUS", "TOURIST BUS", "BUS (BMTC/KSRTC)"],
    "Heavy Vehicle": ["HGV", "LORRY/GOODS VEHICLE", "TANKER", "TRACTOR"],
}

# Hour groups
HOUR_GROUPS = {
    "Early Morning (5-7)": list(range(5, 7)),
    "Morning Peak (7-10)": list(range(7, 10)),
    "Midday (10-13)": list(range(10, 13)),
    "Afternoon (13-17)": list(range(13, 17)),
    "Evening Peak (17-20)": list(range(17, 20)),
    "Night (20-24)": list(range(20, 24)),
    "Midnight (0-5)": list(range(0, 5)),
}


def load_scored_data(path: str = SCORED_CSV) -> pd.DataFrame:
    """Load the scored violations CSV."""
    print(f"[Dual Heatmap] Loading scored data from {path} ...")
    df = pd.read_csv(path)
    print(f"  Loaded {len(df):,} records")
    return df


def normalize_column(series: pd.Series) -> pd.Series:
    """Min-max normalize a series to [0, 1]."""
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val:
        return pd.Series(0.5, index=series.index)
    return (series - min_val) / (max_val - min_val)


def get_priority_color(normalized_value: float) -> str:
    """Map a 0-1 value to the blue-red colour scale."""
    if normalized_value < 0.2:
        return "#3498DB"   # blue
    elif normalized_value < 0.4:
        return "#2ECC71"   # green
    elif normalized_value < 0.6:
        return "#F1C40F"   # yellow
    elif normalized_value < 0.8:
        return "#E67E22"   # orange
    else:
        return "#E74C3C"   # red


def build_popup_html(row: pd.Series) -> str:
    """Build an informative popup for policy makers."""
    # Determine priority level label
    norm_priority = row.get("priority_norm", 0.5)
    if norm_priority >= 0.8:
        level = '<span style="color:#E74C3C;font-weight:bold">CRITICAL</span>'
    elif norm_priority >= 0.6:
        level = '<span style="color:#E67E22;font-weight:bold">HIGH</span>'
    elif norm_priority >= 0.4:
        level = '<span style="color:#F1C40F;font-weight:bold">MODERATE</span>'
    elif norm_priority >= 0.2:
        level = '<span style="color:#2ECC71;font-weight:bold">LOW</span>'
    else:
        level = '<span style="color:#3498DB;font-weight:bold">MINIMAL</span>'

    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; width: 280px; padding: 8px;">
        <h4 style="margin: 0 0 8px 0; color: #2C3E50; border-bottom: 2px solid #3498DB; padding-bottom: 4px;">
            {row.get('police_station', 'Unknown Zone')}
        </h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr>
                <td style="padding: 3px; color: #7F8C8D;"><b>Priority Level</b></td>
                <td style="padding: 3px; text-align: right;">{level}</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;"><b>Congestion Impact</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold;">{row.get('congestion_impact', 0):.2f}</td>
            </tr>
            <tr>
                <td style="padding: 3px; color: #7F8C8D;"><b>Escalation Propensity</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold;">{row.get('escalation_propensity', 0):.3f}</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;"><b>Operational Priority</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold; color: #E74C3C;">{row.get('operational_priority', 0):.2f}</td>
            </tr>
            <tr><td colspan="2" style="padding: 4px 0;"><hr style="margin: 0; border: 0; border-top: 1px solid #ECF0F1;"></td></tr>
            <tr>
                <td style="padding: 3px; color: #7F8C8D;">Vehicle</td>
                <td style="padding: 3px; text-align: right;">{row.get('resolved_vehicle_type', 'N/A')}</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;">Violation</td>
                <td style="padding: 3px; text-align: right;">{row.get('primary_violation_type', 'N/A')}</td>
            </tr>
            <tr>
                <td style="padding: 3px; color: #7F8C8D;">Hour (IST)</td>
                <td style="padding: 3px; text-align: right;">{int(row.get('hour_ist', 0)):02d}:00</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;">Junction</td>
                <td style="padding: 3px; text-align: right;">{row.get('junction_name', 'No Junction')}</td>
            </tr>
        </table>
    </div>
    """
    return html


def build_zone_summary_popup(zone_data: dict) -> str:
    """Build a zone-level summary popup for the density map."""
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; width: 260px; padding: 8px;">
        <h4 style="margin: 0 0 8px 0; color: #2C3E50; border-bottom: 2px solid #E74C3C; padding-bottom: 4px;">
            {zone_data['police_station']}
        </h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr>
                <td style="padding: 3px; color: #7F8C8D;"><b>Violation Count</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold;">{zone_data['count']:,}</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;"><b>Count Rank</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold;">#{zone_data['count_rank']}</td>
            </tr>
            <tr>
                <td style="padding: 3px; color: #7F8C8D;"><b>Priority Rank</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold; color: #E74C3C;">#{zone_data['priority_rank']}</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;"><b>Rank Change</b></td>
                <td style="padding: 3px; text-align: right; font-weight: bold; color: {'#2ECC71' if zone_data['rank_change'] > 0 else '#E74C3C' if zone_data['rank_change'] < 0 else '#95A5A6'};">
                    {'+' if zone_data['rank_change'] > 0 else ''}{zone_data['rank_change']}
                </td>
            </tr>
            <tr>
                <td style="padding: 3px; color: #7F8C8D;"><b>Avg Priority</b></td>
                <td style="padding: 3px; text-align: right;">{zone_data['mean_priority']:.2f}</td>
            </tr>
            <tr style="background: #F8F9FA;">
                <td style="padding: 3px; color: #7F8C8D;"><b>Junction %</b></td>
                <td style="padding: 3px; text-align: right;">{zone_data['junction_pct']:.0%}</td>
            </tr>
        </table>
    </div>
    """
    return html


def compute_zone_aggregates(df: pd.DataFrame) -> pd.DataFrame:
    """Compute zone-level aggregates for map overlays."""
    zone_agg = df.groupby("police_station").agg(
        count=("id", "count"),
        mean_lat=("latitude", "mean"),
        mean_lon=("longitude", "mean"),
        mean_priority=("operational_priority", "mean"),
        total_priority=("operational_priority", "sum"),
        mean_congestion=("congestion_impact", "mean"),
        mean_propensity=("escalation_propensity", "mean"),
        junction_pct=("is_junction", "mean"),
    ).reset_index()

    zone_agg["count_rank"] = zone_agg["count"].rank(ascending=False).astype(int)
    zone_agg["priority_rank"] = zone_agg["total_priority"].rank(ascending=False).astype(int)
    zone_agg["rank_change"] = zone_agg["count_rank"] - zone_agg["priority_rank"]

    # Normalize for sizing
    zone_agg["count_norm"] = normalize_column(zone_agg["count"])
    zone_agg["priority_norm"] = normalize_column(zone_agg["total_priority"])

    return zone_agg


def build_dual_heatmap(df: pd.DataFrame, zone_agg: pd.DataFrame) -> folium.plugins.DualMap:
    """
    Build the side-by-side Folium DualMap.

    Left:  Raw violation density (HeatMap)
    Right: Operational priority (CircleMarkers sized by score)
    """
    print("[Dual Heatmap] Building dual map ...")

    # Create DualMap
    dual_map = DualMap(
        location=[CENTER_LAT, CENTER_LON],
        zoom_start=DEFAULT_ZOOM,
        tiles=None,
    )

    # Add dark tile layer to both maps for contrast
    folium.TileLayer(
        tiles="cartodbdark_matter",
        name="Dark Map",
        attr="CartoDB",
    ).add_to(dual_map.m1)

    folium.TileLayer(
        tiles="cartodbdark_matter",
        name="Dark Map",
        attr="CartoDB",
    ).add_to(dual_map.m2)

    # ================================================================
    # LEFT MAP — Violation Density HeatMap
    # ================================================================
    print("  Building left panel: Violation Density ...")

    # Use all points for heatmap (lat, lon, weight=1 for pure count)
    heat_data = df[["latitude", "longitude"]].values.tolist()
    HeatMap(
        heat_data,
        name="Violation Density",
        min_opacity=0.4,
        max_zoom=15,
        radius=12,
        blur=15,
        gradient=DENSITY_GRADIENT,
    ).add_to(dual_map.m1)

    # Add zone center markers on the density map with count info
    count_group = folium.FeatureGroup(name="Zone Centres (Count)")
    for _, zone in zone_agg.iterrows():
        radius = 8 + zone["count_norm"] * 25  # 8-33px
        popup_html = build_zone_summary_popup(zone.to_dict())
        popup = folium.Popup(popup_html, max_width=300)

        folium.CircleMarker(
            location=[zone["mean_lat"], zone["mean_lon"]],
            radius=radius,
            color="#FFFFFF",
            fill=True,
            fill_color="#E74C3C",
            fill_opacity=0.6,
            weight=1.5,
            popup=popup,
            tooltip=f"{zone['police_station']}: {zone['count']:,} violations (Rank #{zone['count_rank']})",
        ).add_to(count_group)
    count_group.add_to(dual_map.m1)

    # ================================================================
    # RIGHT MAP — Operational Priority CircleMarkers
    # ================================================================
    print("  Building right panel: Operational Priority ...")

    # Normalize priority for colour/size mapping
    df["priority_norm"] = normalize_column(df["operational_priority"])

    # Sample for individual markers (298K markers would be too heavy)
    # Strategy: use zone-level aggregation for circle markers
    # Plus top-N individual high-priority violations as highlight points

    # Zone-level priority circles
    priority_group = folium.FeatureGroup(name="Zone Priority (Aggregated)")
    for _, zone in zone_agg.iterrows():
        radius = 8 + zone["priority_norm"] * 25
        color = get_priority_color(zone["priority_norm"])

        popup_html = build_zone_summary_popup(zone.to_dict())
        popup = folium.Popup(popup_html, max_width=300)

        folium.CircleMarker(
            location=[zone["mean_lat"], zone["mean_lon"]],
            radius=radius,
            color="#FFFFFF",
            fill=True,
            fill_color=color,
            fill_opacity=0.7,
            weight=1.5,
            popup=popup,
            tooltip=(f"{zone['police_station']}: Priority Rank #{zone['priority_rank']} "
                     f"(Count Rank #{zone['count_rank']}, Change: "
                     f"{'+' if zone['rank_change'] > 0 else ''}{zone['rank_change']})"),
        ).add_to(priority_group)
    priority_group.add_to(dual_map.m2)

    # Priority heatmap (weighted by operational_priority)
    priority_heat_data = df[["latitude", "longitude", "operational_priority"]].values.tolist()
    HeatMap(
        priority_heat_data,
        name="Priority Heatmap",
        min_opacity=0.3,
        max_zoom=15,
        radius=12,
        blur=15,
        gradient=DENSITY_GRADIENT,
    ).add_to(dual_map.m2)

    # Add top 500 highest-priority individual violations as highlight markers
    top_violations = df.nlargest(500, "operational_priority")
    highlight_group = folium.FeatureGroup(name="Top 500 High-Priority Violations")
    for _, row in top_violations.iterrows():
        color = get_priority_color(row["priority_norm"])
        radius = 3 + row["priority_norm"] * 6

        popup_html = build_popup_html(row)
        popup = folium.Popup(popup_html, max_width=320)

        folium.CircleMarker(
            location=[row["latitude"], row["longitude"]],
            radius=radius,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.8,
            weight=0.5,
            popup=popup,
            tooltip=f"Priority: {row['operational_priority']:.2f} | {row['primary_violation_type']}",
        ).add_to(highlight_group)
    highlight_group.add_to(dual_map.m2)

    # Add layer control to both maps
    folium.LayerControl(collapsed=False).add_to(dual_map.m1)
    folium.LayerControl(collapsed=False).add_to(dual_map.m2)

    return dual_map


def add_title_and_legend(html_path: str):
    """
    Inject a title banner, legend, and panel labels into the saved HTML.
    This post-processes the HTML to add policy-maker-friendly context.
    """
    print("[Dual Heatmap] Adding title, labels, and legend ...")

    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # CSS + HTML overlay for titles and legend
    overlay_html = """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        .gridlock-title {
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            background: rgba(44, 62, 80, 0.95);
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 16px;
            font-weight: 700;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            backdrop-filter: blur(10px);
            letter-spacing: 0.5px;
        }
        .gridlock-title .subtitle {
            font-size: 11px;
            font-weight: 400;
            color: #BDC3C7;
            margin-top: 4px;
            letter-spacing: 0.3px;
        }

        .panel-label {
            position: fixed;
            top: 80px;
            z-index: 10000;
            background: rgba(44, 62, 80, 0.9);
            color: white;
            padding: 8px 20px;
            border-radius: 6px;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .panel-label-left {
            left: 15px;
            border-left: 4px solid #3498DB;
        }
        .panel-label-right {
            right: 15px;
            border-left: 4px solid #E74C3C;
        }

        .gridlock-legend {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            background: rgba(44, 62, 80, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 11px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .legend-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 1.5px solid rgba(255,255,255,0.3);
        }
        .legend-gradient {
            width: 120px;
            height: 14px;
            border-radius: 3px;
            background: linear-gradient(to right, #3498DB, #2ECC71, #F1C40F, #E67E22, #E74C3C);
            border: 1px solid rgba(255,255,255,0.2);
        }

        .gridlock-insight {
            position: fixed;
            bottom: 60px;
            right: 20px;
            z-index: 10000;
            background: rgba(231, 76, 60, 0.95);
            color: white;
            padding: 10px 18px;
            border-radius: 8px;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 11px;
            max-width: 300px;
            box-shadow: 0 4px 15px rgba(231,76,60,0.4);
            line-height: 1.5;
        }
        .gridlock-insight strong {
            font-size: 12px;
        }
    </style>

    <div class="gridlock-title">
        Dual Heatmap: Violation Count vs Operational Priority
        <div class="subtitle">Bengaluru Parking Violations &middot; Nov 2023 &ndash; May 2024 &middot; 298,450 Records</div>
    </div>

    <div class="panel-label panel-label-left">
        &#x1f534; LEFT: Violation Density (Raw Count)
    </div>
    <div class="panel-label panel-label-right">
        &#x1f7e0; RIGHT: Operational Priority (Impact &times; Propensity)
    </div>

    <div class="gridlock-legend">
        <span style="font-weight: 600; color: #BDC3C7;">SCALE:</span>
        <div class="legend-item">
            <span>Low</span>
            <div class="legend-gradient"></div>
            <span>High</span>
        </div>
        <span style="color: #7F8C8D;">|</span>
        <div class="legend-item">
            <span style="color: #BDC3C7;">Circle size = magnitude</span>
        </div>
        <span style="color: #7F8C8D;">|</span>
        <div class="legend-item">
            <span style="color: #BDC3C7;">Click markers for details</span>
        </div>
    </div>

    <div class="gridlock-insight">
        <strong>&#9888; Key Insight</strong><br>
        Zones that look safe by count (left) but rank high by priority (right) are where
        enforcement is failing. <b>The system is patrolling the wrong places.</b>
    </div>
    """

    # Inject before closing </body>
    html_content = html_content.replace("</body>", overlay_html + "\n</body>")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)


def build_top10_reranked_table(zone_agg: pd.DataFrame) -> pd.DataFrame:
    """
    Build the top-10 reranked zones table for policy makers.
    Shows zones where the priority rank differs most from count rank.
    """
    print("[Dual Heatmap] Building top-10 reranked zones table ...")

    # Top 10 by absolute rank change
    top10 = zone_agg.reindex(
        zone_agg["rank_change"].abs().sort_values(ascending=False).index
    ).head(10).copy()

    # Format for display
    result = top10[[
        "police_station", "count", "count_rank",
        "total_priority", "priority_rank", "rank_change",
        "mean_congestion", "mean_propensity", "junction_pct",
    ]].copy()
    result.columns = [
        "Zone (Police Station)", "Violation Count", "Count Rank",
        "Total Priority Score", "Priority Rank", "Rank Change",
        "Avg Congestion Impact", "Avg Escalation Propensity", "Junction %",
    ]

    result["Total Priority Score"] = result["Total Priority Score"].round(1)
    result["Avg Congestion Impact"] = result["Avg Congestion Impact"].round(2)
    result["Avg Escalation Propensity"] = result["Avg Escalation Propensity"].round(3)
    result["Junction %"] = (result["Junction %"] * 100).round(0).astype(int).astype(str) + "%"

    result.to_csv(ZONE_COMPARISON_PATH, index=False)
    print(f"  Saved to {ZONE_COMPARISON_PATH}")

    # Print the table
    print("\n" + "=" * 100)
    print("  TOP 10 RE-RANKED ZONES (by absolute rank change)")
    print("=" * 100)
    for _, row in result.iterrows():
        direction = "UP" if row["Rank Change"] > 0 else "DOWN"
        emoji = "^" if row["Rank Change"] > 0 else "v"
        print(f"  {row['Zone (Police Station)']:25s} | Count: #{row['Count Rank']:2d} -> "
              f"Priority: #{row['Priority Rank']:2d} | {emoji} {abs(row['Rank Change']):+d} ({direction}) | "
              f"Junction: {row['Junction %']}")
    print("=" * 100)

    return result


def build_hourly_maps(df: pd.DataFrame) -> dict:
    """
    Build individual heatmaps per hour group for optional hour-of-day animation.
    Saves one HTML per hour group.
    """
    print("[Dual Heatmap] Building hour-of-day breakdowns ...")
    hourly_dir = os.path.join(OUTPUTS_DIR, "hourly_maps")
    os.makedirs(hourly_dir, exist_ok=True)

    hourly_paths = {}
    for group_name, hours in HOUR_GROUPS.items():
        df_hour = df[df["hour_ist"].isin(hours)]
        if len(df_hour) == 0:
            continue

        m = folium.Map(
            location=[CENTER_LAT, CENTER_LON],
            zoom_start=DEFAULT_ZOOM,
            tiles="cartodbdark_matter",
        )

        # Density heatmap
        heat_data = df_hour[["latitude", "longitude"]].values.tolist()
        HeatMap(
            heat_data,
            name=f"Density - {group_name}",
            min_opacity=0.4, radius=12, blur=15,
            gradient=DENSITY_GRADIENT,
        ).add_to(m)

        # Priority heatmap
        priority_heat = df_hour[["latitude", "longitude", "operational_priority"]].values.tolist()
        HeatMap(
            priority_heat,
            name=f"Priority - {group_name}",
            min_opacity=0.3, radius=12, blur=15,
            gradient=DENSITY_GRADIENT,
            show=False,
        ).add_to(m)

        folium.LayerControl().add_to(m)

        # Add title
        title_html = f"""
        <div style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                    z-index: 10000; background: rgba(44,62,80,0.9); color: white;
                    padding: 10px 24px; border-radius: 8px; font-family: 'Inter', sans-serif;
                    font-size: 14px; font-weight: 700; text-align: center;">
            {group_name} &mdash; {len(df_hour):,} violations
        </div>
        """
        m.get_root().html.add_child(folium.Element(title_html))

        safe_name = group_name.replace(" ", "_").replace("(", "").replace(")", "").lower()
        path = os.path.join(hourly_dir, f"heatmap_{safe_name}.html")
        m.save(path)
        hourly_paths[group_name] = path
        print(f"  {group_name}: {len(df_hour):,} violations -> {path}")

    return hourly_paths


def generate_dual_heatmap(df: pd.DataFrame = None) -> str:
    """
    Main entry point: generate the complete dual heatmap visualization.

    Returns: path to the saved HTML file
    """
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    if df is None:
        df = load_scored_data()

    # Compute zone aggregates
    zone_agg = compute_zone_aggregates(df)

    # Build dual map
    dual_map = build_dual_heatmap(df, zone_agg)

    # Save
    print(f"[Dual Heatmap] Saving dual heatmap to {DUAL_MAP_PATH} ...")
    dual_map.save(DUAL_MAP_PATH)

    # Post-process: add titles and legend
    add_title_and_legend(DUAL_MAP_PATH)

    file_size = os.path.getsize(DUAL_MAP_PATH) / (1024 * 1024)
    print(f"  Saved ({file_size:.1f} MB)")

    # Top-10 reranked zones table
    top10 = build_top10_reranked_table(zone_agg)

    # Hourly breakdowns
    hourly_paths = build_hourly_maps(df)

    print(f"\n[Dual Heatmap] COMPLETE")
    print(f"  Main map: {DUAL_MAP_PATH}")
    print(f"  Reranked zones: {ZONE_COMPARISON_PATH}")
    print(f"  Hourly maps: {len(hourly_paths)} generated")

    return DUAL_MAP_PATH


# ---------------------------------------------------------------------------
# Run standalone
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    generate_dual_heatmap()
