import pandas as pd
import numpy as np
import json
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

# ---------------------------------------------------------
# PHASE 1: DATA LOADING & PREPARATION
# ---------------------------------------------------------
print("Loading dataset...")
file_path = 'datasets/jan to may police violation_anonymized791b166.csv'
df = pd.read_csv(file_path)

# Ensure datetime parsing is explicit and vectorized
df['created_datetime'] = pd.to_datetime(df['created_datetime'], errors='coerce')

# Drop records with entirely missing critical spatial/temporal data
df = df.dropna(subset=['police_station', 'created_datetime', 'violation_type'])

# Extract Hour Bin (0: Night, 1: Morning, 2: Afternoon, 3: Evening)
df['hour_bin'] = df['created_datetime'].dt.hour // 6

# Standardize text to prevent accidental category splitting
df['validation_status'] = df['validation_status'].str.lower().fillna('unknown')
df['data_sent_to_scita'] = df['data_sent_to_scita'].astype(bool)

# 1. Clean the violation strings (extract just the primary violation or strip the brackets)
# 1. Clean strings AND extract only the primary violation before the comma
df['violation_type'] = df['violation_type'].astype(str).str.replace(r'\[|\]|"', '', regex=True).str.split(',').str[0].str.strip()
# ---------------------------------------------------------
# PHASE 2: MACRO-AGGREGATION
# We compress 300k+ rows into structural operational buckets.
# ---------------------------------------------------------
print("Aggregating operational buckets...")

# Create binary flags for our pipeline metrics
df['is_synced'] = df['data_sent_to_scita'].astype(int)
df['is_rejected'] = (df['validation_status'] == 'rejected').astype(int)
df['is_duplicate'] = (df['validation_status'] == 'duplicate').astype(int)

# Group by our operational context
bucket_group = df.groupby(['police_station', 'hour_bin', 'violation_type'])

buckets_df = bucket_group.agg(
    volume=('id', 'count'),
    sync_rate=('is_synced', 'mean'),
    rejection_rate=('is_rejected', 'mean'),
    duplicate_rate=('is_duplicate', 'mean')
).reset_index()


buckets_df = buckets_df[buckets_df['volume'] >= 50].copy()

# 2. Log-transform the volume to prevent massive stations from skewing the model
buckets_df['volume_log'] = np.log1p(buckets_df['volume'])

# ---------------------------------------------------------
# PHASE 3: SCALING
# ---------------------------------------------------------
print("Scaling continuous features...")
features = ['volume_log', 'sync_rate', 'rejection_rate', 'duplicate_rate']

scaler = StandardScaler()
X_scaled = scaler.fit_transform(buckets_df[features])

# ---------------------------------------------------------
# PHASE 4: ISOLATION FOREST TRAINING
# ---------------------------------------------------------
print("Training Isolation Forest...")
iso_forest = IsolationForest(
    n_estimators=200, 
    contamination=0.05, 
    random_state=42,
    n_jobs=-1
)

iso_forest.fit(X_scaled)

# ---------------------------------------------------------
# PHASE 5: SCORING & EXPORT
# ---------------------------------------------------------
buckets_df['anomaly_score'] = iso_forest.score_samples(X_scaled) * -1
buckets_df['is_blindspot'] = iso_forest.predict(X_scaled) == -1

# Isolate the critical failures
critical_blindspots = buckets_df[buckets_df['is_blindspot'] == True].sort_values(by='anomaly_score', ascending=False)

print(f"\nDiscovered {len(critical_blindspots)} critical structural blindspots out of {len(buckets_df)} valid operational buckets.")

print("\nTop 5 Worst Operational Contexts:")
# Print all relevant metrics so we can see exactly WHY it was flagged
print(critical_blindspots[['police_station', 'hour_bin', 'violation_type', 'volume', 'sync_rate', 'rejection_rate']].head(10))

# Save artifacts for the FastAPI Backend
joblib.dump(scaler, 'blindspot_scaler.pkl')
joblib.dump(iso_forest, 'blindspot_isoforest.pkl')
critical_blindspots.to_csv('critical_blindspots_export.csv', index=False)

print("\nPipeline complete. Artifacts exported.")