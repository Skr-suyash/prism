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
};
