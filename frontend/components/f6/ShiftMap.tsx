"use client";

import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import { Shield, Clock, LocateFixed, Info } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAP = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: 77.5946,
  latitude: 12.9716,
  zoom: 11,
  pitch: 45,
  bearing: 0,
};

interface AllocationCell {
  zone: string;
  shift_slot: number;
  slot_label: string;
  officers: number;
  total_priority: number;
  lat?: number;
  lng?: number;
}

interface ShiftMapProps {
  allocations: AllocationCell[];
  showSimulation: boolean;
  shiftLabels: string[];
  activeShift: number;
  setActiveShift: (shift: number) => void;
}

export default function ShiftMap({ allocations, showSimulation, shiftLabels, activeShift, setActiveShift }: ShiftMapProps) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);

  // Filter allocations to only those in the active shift that actually have officers assigned
  const activeDeployments = useMemo(() => {
    return allocations.filter((a) => a.shift_slot === activeShift && a.officers > 0);
  }, [allocations, activeShift]);

  const layers = useMemo(() => {
    return [
      new ScatterplotLayer({
        id: "deployment-layer",
        data: activeDeployments,
        getPosition: (d) => [d.lng || 0, d.lat || 0],
        getFillColor: showSimulation ? [34, 197, 94, 200] : [31, 41, 55, 200], // Green vs Dark Gray
        getLineColor: showSimulation ? [134, 239, 172, 255] : [75, 85, 99, 255],
        getRadius: (d) => 250 + d.officers * 200, // Scale radius by officers
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 150],
        onHover: (info) => setHoverInfo(info),
        transitions: {
          getFillColor: 500,
          getLineColor: 500,
          getRadius: 500,
        },
      }),
    ];
  }, [activeDeployments, showSimulation]);

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px] relative group">
      
      {/* Top Overlay: Shift Selector */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="relative pointer-events-auto group">
          <div className="bg-white/90 border border-gray-200/50 backdrop-blur-md rounded-xl px-4 py-2.5 max-w-[240px] shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${showSimulation ? "text-green-600" : "text-slate-600"}`}>
                {showSimulation ? "Projected Impact" : "Current Deployments"}
              </p>
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
            </div>
            <p className="text-sm font-bold text-gray-800 mt-0.5 leading-snug flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              Live Strategy Map
            </p>
          </div>
          <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {showSimulation 
              ? "Shows the estimated reduction in traffic congestion if you reassign officers to the recommended AI hotspots."
              : "Shows where officers are currently assigned for the selected shift. Bigger circles mean more officers in that zone."}
            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 transform rotate-45" />
          </div>
        </div>

        {/* Shift Toggle Buttons */}
        <div className="flex gap-2 items-center pointer-events-auto">
          <button
            onClick={() => setViewState(INITIAL_VIEW)}
            className="bg-white/90 border border-gray-200/50 backdrop-blur-md p-2 rounded-lg shadow-sm text-gray-500 hover:text-purple-600 transition-colors flex items-center justify-center h-[32px] w-[32px]"
            title="Recenter Map"
          >
            <LocateFixed className="w-4 h-4 shrink-0" />
          </button>
          <div className="flex bg-white/90 border border-gray-200/50 backdrop-blur-md p-1 rounded-lg shadow-sm">
          {shiftLabels.map((label, idx) => (
            <button
              key={idx}
              onClick={() => setActiveShift(idx)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeShift === idx 
                  ? "bg-gray-100 text-gray-800 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Clock className="w-3 h-3" />
              {label.split(" ")[0]}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) => setViewState(vs as any)}
          controller
          layers={layers}
          style={{ position: "absolute", inset: 0 }}
        >
          <Map mapStyle={BASEMAP} />
        </DeckGL>

        {/* Tooltip */}
        {hoverInfo && hoverInfo.object && (
          <div
            className="absolute z-50 pointer-events-none bg-white text-gray-800 p-3 rounded-lg shadow-xl text-xs border border-gray-200 min-w-[200px]"
            style={{
              left: hoverInfo.x,
              top: hoverInfo.y,
              transform: "translate(-50%, -100%)",
              marginTop: "-16px",
            }}
          >
            <div className="font-bold border-b border-gray-100 pb-2 mb-2 text-gray-800">
              {hoverInfo.object.zone}
            </div>
            <div className="flex justify-between mb-1 text-gray-500">
              <span>Officers Deployed:</span> 
              <span className="text-gray-900 font-black">{hoverInfo.object.officers}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Priority Targeted:</span> 
              <span className="text-gray-900 font-medium">{hoverInfo.object.total_priority.toFixed(0)}</span>
            </div>
            
            {/* Pointer Triangle */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-gray-200 transform rotate-45" />
          </div>
        )}
      </div>

    </div>
  );
}
