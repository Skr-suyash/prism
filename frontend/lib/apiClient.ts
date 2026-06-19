const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ZoneData {
  police_station: string;
  count: number;
  lat: number;
  lng: number;
  mean_priority: number;
  total_priority: number;
  mean_congestion: number;
  mean_propensity: number;
  junction_pct: number;
  count_rank: number;
  priority_rank: number;
  rank_change: number;
  priority_norm?: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  hour: number;
  vehicle: string;
  violation: string;
  zone: string;
  priority: number;
  priority_norm: number;
}

export interface HourlyData {
  hours: number[];
  counts: number[];
  priority: number[];
}

export interface Metrics {
  total_records: number;
  zones_tracked: number;
  ignored_high_impact: number;
  mean_congestion: number;
  mean_propensity: number;
  mean_priority: number;
}

export interface ScoreResult {
  congestion_impact: number;
  escalation_propensity: number;
  operational_priority: number;
}

export interface MisclassificationSummary {
  total_records: number;
  records_updated: number;
  mismatches: number;
  mismatch_rate: number;
  top_swaps: { swap: string; count: number }[];
}

export interface ConfusionCell {
  from_type: string;
  to_type: string;
  count: number;
}

export interface HourlyCorrection {
  hour: number;
  total: number;
  corrections: number;
  rate: number;
}

export interface StationCorrection {
  station: string;
  total: number;
  corrections: number;
  rate: number;
}

export interface ForecastSummary {
  total_predicted_24h: number;
  n_stations: number;
  forecast_start: string;
  forecast_end: string;
  model_version: string;
  mae: number;
  rmse: number;
  peak_hour_mae: number;
  top_station: string;
  top_station_hour: number;
  top_station_count: number;
}

export interface ForecastDispatch {
  station: string;
  hour: number;
  predicted_violation_count: number;
}

export interface ForecastHourlyTotal {
  hour: number;
  predicted_total: number;
}

export interface ForecastHeatmapRow {
  station: string;
  hours: Record<string, number>;
}

export interface StationForecastData {
  station: string;
  mae: number;
  mape: number;
  hourly: {
    station: string;
    hour: number;
    datetime: string;
    predicted_violation_count: number;
  }[];
}

export interface ClusterPoint {
  device_id: string;
  violation_count: number;
  mean_priority: number;
  cluster: number;
  archetype: string;
  most_common_violation: string;
}

export interface ClusterData {
  archetypes: Record<string, string>;
  scatter_data: ClusterPoint[];
}

export interface OffenderData {
  [archetype: string]: ClusterPoint[];
}

export interface HubData {
  zone: string;
  centrality_score: number;
  unique_offenders: number;
  total_repeat_violations: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  getZones: () => get<ZoneData[]>("/api/f1/zones"),
  getRankFlip: (n = 10) => get<ZoneData[]>(`/api/f1/rank-flip?top_n=${n}`),
  getMetrics: () => get<Metrics>("/api/f1/metrics"),
  
  getHeatmap: (hour?: number) =>
    get<HeatmapPoint[]>(hour !== undefined ? `/api/f2/heatmap?hour=${hour}` : "/api/f2/heatmap"),
  getZoneCircles: () => get<ZoneData[]>("/api/f2/zones"),
  getHourly: () => get<HourlyData>("/api/f2/hourly"),
  
  getForecastSummary: () => get<ForecastSummary>("/api/f7/summary"),
  getForecastDispatch: () => get<ForecastDispatch[]>("/api/f7/dispatch"),
  getForecastHourlyTotals: () => get<ForecastHourlyTotal[]>("/api/f7/hourly-totals"),
  getForecastHeatmap: () => get<ForecastHeatmapRow[]>("/api/f7/heatmap"),
  getStationForecast: (station: string) => get<StationForecastData>(`/api/f7/station/${encodeURIComponent(station)}`),
  getStationList: () => get<string[]>("/api/f7/stations"),
  getStationHourlyTotals: (station: string) => get<ForecastHourlyTotal[]>(`/api/f7/station-hourly/${encodeURIComponent(station)}`),
  
  getMisclassificationSummary: () => get<MisclassificationSummary>("/api/f4/summary"),
  getConfusionMatrix: () => get<ConfusionCell[]>("/api/f4/confusion-matrix"),
  getHourlyCorrections: () => get<HourlyCorrection[]>("/api/f4/temporal"),
  getStationCorrections: () => get<StationCorrection[]>("/api/f4/stations"),
  // Feature 5
  getClusters: () => get<ClusterData>("/api/f5/clusters"),
  getOffenders: () => get<OffenderData>("/api/f5/offenders"),
  getHubs: () => get<HubData[]>("/api/f5/hubs"),
  // Feature 6
  getEnforcementMatrix: () => get<any>("/api/f6/matrix"),
  allocateOfficers: (officers: number, maxPerCell: number = 3) => 
    get<any>(`/api/f6/allocate?officers=${officers}&max_per_cell=${maxPerCell}`),
};
