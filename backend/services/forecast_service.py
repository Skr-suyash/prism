"""Forecast service - serves precomputed forecast data from the training pipeline."""

import json
from pathlib import Path


class ForecastService:
    def __init__(self):
        self.data = None

    def initialize(self):
        print("[ForecastService] Loading forecast data...")
        data_path = Path(__file__).parent.parent / "models" / "forecast_api_data.json"
        metrics_path = Path(__file__).parent.parent / "models" / "forecast_eval_metrics.json"

        if not data_path.exists():
            print(f"[ForecastService] WARNING: {data_path} not found. Run train_forecast_model.py first.")
            self.data = None
            return

        with open(data_path, "r") as f:
            self.data = json.load(f)

        self.eval_metrics = {}
        if metrics_path.exists():
            with open(metrics_path, "r") as f:
                self.eval_metrics = json.load(f)

        n_forecasts = len(self.data.get("forecasts", []))
        n_stations = len(self.data.get("heatmap_data", []))
        print(f"[ForecastService] Ready. {n_forecasts} forecasts across {n_stations} stations.")

    def get_summary(self):
        """Overall forecast summary with model metrics."""
        if not self.data:
            return {"error": "Forecast data not available"}

        forecasts = self.data["forecasts"]
        total_predicted = sum(f["predicted_violation_count"] for f in forecasts)
        top_station = forecasts[0] if forecasts else {}

        metrics = self.data.get("metrics", {})
        return {
            "total_predicted_24h": round(total_predicted, 0),
            "n_stations": len(self.data.get("heatmap_data", [])),
            "forecast_start": self.data.get("forecast_start", ""),
            "forecast_end": self.data.get("forecast_end", ""),
            "model_version": self.data.get("model_version", "unknown"),
            "mae": metrics.get("overall_mae", 0),
            "rmse": metrics.get("overall_rmse", 0),
            "peak_hour_mae": metrics.get("peak_hour_mae", 0),
            "top_station": top_station.get("station", ""),
            "top_station_hour": top_station.get("hour", 0),
            "top_station_count": top_station.get("predicted_violation_count", 0),
        }

    def get_heatmap(self):
        """Heatmap data: each station with 24 hourly predictions."""
        if not self.data:
            return []
        return self.data.get("heatmap_data", [])

    def get_dispatch(self):
        """Top 20 highest-risk station-hours for dispatch priority."""
        if not self.data:
            return []
        return self.data.get("dispatch_priority", [])

    def get_hourly_totals(self):
        """Aggregate predicted violations by hour across all stations."""
        if not self.data:
            return []

        forecasts = self.data.get("forecasts", [])
        hourly = {}
        for f in forecasts:
            h = f["hour"]
            hourly[h] = hourly.get(h, 0) + f["predicted_violation_count"]

        return [
            {"hour": h, "predicted_total": round(hourly.get(h, 0), 1)}
            for h in range(24)
        ]

    def get_station_forecast(self, station: str):
        """Get 24-hour forecast for a specific station."""
        if not self.data:
            return []

        forecasts = self.data.get("forecasts", [])
        station_data = [f for f in forecasts if f["station"] == station]
        station_data.sort(key=lambda x: x["hour"])

        # Add station metrics if available
        station_metrics = self.data.get("station_metrics", {}).get(station, {})
        return {
            "station": station,
            "mae": station_metrics.get("mae"),
            "mape": station_metrics.get("mape"),
            "hourly": station_data,
        }

    def get_station_list(self):
        """Return list of all station names."""
        if not self.data:
            return []
        return [row["station"] for row in self.data.get("heatmap_data", [])]

    def get_station_hourly_totals(self, station: str):
        """Aggregate predicted violations by hour for a specific station."""
        if not self.data:
            return []

        forecasts = self.data.get("forecasts", [])
        hourly = {}
        for f in forecasts:
            if f["station"] == station:
                h = f["hour"]
                hourly[h] = hourly.get(h, 0) + f["predicted_violation_count"]

        return [
            {"hour": h, "predicted_total": round(hourly.get(h, 0), 1)}
            for h in range(24)
        ]
