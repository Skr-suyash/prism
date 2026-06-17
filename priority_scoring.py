"""
Phase 5: Combined Priority Score & Zone-Level Rankings
======================================================
Combines the two independent components:

    operational_priority = congestion_impact x escalation_propensity

A high-severity violation with low escalation propensity is the most
dangerous case -- real-world impact is high but the system is historically
failing to pursue it. These are the highest-priority enforcement targets,
invisible to any count-based approach.

The rank flip table at zone level proves: "The system is patrolling the
wrong places, and here is the proof."
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUTPUTS_DIR = "outputs"
ZONE_RANKINGS_PATH = os.path.join(OUTPUTS_DIR, "zone_rankings.csv")
RANK_FLIP_TABLE_PATH = os.path.join(OUTPUTS_DIR, "rank_flip_table.csv")
SCORED_VIOLATIONS_PATH = os.path.join(OUTPUTS_DIR, "scored_violations.csv")
RANK_FLIP_CHART_PATH = os.path.join(OUTPUTS_DIR, "rank_flip_chart.png")
HIGH_PRIORITY_IGNORED_PATH = os.path.join(OUTPUTS_DIR, "high_priority_ignored.csv")


def compute_operational_priority(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute the combined operational priority score:
        operational_priority = congestion_impact * escalation_propensity
    """
    print("[Priority Scoring] Computing operational priority scores ...")

    df["operational_priority"] = df["congestion_impact"] * df["escalation_propensity"]

    print(f"  Score range: {df['operational_priority'].min():.4f} - "
          f"{df['operational_priority'].max():.4f}")
    print(f"  Mean:   {df['operational_priority'].mean():.4f}")
    print(f"  Median: {df['operational_priority'].median():.4f}")

    return df


def identify_high_priority_ignored(df: pd.DataFrame) -> pd.DataFrame:
    """
    Find the most dangerous cases: high congestion impact + low escalation
    propensity. These are violations that have real-world impact but the
    system is historically failing to pursue.
    """
    print("\n[Priority Scoring] Identifying high-impact, low-propensity violations ...")

    # Define thresholds: top 25% congestion impact, bottom 25% escalation propensity
    ci_threshold = df["congestion_impact"].quantile(0.75)
    ep_threshold = df["escalation_propensity"].quantile(0.25)

    mask = (df["congestion_impact"] >= ci_threshold) & \
           (df["escalation_propensity"] <= ep_threshold)

    ignored = df[mask].copy()
    print(f"  High-impact, low-propensity violations: {len(ignored):,}")
    print(f"  (congestion_impact >= {ci_threshold:.2f} AND "
          f"escalation_propensity <= {ep_threshold:.4f})")

    if len(ignored) > 0:
        print(f"\n  Top zones with ignored high-impact violations:")
        zone_counts = ignored.groupby("police_station").size().sort_values(ascending=False)
        for zone, count in zone_counts.head(10).items():
            print(f"    {zone}: {count:,}")

        # Save to file
        save_cols = [
            "id", "police_station", "junction_name", "resolved_vehicle_type",
            "primary_violation_type", "hour_ist", "day_of_week",
            "congestion_impact", "escalation_propensity", "operational_priority",
            "validation_status",
        ]
        ignored[save_cols].to_csv(HIGH_PRIORITY_IGNORED_PATH, index=False)
        print(f"\n  Saved to {HIGH_PRIORITY_IGNORED_PATH}")

    return ignored


def build_zone_rankings(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate at zone level (police_station) and rank zones by:
      1. Naive count (simple violation count)
      2. Total operational priority

    Returns: Zone-level rankings DataFrame
    """
    print("\n[Priority Scoring] Building zone-level rankings ...")

    zone_agg = df.groupby("police_station").agg(
        naive_count=("id", "count"),
        mean_congestion_impact=("congestion_impact", "mean"),
        mean_escalation_propensity=("escalation_propensity", "mean"),
        total_operational_priority=("operational_priority", "sum"),
        mean_operational_priority=("operational_priority", "mean"),
        junction_pct=("is_junction", "mean"),
    ).reset_index()

    # Rank zones
    zone_agg["count_rank"] = zone_agg["naive_count"].rank(ascending=False).astype(int)
    zone_agg["priority_rank"] = zone_agg["total_operational_priority"].rank(
        ascending=False
    ).astype(int)

    # Rank change: positive = zone jumps UP in priority (more dangerous than count suggests)
    zone_agg["rank_change"] = zone_agg["count_rank"] - zone_agg["priority_rank"]

    # Sort by total operational priority descending
    zone_agg = zone_agg.sort_values("total_operational_priority", ascending=False)

    # Round floats for readability
    for col in ["mean_congestion_impact", "mean_escalation_propensity",
                "mean_operational_priority", "junction_pct"]:
        zone_agg[col] = zone_agg[col].round(4)
    zone_agg["total_operational_priority"] = zone_agg["total_operational_priority"].round(2)

    # Save
    zone_agg.to_csv(ZONE_RANKINGS_PATH, index=False)
    print(f"  Saved zone rankings to {ZONE_RANKINGS_PATH}")
    print(f"  {len(zone_agg)} zones ranked")

    return zone_agg


def build_rank_flip_table(zone_agg: pd.DataFrame) -> pd.DataFrame:
    """
    Build the rank flip table: naive count rank vs operational priority rank.
    Highlight zones that jump dramatically.
    """
    print("\n[Priority Scoring] Building rank flip table ...")

    flip_table = zone_agg[[
        "police_station", "naive_count", "count_rank",
        "total_operational_priority", "priority_rank", "rank_change",
        "mean_congestion_impact", "mean_escalation_propensity", "junction_pct",
    ]].copy()

    flip_table = flip_table.sort_values("rank_change", ascending=False)

    # Save
    flip_table.to_csv(RANK_FLIP_TABLE_PATH, index=False)
    print(f"  Saved rank flip table to {RANK_FLIP_TABLE_PATH}")

    # Highlight dramatic movers
    print("\n" + "=" * 80)
    print("[Priority Scoring] RANK FLIP TABLE - DRAMATIC MOVERS")
    print("=" * 80)

    # Top movers UP (zones that look safe by count but rank high by priority)
    top_up = flip_table.head(5)
    print("\n  ZONES JUMPING UP (underpatrolled -- higher priority than count suggests):")
    print("  " + "-" * 76)
    for _, row in top_up.iterrows():
        print(f"  {row['police_station']:25s} | Count Rank: {row['count_rank']:2d} -> "
              f"Priority Rank: {row['priority_rank']:2d} | "
              f"Change: +{row['rank_change']:d} | "
              f"Junction%: {row['junction_pct']:.0%}")

    # Top movers DOWN (zones that look dangerous by count but are actually lower priority)
    top_down = flip_table.tail(5).iloc[::-1]
    print("\n  ZONES DROPPING DOWN (overpatrolled -- lower priority than count suggests):")
    print("  " + "-" * 76)
    for _, row in top_down.iterrows():
        print(f"  {row['police_station']:25s} | Count Rank: {row['count_rank']:2d} -> "
              f"Priority Rank: {row['priority_rank']:2d} | "
              f"Change: {row['rank_change']:d} | "
              f"Junction%: {row['junction_pct']:.0%}")

    print("=" * 80)

    return flip_table


def plot_rank_flip_chart(flip_table: pd.DataFrame):
    """
    Visualize rank changes as a diverging horizontal bar chart.
    """
    print("\n[Priority Scoring] Generating rank flip visualization ...")
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    # Sort by rank_change for visual impact
    plot_data = flip_table.sort_values("rank_change", ascending=True)

    # Color: green for UP (underpatrolled), red for DOWN (overpatrolled)
    colors = ["#2ECC71" if x > 0 else "#E74C3C" if x < 0 else "#95A5A6"
              for x in plot_data["rank_change"]]

    fig, ax = plt.subplots(figsize=(14, max(10, len(plot_data) * 0.4)))
    bars = ax.barh(
        range(len(plot_data)),
        plot_data["rank_change"],
        color=colors,
        edgecolor="white",
        linewidth=0.5,
    )
    ax.set_yticks(range(len(plot_data)))
    ax.set_yticklabels(plot_data["police_station"], fontsize=9)
    ax.set_xlabel("Rank Change (Count Rank - Priority Rank)", fontsize=12)
    ax.set_title("Zone Rank Flip: Naive Count vs Operational Priority\n"
                 "(Positive = Underpatrolled, Negative = Overpatrolled)",
                 fontsize=14, fontweight="bold")
    ax.axvline(x=0, color="black", linewidth=0.8)
    ax.grid(axis="x", alpha=0.3)

    # Add value labels
    for bar, val in zip(bars, plot_data["rank_change"]):
        if val != 0:
            ax.text(
                bar.get_width() + (0.3 if val > 0 else -0.3),
                bar.get_y() + bar.get_height() / 2,
                f"{'+' if val > 0 else ''}{val}",
                ha="left" if val > 0 else "right",
                va="center",
                fontsize=8,
                fontweight="bold",
            )

    fig.tight_layout()
    fig.savefig(RANK_FLIP_CHART_PATH, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved rank flip chart to {RANK_FLIP_CHART_PATH}")


def save_scored_violations(df: pd.DataFrame):
    """Save the full scored dataset to CSV."""
    print("\n[Priority Scoring] Saving scored violations ...")

    save_cols = [
        "id", "latitude", "longitude", "location", "vehicle_number",
        "resolved_vehicle_type", "primary_violation_type", "offence_code",
        "hour_ist", "day_of_week", "month",
        "police_station", "center_code", "junction_name", "is_junction",
        "validation_status", "data_sent_to_scita",
        # Scores
        "base_offence_weight", "junction_multiplier", "vehicle_weight",
        "hour_multiplier", "congestion_impact",
        "escalation_propensity", "operational_priority",
    ]

    # Only include columns that exist
    save_cols = [c for c in save_cols if c in df.columns]

    df[save_cols].to_csv(SCORED_VIOLATIONS_PATH, index=False)
    print(f"  Saved {len(df):,} scored records to {SCORED_VIOLATIONS_PATH}")


def run_priority_scoring(df: pd.DataFrame) -> tuple:
    """
    Full priority scoring pipeline.

    Returns: (df, zone_rankings, rank_flip_table)
    """
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    df = compute_operational_priority(df)
    ignored = identify_high_priority_ignored(df)
    zone_agg = build_zone_rankings(df)
    flip_table = build_rank_flip_table(zone_agg)
    plot_rank_flip_chart(flip_table)
    save_scored_violations(df)

    return df, zone_agg, flip_table


# ---------------------------------------------------------------------------
# Run standalone
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from data_preprocessing import preprocess
    from congestion_impact import compute_congestion_impact
    from escalation_model import train_and_evaluate

    df, encoders = preprocess(save_parquet=False)
    df = compute_congestion_impact(df)
    model, df, metrics = train_and_evaluate(df)
    df, zone_agg, flip_table = run_priority_scoring(df)
