"""
Phase 1: Data Preprocessing Pipeline
=====================================
Loads the raw parking violation CSV, cleans it, engineers features,
and prepares it for downstream congestion impact scoring and XGBoost modeling.

Key steps:
  1. Load CSV with proper dtypes
  2. Parse created_datetime → convert UTC to IST (Asia/Kolkata)
  3. Extract temporal features: hour_ist, day_of_week, month
  4. Parse JSON-string columns: offence_code, violation_type
  5. Filter out non-parking offences (keep only codes 104–109, 111–113)
  6. Resolve vehicle type: prefer updated_vehicle_type, fallback to vehicle_type
  7. Create binary junction feature: is_junction
  8. Label-encode categorical features for XGBoost
"""

import ast
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import os
import pickle

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_PATH = os.path.join("datasets", "jan to may police violation_anonymized791b166.csv")

# Parking-related offence codes only (non-parking codes are excluded entirely)
PARKING_OFFENCE_CODES = {104, 105, 106, 107, 108, 109, 111, 112, 113}

OUTPUTS_DIR = "outputs"


def load_raw_data(path: str = DATA_PATH) -> pd.DataFrame:
    """Load the raw CSV file."""
    print(f"[Preprocessing] Loading data from {path} ...")
    df = pd.read_csv(path)
    print(f"[Preprocessing] Loaded {len(df):,} records with {len(df.columns)} columns.")
    return df


def parse_datetime_to_ist(df: pd.DataFrame) -> pd.DataFrame:
    """
    Parse created_datetime to timezone-aware datetime, then convert to IST.
    The raw data has mixed datetime formats, all in UTC (+00).
    """
    print("[Preprocessing] Parsing datetimes and converting to IST ...")
    df["created_datetime"] = pd.to_datetime(
        df["created_datetime"], format="mixed", utc=True
    )
    # Convert to IST (Asia/Kolkata = UTC+5:30)
    df["created_datetime_ist"] = df["created_datetime"].dt.tz_convert("Asia/Kolkata")
    return df


def extract_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Extract hour (IST), day_of_week, and month from IST datetime."""
    print("[Preprocessing] Extracting temporal features (hour_ist, day_of_week, month) ...")
    df["hour_ist"] = df["created_datetime_ist"].dt.hour
    df["day_of_week"] = df["created_datetime_ist"].dt.dayofweek  # 0=Mon, 6=Sun
    df["month"] = df["created_datetime_ist"].dt.month
    return df


def parse_json_column(value: str) -> list:
    """Safely parse a JSON-like string column (e.g., '[112,107]' or '["WRONG PARKING"]')."""
    if pd.isna(value):
        return []
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, list):
            return parsed
        return [parsed]
    except (ValueError, SyntaxError):
        return []


def parse_offence_and_violation(df: pd.DataFrame) -> pd.DataFrame:
    """
    Parse the JSON-string offence_code and violation_type columns into lists.
    Creates:
      - offence_codes_list: list of integer codes per record
      - violation_types_list: list of string violation types per record
      - primary_violation_type: first violation type in the list (for XGBoost feature)
      - primary_offence_code: first offence code (for reference)
    """
    print("[Preprocessing] Parsing offence_code and violation_type JSON arrays ...")
    df["offence_codes_list"] = df["offence_code"].apply(parse_json_column)
    df["violation_types_list"] = df["violation_type"].apply(parse_json_column)

    # Primary (first) values for feature encoding
    df["primary_offence_code"] = df["offence_codes_list"].apply(
        lambda x: x[0] if len(x) > 0 else np.nan
    )
    df["primary_violation_type"] = df["violation_types_list"].apply(
        lambda x: x[0] if len(x) > 0 else "UNKNOWN"
    )
    return df


def filter_parking_offences(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove records where ALL offence codes are non-parking related.
    A record is kept if it contains at least one parking-related offence code
    (104–109, 111–113).

    Also filters the offence_codes_list to retain only parking codes.
    """
    print("[Preprocessing] Filtering non-parking offences ...")
    original_count = len(df)

    # Check if any code in the list is a parking code
    df["has_parking_offence"] = df["offence_codes_list"].apply(
        lambda codes: any(c in PARKING_OFFENCE_CODES for c in codes)
    )
    df = df[df["has_parking_offence"]].copy()
    removed = original_count - len(df)
    print(f"[Preprocessing] Removed {removed:,} non-parking records. Remaining: {len(df):,}")

    # Filter the offence_codes_list to keep only parking codes
    df["offence_codes_list"] = df["offence_codes_list"].apply(
        lambda codes: [c for c in codes if c in PARKING_OFFENCE_CODES]
    )

    # Update primary_offence_code after filtering
    df["primary_offence_code"] = df["offence_codes_list"].apply(
        lambda x: x[0] if len(x) > 0 else np.nan
    )

    # Drop the helper column
    df = df.drop(columns=["has_parking_offence"])
    return df


def resolve_vehicle_type(df: pd.DataFrame) -> pd.DataFrame:
    """
    Use updated_vehicle_type where available (validated records),
    fall back to vehicle_type otherwise.
    """
    print("[Preprocessing] Resolving vehicle type (prefer updated_vehicle_type) ...")
    df["resolved_vehicle_type"] = df["updated_vehicle_type"].fillna(df["vehicle_type"])
    # Standardize to uppercase
    df["resolved_vehicle_type"] = df["resolved_vehicle_type"].str.upper().str.strip()
    return df


def create_junction_feature(df: pd.DataFrame) -> pd.DataFrame:
    """Create binary is_junction feature: 1 if at a named junction, 0 otherwise."""
    print("[Preprocessing] Creating binary junction feature ...")
    df["is_junction"] = (df["junction_name"] != "No Junction").astype(int)
    junction_count = df["is_junction"].sum()
    print(f"[Preprocessing] Junction records: {junction_count:,} / {len(df):,} "
          f"({100 * junction_count / len(df):.1f}%)")
    return df


def label_encode_categoricals(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Label-encode categorical features for XGBoost:
      - resolved_vehicle_type → vehicle_type_encoded
      - primary_violation_type → violation_type_encoded
      - police_station → police_station_encoded
      - junction_name → junction_name_encoded (kept for reference, is_junction is the binary)

    Returns:
      - df with new encoded columns
      - encoders dict mapping column name → fitted LabelEncoder
    """
    print("[Preprocessing] Label-encoding categorical features ...")
    encoders = {}
    encode_map = {
        "resolved_vehicle_type": "vehicle_type_encoded",
        "primary_violation_type": "violation_type_encoded",
        "police_station": "police_station_encoded",
    }

    for source_col, target_col in encode_map.items():
        le = LabelEncoder()
        # Fill NaN with 'UNKNOWN' before encoding
        col_filled = df[source_col].fillna("UNKNOWN").astype(str)
        df[target_col] = le.fit_transform(col_filled)
        encoders[source_col] = le
        print(f"  {source_col} -> {target_col}: {len(le.classes_)} unique values")

    return df, encoders


def preprocess(save_parquet: bool = True) -> tuple[pd.DataFrame, dict]:
    """
    Run the full preprocessing pipeline.

    Returns:
      - Processed DataFrame
      - Dictionary of fitted LabelEncoders
    """
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    df = load_raw_data()
    df = parse_datetime_to_ist(df)
    df = extract_temporal_features(df)
    df = parse_offence_and_violation(df)
    df = filter_parking_offences(df)
    df = resolve_vehicle_type(df)
    df = create_junction_feature(df)
    df, encoders = label_encode_categoricals(df)

    # Summary statistics
    print("\n" + "=" * 60)
    print("[Preprocessing] SUMMARY")
    print("=" * 60)
    print(f"  Total records after filtering: {len(df):,}")
    print(f"  Validation status breakdown:")
    for status, count in df["validation_status"].value_counts(dropna=False).items():
        label = status if pd.notna(status) else "NaN (unresolved)"
        print(f"    {label}: {count:,}")
    print(f"  Vehicle types: {df['resolved_vehicle_type'].nunique()}")
    print(f"  Police stations (zones): {df['police_station'].nunique()}")
    print(f"  Junction records: {df['is_junction'].sum():,}")
    print(f"  Hour range (IST): {df['hour_ist'].min()} – {df['hour_ist'].max()}")
    print("=" * 60)

    if save_parquet:
        parquet_path = os.path.join(OUTPUTS_DIR, "processed_violations.parquet")
        # Select serializable columns (drop timezone-aware for parquet compatibility)
        save_df = df.copy()
        # Convert tz-aware datetimes to tz-naive for parquet
        for col in save_df.select_dtypes(include=["datetimetz"]).columns:
            save_df[col] = save_df[col].dt.tz_localize(None)
        save_df.to_parquet(parquet_path, index=False)
        print(f"\n[Preprocessing] Saved processed data to {parquet_path}")

        # Save encoders for later use
        encoder_path = os.path.join(OUTPUTS_DIR, "label_encoders.pkl")
        with open(encoder_path, "wb") as f:
            pickle.dump(encoders, f)
        print(f"[Preprocessing] Saved label encoders to {encoder_path}")

    return df, encoders


# ---------------------------------------------------------------------------
# Run standalone
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    df, encoders = preprocess()
    print(f"\nProcessed DataFrame shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
