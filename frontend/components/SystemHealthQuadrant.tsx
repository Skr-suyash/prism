"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle, Shield, RefreshCw, Info } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BucketData {
  station: string;
  hour_bin: number;
  violation: string;
  volume: number;
  sync_rate: number;
  rejection_rate: number;
  duplicate_rate: number;
  anomaly_score?: number;
  is_blindspot: boolean;
}

const HOUR_BIN_LABELS: Record<number, string> = {
  0: "Night (00–05)",
  1: "Morning (06–11)",
  2: "Afternoon (12–17)",
  3: "Evening (18–23)",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ────────────────────────────────────────────────────────── */
/*  Custom Tooltip                                            */
/* ────────────────────────────────────────────────────────── */
function QuadrantTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: BucketData = payload[0].payload;

  return (
    <div className="bg-gray-900 text-white text-xs px-4 py-3 rounded-lg shadow-xl max-w-xs">
      {/* Station */}
      <div className="font-bold text-gray-300 mb-2 flex items-center gap-1.5">
        {d.is_blindspot ? (
          <AlertTriangle className="w-3 h-3 text-red-400" />
        ) : (
          <Shield className="w-3 h-3 text-emerald-400" />
        )}
        <span className="text-white">{d.station}</span>
      </div>

      {/* Context */}
      <div className="flex flex-col gap-0.5 mb-2">
        <div>
          Hour: <span className="font-semibold">{HOUR_BIN_LABELS[d.hour_bin] ?? `Bin ${d.hour_bin}`}</span>
        </div>
        <div>
          Violation: <span className="font-semibold">{d.violation}</span>
        </div>
        <div className="text-gray-400 text-[10px]">Volume: {d.volume.toLocaleString()}</div>
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-0.5 pt-2 border-t border-gray-700">
        <div>
          Sync Rate: <span className="text-cyan-400 font-bold">{(d.sync_rate * 100).toFixed(1)}%</span>
        </div>
        <div>
          Rejection Rate: <span className="text-amber-400 font-bold">{(d.rejection_rate * 100).toFixed(1)}%</span>
        </div>
        <div>
          Duplicate Rate: <span className="text-slate-400 font-bold">{(d.duplicate_rate * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Status */}
      <div className="mt-2 pt-2 border-t border-gray-700">
        {d.is_blindspot ? (
          <span className="text-red-400 font-bold text-[10px] uppercase tracking-wider">⚠ Anomaly Detected</span>
        ) : (
          <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider">✓ Nominal</span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Main Component                                            */
/* ────────────────────────────────────────────────────────── */
export default function SystemHealthQuadrant({ onDataLoaded }: { onDataLoaded?: (data: BucketData[]) => void }) {
  const [data, setData] = useState<BucketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/audit/quadrant`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BucketData[] = await res.json();
      setData(json);
      if (onDataLoaded) onDataLoaded(json);
    } catch (err: any) {
      setError(err.message ?? "Failed to load audit data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const blindspots = data.filter((d) => d.is_blindspot);
  const normals = data.filter((d) => !d.is_blindspot);

  // Volume range for bubble sizing
  const volumes = data.map((d) => d.volume);
  const minVol = Math.min(...(volumes.length ? volumes : [0]));
  const maxVol = Math.max(...(volumes.length ? volumes : [1]));

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center min-h-[520px]">
        <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-gray-500 text-xs tracking-wide uppercase font-medium">
          Loading Anomaly Data…
        </p>
      </div>
    );
  }

  /* ── Error State ── */
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[520px]">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-red-500 text-sm font-medium mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-start justify-between rounded-t-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              {t.titles.systemHealth}
            </h2>
            <div className="relative group">
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
              <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
                {t.tooltips.systemHealth}
                <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-800 transform rotate-45" />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {t.componentSubtitles.systemHealth}
          </p>
        </div>

        {/* Summary Pills */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest font-bold">
            <AlertTriangle className="w-3 h-3" />
            {blindspots.length} Blindspots
          </span>
          <span className="flex items-center gap-1.5 text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest font-bold">
            <Shield className="w-3 h-3" />
            {normals.length} Nominal
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <ResponsiveContainer width="100%" height={480}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 50 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              vertical
              horizontal
            />
            <XAxis
              type="number"
              dataKey="sync_rate"
              domain={[0, 1]}
              name="Data Delivery Success"
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={{ stroke: "#d1d5db" }}
              tickLine={{ stroke: "#d1d5db" }}
              label={{
                value: "Data Delivery Success (Sync Rate)",
                position: "insideBottom",
                offset: -15,
                style: { fill: "#6b7280", fontSize: 12, fontWeight: 600 },
              }}
            />
            <YAxis
              type="number"
              dataKey="rejection_rate"
              domain={[0, 1]}
              name="Data Quality Failure"
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={{ stroke: "#d1d5db" }}
              tickLine={{ stroke: "#d1d5db" }}
              label={{
                value: "Data Quality Failure (Rejection Rate)",
                angle: -90,
                position: "insideLeft",
                offset: 15,
                dx: -25,
                dy: 50,
                style: { fill: "#6b7280", fontSize: 12, fontWeight: 600 },
              }}
            />
            <ZAxis
              type="number"
              dataKey="volume"
              domain={[minVol, maxVol]}
              range={[40, 400]}
              name="Volume"
            />
            <Tooltip
              content={<QuadrantTooltip />}
              cursor={{ strokeDasharray: "3 3", stroke: "#9ca3af" }}
              isAnimationActive={false}
            />

            {/* Normal buckets (rendered first, behind) */}
            <Scatter name="Nominal" data={normals} isAnimationActive={false}>
              {normals.map((_, i) => (
                <Cell
                  key={`normal-${i}`}
                  fill="#334155"
                  fillOpacity={0.3}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                />
              ))}
            </Scatter>

            {/* Blindspots (rendered on top) */}
            <Scatter name="Blindspot" data={blindspots} isAnimationActive={false}>
              {blindspots.map((_, i) => (
                <Cell
                  key={`blind-${i}`}
                  fill="#ef4444"
                  fillOpacity={0.8}
                  stroke="#dc2626"
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
            <span className="text-xs text-gray-500 font-medium">
              Blindspot ({blindspots.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-700 opacity-30" />
            <span className="text-xs text-gray-500 font-medium">
              Nominal ({normals.length})
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
