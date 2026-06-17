"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import { api, type HeatmapPoint } from "@/lib/apiClient";
import { Clock, AlertTriangle } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: 77.5946,
  latitude: 12.9716,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

const HEAT_GRADIENT: [number, number, number][] = [
  [6, 17, 38],
  [14, 42, 92],
  [16, 91, 135],
  [64, 154, 102],
  [247, 192, 49],
  [231, 76, 60],
];

function alertColor(norm: number): [number, number, number, number] {
  return norm < 0.5 ? [230, 126, 34, 230] : [231, 76, 60, 255];
}

function MapOverlay({ title, subtitle, accent }: { title: string; subtitle: string; accent: string }) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-slate-950/80 border border-slate-700/50 backdrop-blur-md rounded-xl px-4 py-2.5 max-w-[240px] pointer-events-none">
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${accent}`}>{subtitle}</p>
      <p className="text-sm font-medium text-slate-200 mt-0.5 leading-snug">{title}</p>
    </div>
  );
}

export default function DualHeatmap() {
  const [allPoints, setAllPoints] = useState<HeatmapPoint[]>([]);
  const [hour, setHour] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState(INITIAL_VIEW);

  useEffect(() => {
    api.getHeatmap().then((d) => { setAllPoints(d); setLoading(false); }).catch(console.error);
  }, []);

  // Stable view state handler — no closure over any data arrays
  const onViewStateChange = useCallback(
    ({ viewState: vs }: { viewState: typeof INITIAL_VIEW }) => {
      setViewState(vs);
    },
    [] // empty deps — never recreated
  );

  // Memoize filtered slice — only recomputes when allPoints or hour change, NOT on every pan
  const filtered = useMemo(
    () => (hour === -1 ? allPoints : allPoints.filter((p) => p.hour === hour)),
    [allPoints, hour]
  );

  // Memoize density input array
  const densityData = useMemo(
    () => filtered.map((p) => ({ pos: [p.lng, p.lat] as [number, number] })),
    [filtered]
  );

  // Memoize priority input array
  const priorityData = useMemo(
    () => filtered.map((p) => ({ pos: [p.lng, p.lat] as [number, number], weight: p.priority })),
    [filtered]
  );

  // Memoize top-50 critical alerts
  const criticals = useMemo(
    () => [...filtered].sort((a, b) => b.priority - a.priority).slice(0, 50),
    [filtered]
  );

  // Discretize zoom to integer levels. 
  // If we use the raw viewState.zoom, we trigger a massive GPU re-aggregation 60 times a second during scrolling.
  const roundedZoom = Math.floor(viewState.zoom);

  // Memoize LEFT layers — rebuilt when densityData or roundedZoom changes
  const leftLayers = useMemo(
    () => [
      new HeatmapLayer({
        id: "density-heat",
        data: densityData,
        getPosition: (d) => d.pos,
        getWeight: () => 1,
        aggregation: "SUM",
        radiusPixels: Math.max(30, roundedZoom * 3),
        intensity: Math.max(1, (roundedZoom - 10) * 2),
        threshold: 0.03,
        colorRange: HEAT_GRADIENT,
      }),
    ],
    [densityData, roundedZoom]
  );

  // Memoize RIGHT layers — rebuilt when priorityData, criticals, or roundedZoom change
  const rightLayers = useMemo(
    () => [
      new HeatmapLayer({
        id: "priority-heat",
        data: priorityData,
        getPosition: (d) => d.pos,
        getWeight: (d) => d.weight,
        aggregation: "SUM",
        radiusPixels: Math.max(30, roundedZoom * 3),
        intensity: Math.max(1.5, (roundedZoom - 10) * 3),
        threshold: 0.03,
        colorRange: HEAT_GRADIENT,
      }),
      new ScatterplotLayer({
        id: "critical-alerts",
        data: criticals,
        getPosition: (p) => [p.lng, p.lat],
        getFillColor: (p) => alertColor(p.priority_norm),
        getLineColor: [255, 255, 255, 160],
        getRadius: (p) => 18 + p.priority_norm * 28,
        radiusMinPixels: 7,
        radiusMaxPixels: 20,
        lineWidthMinPixels: 1.5,
        stroked: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 50],
      }),
    ],
    [priorityData, criticals, roundedZoom]
  );

  // Memoize tooltip function so the right DeckGL instance doesn't rebuild its callbacks
  const tooltip = useCallback(
    ({ object }: { object: HeatmapPoint | null }) =>
      object
        ? {
            html: `<div style="font-family:Inter,sans-serif;font-size:12px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;min-width:210px;line-height:2">
              <div style="color:#ef4444;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">🚨 Critical Alert</div>
              <div style="color:#94a3b8"><b style="color:#e2e8f0">Zone</b> · ${object.zone}</div>
              <div style="color:#94a3b8"><b style="color:#e2e8f0">Priority</b> · <span style="color:#f97316;font-weight:600">${object.priority.toFixed(3)}</span></div>
              <div style="color:#94a3b8"><b style="color:#e2e8f0">Vehicle</b> · ${object.vehicle}</div>
              <div style="color:#94a3b8"><b style="color:#e2e8f0">Violation</b> · ${object.violation}</div>
              <div style="color:#94a3b8"><b style="color:#e2e8f0">Hour</b> · ${object.hour}:00</div>
            </div>`,
            style: { background: "none", border: "none", padding: "0" },
          }
        : null,
    []
  );

  return (
    <section className="bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-800/60 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Feature 2</p>
          <h2 className="text-base font-semibold text-white mt-0.5">Dual Heatmap — Count vs. Priority</h2>
          <p className="text-xs text-slate-500 mt-0.5">Synchronized pan & zoom · Pan either map to compare</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <input
            type="range" min={-1} max={23} value={hour}
            onChange={(e) => setHour(parseInt(e.target.value))}
            className="w-40 accent-cyan-500 cursor-pointer"
          />
          <span className="text-xs font-mono text-slate-300 w-20 text-right tabular-nums">
            {hour === -1 ? "All Hours" : `${String(hour).padStart(2, "0")}:00`}
          </span>
        </div>
      </div>

      {/* Side-by-side maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0.5 bg-slate-800/30 h-[600px]">
        {/* Map A — Raw Density */}
        <div className="relative h-full">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <MapOverlay
            title="Raw Violation Density (Count)"
            subtitle="Status Quo"
            accent="text-rose-400/80"
          />
          <DeckGL
            viewState={viewState}
            onViewStateChange={onViewStateChange as any}
            controller
            layers={leftLayers}
            style={{ position: "absolute", inset: 0 }}
          >
            <Map mapStyle={BASEMAP} />
          </DeckGL>
        </div>

        {/* Map B — Priority */}
        <div className="relative h-full">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <MapOverlay
            title="Severity-Weighted Priority (Impact)"
            subtitle="AI Priority Index"
            accent="text-amber-400/80"
          />
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-red-950/80 border border-red-700/40 backdrop-blur rounded-xl px-3 py-2 pointer-events-none">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-300 tabular-nums">
              {criticals.length} Critical Alerts
              {hour !== -1 ? ` @ ${String(hour).padStart(2, "0")}:00` : ""}
            </span>
          </div>
          <DeckGL
            viewState={viewState}
            onViewStateChange={onViewStateChange as any}
            controller
            layers={rightLayers}
            getTooltip={tooltip as any}
            style={{ position: "absolute", inset: 0 }}
          >
            <Map mapStyle={BASEMAP} />
          </DeckGL>
        </div>
      </div>

      {/* Legend */}
      <div className="px-8 py-3 border-t border-slate-800/60 flex items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold shrink-0">
          Intensity
        </p>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] text-slate-600 font-mono shrink-0">Low</span>
          <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-blue-900 via-teal-500 via-yellow-400 to-red-500" />
          <span className="text-[10px] text-slate-600 font-mono shrink-0">High</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-white/30 shrink-0" />
          Critical Alert (Top 50)
        </div>
      </div>
    </section>
  );
}
