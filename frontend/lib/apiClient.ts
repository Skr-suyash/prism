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
