"""
Component A — Rule-based Congestion Impact Formula.

Weight tables and logic replicated exactly from the v2.3 training script
(new_xgboost_training_script.py L84-144). String-keyed violation lookup
with fuzzy substring matching, scale 1.0–5.0.

    congestion_impact = base_offence_weight × junction_multiplier
                        × vehicle_weight × hour_multiplier
"""

import pandas as pd
import numpy as np

OFFENCE_WEIGHT_MAP: dict[str, float] = {
    "BLOCKING THE PASSAGE/CARRIAGEWAY": 5.0,
    "PARKING IN A MAIN ROAD": 4.5,
    "DOUBLE PARKING": 4.2,
    "PARKING NEAR ROAD CROSSING": 4.0,
    "PARKING NEAR TRAFFIC SIGNAL": 4.0,
    "PARKING NEAR BUS STOP": 3.8,
    "PARKING ON THE RIGHT SIDE": 3.5,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 3.5,
    "PARKING ON YELLOW LINE": 3.2,
    "WRONG PARKING": 3.0,
    "NO PARKING": 3.0,
    "PARKING NEAR FIRE HYDRANT": 3.0,
    "PARKING IN FRONT OF A HOSPITAL/ENTRANCE": 3.0,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 2.8,
    "FOOTPATH PARKING": 2.5,
    "PARKING ON FOOTPATH": 2.5,
    "PARKING IN FRONT OF GATE/ENTRANCE": 2.5,
    "PARKING OTHER THAN BUS STOP": 2.5,
    "EXPIRED PARKING": 1.5,
    "DEFECTIVE NUMBER PLATE": 1.2,
    "NO VALID FITNESS": 1.0,
    "REGISTRATION CERTIFICATE SUSPENDED": 1.0,
}
DEFAULT_OFFENCE_WEIGHT = 2.0

VEHICLE_WEIGHT_MAP: dict[str, float] = {
    "SCOOTER": 1.0, "MOPED": 1.0, "MOTORCYCLE": 1.0, "MOTOR CYCLE": 1.0,
    "BIKE": 1.0,
    "PASSENGER AUTO": 1.2, "AUTO": 1.2, "AUTO RICKSHAW": 1.2,
    "GOODS AUTO": 1.4, "CAR": 1.4, "JEEP": 1.4, "TAXI": 1.4,
    "SUV": 1.6, "VAN": 1.6, "LGV": 1.6,
    "MAXI-CAB": 1.8, "MINI BUS": 1.8, "TEMPO": 1.8,
    "PRIVATE BUS": 2.0, "TRACTOR": 2.0,
    "BUS": 2.2, "TRUCK": 2.2, "HEAVY VEHICLE": 2.2, "LORRY": 2.2,
}
DEFAULT_VEHICLE_WEIGHT = 1.3

JUNCTION_MULTIPLIER_YES = 1.6
JUNCTION_MULTIPLIER_NO = 1.0


def _offence_weight(primary_violation: str) -> float:
    v = str(primary_violation).strip().upper()
    if v in OFFENCE_WEIGHT_MAP:
        return OFFENCE_WEIGHT_MAP[v]
    for key, weight in OFFENCE_WEIGHT_MAP.items():
        if key in v or v in key:
            return weight
    return DEFAULT_OFFENCE_WEIGHT


def _junction_multiplier(junction_name) -> float:
    if pd.isna(junction_name) or str(junction_name).strip().upper() == "NO JUNCTION":
        return JUNCTION_MULTIPLIER_NO
    return JUNCTION_MULTIPLIER_YES


def _vehicle_weight(vehicle_type: str) -> float:
    v = str(vehicle_type).strip().upper()
    if v in VEHICLE_WEIGHT_MAP:
        return VEHICLE_WEIGHT_MAP[v]
    for key, weight in VEHICLE_WEIGHT_MAP.items():
        if key in v or v in key:
            return weight
    return DEFAULT_VEHICLE_WEIGHT


def _hour_multiplier(hour) -> float:
    if pd.isna(hour):
        return 1.0
    h = int(hour)
    if 7 <= h <= 9 or 17 <= h <= 19:
        return 1.5
    if 0 <= h <= 4:
        return 0.6
    return 1.0


def compute_congestion_impact(df: pd.DataFrame) -> pd.DataFrame:
    """Apply the Component A formula to every row."""
    df["base_offence_weight"] = df["primary_violation"].apply(_offence_weight)
    df["junction_multiplier"] = df["junction_name"].apply(_junction_multiplier)
    df["vehicle_weight"] = df["vehicle_type_clean"].apply(_vehicle_weight)
    df["hour_multiplier"] = df["hour"].apply(_hour_multiplier)
    df["congestion_impact"] = (
        df["base_offence_weight"]
        * df["junction_multiplier"]
        * df["vehicle_weight"]
        * df["hour_multiplier"]
    )
    return df


def compute_single(record: dict) -> float:
    """Compute congestion impact for a single record dict."""
    return (
        _offence_weight(record.get("primary_violation", "UNKNOWN"))
        * _junction_multiplier(record.get("junction_name"))
        * _vehicle_weight(record.get("vehicle_type_clean", "UNKNOWN"))
        * _hour_multiplier(record.get("hour"))
    )
