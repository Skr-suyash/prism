"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { WebMercatorViewport } from "@deck.gl/core";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import { api, type HeatmapPoint } from "@/lib/apiClient";
import { Clock, AlertTriangle, LocateFixed, Info } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAP = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: 77.5946,
  latitude: 12.9716,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

const HEAT_GRADIENT: [number, number, number][] = [
  [240, 249, 255], // Light blue (low density)
  [186, 230, 253],
  [125, 211, 252],
  [250, 204, 21],  // Yellow
  [249, 115, 22],  // Orange
  [225, 29, 72],   // Rose/Red (high density)
];

function alertColor(norm: number): [number, number, number, number] {
  return norm < 0.5 ? [249, 115, 22, 230] : [225, 29, 72, 255];
}

function MapOverlay({ title, subtitle, accent, tooltip }: { title: string; subtitle: string; accent: string; tooltip?: string }) {
  return (
    <div className="absolute top-4 left-4 z-10 pointer-events-auto group">
      <div className="bg-white/90 border border-gray-200/50 backdrop-blur-md rounded-xl px-4 py-2.5 max-w-[240px] shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>{subtitle}</p>
          {tooltip && <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />}
        </div>
        <p className="text-sm font-bold text-gray-800 mt-0.5 leading-snug">{title}</p>
      </div>
      {tooltip && (
        <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {tooltip}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 transform rotate-45" />
        </div>
      )}
    </div>
  );
}

export default function DualHeatmap() {
  const [allPoints, setAllPoints] = useState<HeatmapPoint[]>([]);
  const [hour, setHour] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [clickedAlert, setClickedAlert] = useState<HeatmapPoint | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    api.getHeatmap().then((d) => { setAllPoints(d); setLoading(false); }).catch(console.error);
  }, []);

  const onViewStateChange = useCallback(
    ({ viewState: vs }: { viewState: typeof INITIAL_VIEW }) => {
      setViewState(vs);
    },
    []
  );

  const filtered = useMemo(
    () => (hour === -1 ? allPoints : allPoints.filter((p) => p.hour === hour)),
    [allPoints, hour]
  );

  const densityData = useMemo(
    () => filtered.map((p) => ({ pos: [p.lng, p.lat] as [number, number] })),
    [filtered]
  );

  const priorityData = useMemo(
    () => filtered.map((p) => ({ pos: [p.lng, p.lat] as [number, number], weight: p.priority })),
    [filtered]
  );

  const criticals = useMemo(
    () => [...filtered].sort((a, b) => b.priority - a.priority).slice(0, 50),
    [filtered]
  );

  const roundedZoom = Math.floor(viewState.zoom);

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
        getLineColor: [255, 255, 255, 200],
        getRadius: (p) => 18 + p.priority_norm * 28,
        radiusMinPixels: 7,
        radiusMaxPixels: 20,
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 150],
        onClick: (info) => {
          if (info.object) {
            setClickedAlert(info.object as HeatmapPoint);
          } else {
            setClickedAlert(null);
          }
          return true; // prevent default DeckGL click
        },
      }),
    ],
    [priorityData, criticals, roundedZoom]
  );

  let popupX = 0;
  let popupY = 0;
  if (clickedAlert) {
    const viewport = new WebMercatorViewport(viewState);
    const [x, y] = viewport.project([clickedAlert.lng, clickedAlert.lat]);
    popupX = x;
    popupY = y;
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-4 bg-gray-50/50">
        <div className="flex-1 min-w-0">
          
          <h2 className="text-lg font-bold text-gray-800 mt-0.5">Congested Roads vs Enforcement</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">{t.componentSubtitles.dualHeatmap}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm">
          <button 
            onClick={() => setViewState(INITIAL_VIEW)}
            className="flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-purple-600 transition-colors border-r border-gray-100 pr-3 mr-1"
            title="Recenter Map"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
          <Clock className="w-4 h-4 text-gray-400" />
          <input
            type="range" min={-1} max={23} value={hour}
            onChange={(e) => setHour(parseInt(e.target.value))}
            className="w-32 accent-slate-500 cursor-pointer"
          />
          <span className="text-sm font-bold text-gray-700 w-16 text-right tabular-nums">
            {hour === -1 ? "All" : `${String(hour).padStart(2, "0")}:00`}
          </span>
        </div>
      </div>

      {/* Side-by-side maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-200 h-[500px]">
        {/* Map A — Raw Density */}
        <div className="relative h-full bg-gray-50">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur">
              <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <MapOverlay
            title="Raw Ticket Density"
            subtitle="Status Quo"
            accent="text-rose-500"
            tooltip={t.tooltips.rawDensity}
          />
          <DeckGL
            viewState={viewState}
            onViewStateChange={onViewStateChange as any}
            controller
            layers={leftLayers}
            style={{ position: "absolute", inset: "0" }}
          >
            <Map mapStyle={BASEMAP} />
          </DeckGL>
        </div>

        {/* Map B — Priority */}
        <div className="relative h-full bg-gray-50">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur">
              <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <MapOverlay
            title="Severity-Weighted Priority"
            subtitle="AI Priority Index"
            accent="text-slate-600"
            tooltip={t.tooltips.priorityHotspots}
          />
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-white border border-rose-200 shadow-sm rounded-lg px-3 py-2 pointer-events-none">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span className="text-[13px] font-bold text-gray-800 tabular-nums">
              {criticals.length} Critical Alerts
            </span>
          </div>
          <DeckGL
            viewState={viewState}
            onViewStateChange={onViewStateChange as any}
            controller
            layers={rightLayers}
            style={{ position: "absolute", inset: "0" }}
          >
            <Map mapStyle={BASEMAP} />
          </DeckGL>

          {clickedAlert && (
            <div
              className="absolute z-[1000] pointer-events-auto"
              style={{
                left: popupX,
                top: popupY,
                transform: "translate(-50%, -100%)",
                marginTop: "-16px",
              }}
            >
              <div className="font-[family-name:var(--font-inter)] text-[12px] bg-white p-3 min-w-[220px] leading-relaxed rounded-xl shadow-xl border border-gray-200 relative">
                <button 
                  onClick={() => setClickedAlert(null)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
                <div className="text-red-500 font-bold text-[11px] tracking-widest uppercase mb-2 flex items-center gap-1.5 border-b border-gray-100 pb-2 pr-4">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Critical Alert
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-gray-500"><b className="text-gray-900">Zone</b> · {clickedAlert.zone}</div>
                  <div className="text-gray-500"><b className="text-gray-900">Priority</b> · <span className="text-orange-500 font-bold">{clickedAlert.priority.toFixed(3)}</span></div>
                  <div className="text-gray-500"><b className="text-gray-900">Vehicle</b> · {clickedAlert.vehicle}</div>
                  <div className="text-gray-500"><b className="text-gray-900">Violation</b> · {clickedAlert.violation}</div>
                  <div className="text-gray-500"><b className="text-gray-900">Hour</b> · {clickedAlert.hour}:00</div>
                </div>
                {/* Pointer Arrow */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-gray-200 transform rotate-45" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-6 bg-white">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold shrink-0">
          Intensity
        </p>
        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[200px]">
          <span className="text-[10px] text-gray-400 font-bold shrink-0">Low</span>
          <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-blue-100 via-sky-300 via-yellow-400 to-rose-500" />
          <span className="text-[10px] text-gray-400 font-bold shrink-0">High</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 shrink-0">
          <span className="inline-block w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-sm shrink-0" />
          Critical Alert
        </div>
      </div>
    </section>
  );
}
