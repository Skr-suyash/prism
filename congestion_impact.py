"""
Phase 2: Congestion Impact Formula (Component A)
=================================================
A transparent, multiplicative, domain-justified formula applied to every
violation record. No model, no proxy -- just defensible domain logic.

    congestion_impact = base_offence_weight x junction_multiplier
                        x vehicle_weight x hour_multiplier

Every weight is justifiable from first principles:
  - base_offence_weight:  ranked by how much the offence blocks traffic flow
  - junction_multiplier:  junctions choke multiple lanes simultaneously
  - vehicle_weight:       larger vehicles block more carriageway
  - hour_multiplier:      peak hours amplify impact, midnight diminishes it
"""

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Weight Definitions
# ---------------------------------------------------------------------------

# base_offence_weight — ranked by offence code's congestion blocking severity
BASE_OFFENCE_WEIGHT = {
    107: 2.5,   # PARKING IN A MAIN ROAD — directly blocks carriageway lane
    109: 2.5,   # DOUBLE PARKING — blocks entire lane adjacent to parked vehicle
    108: 2.2,   # PARKING OPPOSITE ANOTHER VEHICLE — narrows road to single lane
    104: 2.0,   # PARKING NEAR ROAD CROSSING — blocks crossing, forces blind turns
    106: 2.0,   # PARKING NEAR TRAFFIC LIGHT/ZEBRA — blocks signal visibility
    111: 1.8,   # PARKING NEAR BUS STOP/SCHOOL/HOSPITAL — blocks high-traffic zones
    105: 1.5,   # PARKING ON FOOTPATH — pushes pedestrians onto carriageway
    112: 1.3,   # WRONG PARKING — general misplacement, variable impact
    113: 1.3,   # NO PARKING — in restricted zone, variable impact
}
DEFAULT_OFFENCE_WEIGHT = 1.0  # Fallback for any unrecognized parking code

# junction_multiplier
JUNCTION_MULTIPLIER_AT_JUNCTION = 1.6  # Junctions choke multiple lanes simultaneously
JUNCTION_MULTIPLIER_NO_JUNCTION = 1.0

# vehicle_weight — based on physical carriageway footprint
VEHICLE_WEIGHT = {
    # Small two-wheelers (smallest footprint)
    "SCOOTER": 1.0,
    "MOPED": 1.0,
    "MOTOR CYCLE": 1.0,
    # Three-wheelers (moderate footprint)
    "PASSENGER AUTO": 1.2,
    "GOODS AUTO": 1.2,
    # Standard four-wheelers
    "CAR": 1.4,
    "JEEP": 1.4,
    "VAN": 1.4,
    "OTHERS": 1.4,         # Default to car-equivalent
    # Large passenger vehicles
    "MAXI-CAB": 1.8,
    "SCHOOL VEHICLE": 1.8,
    "FACTORY BUS": 1.8,
    # Light goods vehicles
    "LGV": 1.8,
    "TEMPO": 1.8,
    "MINI LORRY": 1.8,
    # Full-size buses
    "PRIVATE BUS": 2.2,
    "TOURIST BUS": 2.2,
    "BUS (BMTC/KSRTC)": 2.2,
    # Heavy goods vehicles
    "HGV": 2.2,
    "LORRY/GOODS VEHICLE": 2.2,
    "TANKER": 2.2,
    "TRACTOR": 2.2,
}
DEFAULT_VEHICLE_WEIGHT = 1.4  # Fallback to car-equivalent


def get_hour_multiplier(hour_ist: int) -> float:
    """
    Hour multiplier based on IST traffic patterns.

    Peak hours:  7-10 AM, 5-8 PM  -> 1.5x
    Midnight:    0-5 AM           -> 0.6x
    Normal:      all other hours  -> 1.0x
    """
    if 7 <= hour_ist <= 9:      # 7:00 AM - 9:59 AM (morning peak)
        return 1.5
    elif 17 <= hour_ist <= 19:   # 5:00 PM - 7:59 PM (evening peak)
        return 1.5
    elif 0 <= hour_ist <= 4:     # 12:00 AM - 4:59 AM (midnight)
        return 0.6
    else:
        return 1.0


def compute_base_offence_weight(offence_codes_list: list) -> float:
    """
    For multi-offence records, take the max weight across all parking codes.
    This captures worst-case blocking impact.
    """
    if not offence_codes_list or len(offence_codes_list) == 0:
        return DEFAULT_OFFENCE_WEIGHT
    weights = [BASE_OFFENCE_WEIGHT.get(code, DEFAULT_OFFENCE_WEIGHT)
               for code in offence_codes_list]
    return max(weights)


def compute_vehicle_weight(vehicle_type: str) -> float:
    """Look up vehicle weight by type, defaulting to car-equivalent."""
    if pd.isna(vehicle_type):
        return DEFAULT_VEHICLE_WEIGHT
    return VEHICLE_WEIGHT.get(vehicle_type.upper().strip(), DEFAULT_VEHICLE_WEIGHT)


def compute_congestion_impact(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply the congestion impact formula to every record.

    Requires columns: offence_codes_list, is_junction, resolved_vehicle_type, hour_ist

    Creates columns:
      - base_offence_weight
      - junction_multiplier
      - vehicle_weight
      - hour_multiplier
      - congestion_impact (the product of the four)
    """
    print("[Congestion Impact] Computing congestion impact scores ...")

    # 1. Base offence weight (max across multi-offence records)
    df["base_offence_weight"] = df["offence_codes_list"].apply(compute_base_offence_weight)

    # 2. Junction multiplier
    df["junction_multiplier"] = df["is_junction"].apply(
        lambda x: JUNCTION_MULTIPLIER_AT_JUNCTION if x == 1
        else JUNCTION_MULTIPLIER_NO_JUNCTION
    )

    # 3. Vehicle weight
    df["vehicle_weight"] = df["resolved_vehicle_type"].apply(compute_vehicle_weight)

    # 4. Hour multiplier
    df["hour_multiplier"] = df["hour_ist"].apply(get_hour_multiplier)

    # 5. Combined congestion impact (multiplicative)
    df["congestion_impact"] = (
        df["base_offence_weight"]
        * df["junction_multiplier"]
        * df["vehicle_weight"]
        * df["hour_multiplier"]
    )

    # Summary statistics
    print("\n" + "=" * 60)
    print("[Congestion Impact] FORMULA SUMMARY")
    print("=" * 60)
    print(f"  congestion_impact = base_offence_weight x junction_multiplier")
    print(f"                      x vehicle_weight x hour_multiplier")
    print(f"")
    print(f"  Score range: {df['congestion_impact'].min():.2f} - {df['congestion_impact'].max():.2f}")
    print(f"  Mean:        {df['congestion_impact'].mean():.2f}")
    print(f"  Median:      {df['congestion_impact'].median():.2f}")
    print(f"  Std:         {df['congestion_impact'].std():.2f}")
    print(f"")
    print(f"  Component distributions:")
    print(f"    base_offence_weight: mean={df['base_offence_weight'].mean():.2f}, "
          f"values={dict(df['base_offence_weight'].value_counts().sort_index())}")
    print(f"    junction_multiplier: {dict(df['junction_multiplier'].value_counts().sort_index())}")
    print(f"    vehicle_weight:      mean={df['vehicle_weight'].mean():.2f}")
    print(f"    hour_multiplier:     {dict(df['hour_multiplier'].value_counts().sort_index())}")
    print("=" * 60)

    return df


# ---------------------------------------------------------------------------
# Run standalone (for testing)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from data_preprocessing import preprocess
    df, encoders = preprocess(save_parquet=False)
    df = compute_congestion_impact(df)
    print(f"\nTop 10 highest congestion impact records:")
    top = df.nlargest(10, "congestion_impact")[
        ["id", "resolved_vehicle_type", "primary_violation_type",
         "junction_name", "hour_ist", "congestion_impact"]
    ]
    print(top.to_string(index=False))
