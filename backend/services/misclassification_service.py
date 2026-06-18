import pandas as pd

class MisclassificationService:
    def __init__(self):
        self.summary_cache = None
        self.confusion_matrix_cache = None
        self.temporal_cache = None
        self.station_cache = None

    def initialize(self, df: pd.DataFrame):
        print("[MisclassificationService] Initializing ...")
        
        # Base stats
        total_records = len(df)
        
        # We need the original and updated vehicle types
        # Some preprocessing might have filled NaNs, but we'll use raw columns if available
        # or just fallback to the existing ones
        
        # Ensure we're using the columns
        if 'vehicle_type' not in df.columns or 'vehicle_class' not in df.columns:
            print("[MisclassificationService] Missing required columns!")
            return

        vt = df['vehicle_type'].astype(str).str.strip().str.upper()
        uvt = df['vehicle_class'].astype(str).str.strip().str.upper()
        
        # Find valid updates (where updated_vehicle_type is not empty/nan string)
        has_update_mask = df['vehicle_class'].notna() & (df['vehicle_class'] != '') & (uvt != 'NAN') & (uvt != 'NULL')
        records_with_update = has_update_mask.sum()
        
        # Find mismatches
        mismatch_mask = has_update_mask & (vt != uvt)
        mismatches = mismatch_mask.sum()
        
        mismatch_rate = round(float(mismatches / records_with_update * 100), 2) if records_with_update > 0 else 0.0

        # Calculate top swaps
        mismatch_df = df[mismatch_mask].copy()
        mismatch_df['from_to'] = vt[mismatch_mask] + " → " + uvt[mismatch_mask]
        top_swaps = mismatch_df['from_to'].value_counts().head(5).to_dict()

        self.summary_cache = {
            "total_records": int(total_records),
            "records_updated": int(records_with_update),
            "mismatches": int(mismatches),
            "mismatch_rate": mismatch_rate,
            "top_swaps": [{"swap": k, "count": v} for k, v in top_swaps.items()]
        }

        # 1. Confusion Matrix
        cm = mismatch_df.groupby([vt[mismatch_mask], uvt[mismatch_mask]]).size().reset_index(name='count')
        cm.columns = ['from_type', 'to_type', 'count']
        self.confusion_matrix_cache = cm.to_dict(orient='records')

        # 2. Temporal Analysis (Hourly)
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
            temporal.append({
                "hour": h,
                "total": tot,
                "corrections": err,
                "rate": rate
            })
        self.temporal_cache = temporal

        # 3. Station Breakdown
        total_by_station = df_has_update.groupby('police_station').size()
        mismatch_by_station = mismatch_df.groupby('police_station').size()
        
        stations = []
        for station in mismatch_by_station.index:
            tot = int(total_by_station.get(station, 0))
            err = int(mismatch_by_station.get(station, 0))
            if tot > 50: # Only consider stations with at least some volume
                rate = round(float(err / tot * 100), 2)
                stations.append({
                    "station": str(station),
                    "total": tot,
                    "corrections": err,
                    "rate": rate
                })
                
        # Sort by rate descending
        stations.sort(key=lambda x: x['rate'], reverse=True)
        self.station_cache = stations[:50] # Top 50 stations
        
        print("[MisclassificationService] Ready.")

    def get_summary(self):
        return self.summary_cache

    def get_confusion_matrix(self):
        return self.confusion_matrix_cache

    def get_temporal(self):
        return self.temporal_cache

    def get_stations(self):
        return self.station_cache
