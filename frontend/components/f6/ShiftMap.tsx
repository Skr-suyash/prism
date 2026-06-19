"use client";

import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import { Shield, Clock } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

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
        getFillColor: showSimulation ? [34, 197, 94, 200] : [168, 85, 247, 200], // Green vs Purple
        getLineColor: showSimulation ? [134, 239, 172, 255] : [216, 180, 254, 255],
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
    <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-sm overflow-hidden flex flex-col h-[500px] relative group">
      
      {/* Top Overlay: Shift Selector */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-gray-800/90 border border-gray-700 backdrop-blur-md rounded-xl px-4 py-2.5 max-w-[240px] shadow-lg">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${showSimulation ? "text-green-400" : "text-purple-400"}`}>
            {showSimulation ? "Projected Impact" : "Current Deployments"}
          </p>
          <p className="text-sm font-bold text-white mt-0.5 leading-snug flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            Live Strategy Map
          </p>
        </div>

        {/* Shift Toggle Buttons */}
        <div className="flex bg-gray-800/90 border border-gray-700 backdrop-blur-md p-1 rounded-lg shadow-lg pointer-events-auto">
          {shiftLabels.map((label, idx) => (
            <button
              key={idx}
              onClick={() => setActiveShift(idx)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeShift === idx 
                  ? "bg-gray-700 text-white shadow-sm" 
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Clock className="w-3 h-3" />
              {label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <DeckGL
          initialViewState={INITIAL_VIEW}
          controller
          layers={layers}
          style={{ position: "absolute", inset: 0 }}
        >
          <Map mapStyle={BASEMAP} />
        </DeckGL>

        {/* Tooltip */}
        {hoverInfo && hoverInfo.object && (
          <div
            className="absolute z-50 pointer-events-none bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs border border-gray-700 min-w-[200px]"
            style={{
              left: hoverInfo.x,
              top: hoverInfo.y,
              transform: "translate(-50%, -100%)",
              marginTop: "-16px",
            }}
          >
            <div className="font-bold border-b border-gray-700 pb-2 mb-2 text-gray-200">
              {hoverInfo.object.zone}
            </div>
            <div className="flex justify-between mb-1 text-gray-400">
              <span>Officers Deployed:</span> 
              <span className="text-white font-black">{hoverInfo.object.officers}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Priority Targeted:</span> 
              <span className="text-white font-medium">{hoverInfo.object.total_priority.toFixed(0)}</span>
            </div>
            
            {/* Pointer Triangle */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 border-b border-r border-gray-700 transform rotate-45" />
          </div>
        )}
      </div>

    </div>
  );
}
