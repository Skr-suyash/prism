"use client";

import { useMemo } from "react";
import { User, Info } from "lucide-react";

interface AllocationCell {
  zone: string;
  shift_slot: number;
  slot_label: string;
  officers: number;
  total_priority: number;
}

interface ShiftHeatmapProps {
  matrix: any[];
  allocations: AllocationCell[];
  shiftLabels: string[];
  showSimulation?: boolean;
}

export default function ShiftHeatmap({ matrix, allocations, shiftLabels, showSimulation = false }: ShiftHeatmapProps) {
  // Process data for the grid
  const { zones, grid, maxPriority } = useMemo(() => {
    if (!matrix || matrix.length === 0) return { zones: [], grid: {}, maxPriority: 1 };

    // Find unique zones, sort by total priority across all shifts
    const zoneTotals: Record<string, number> = {};
    let maxP = 0;

    matrix.forEach(cell => {
      if (!zoneTotals[cell.police_station]) zoneTotals[cell.police_station] = 0;
      zoneTotals[cell.police_station] += cell.total_priority;
      if (cell.total_priority > maxP) maxP = cell.total_priority;
    });

    const sortedZones = Object.keys(zoneTotals).sort((a, b) => zoneTotals[b] - zoneTotals[a]).slice(0, 30); // Top 30 for UI

    // Build lookup map for O(1) rendering and reset officers
    const gridMap: Record<string, any> = {};
    matrix.forEach(cell => {
      gridMap[`${cell.police_station}-${cell.shift_slot}`] = { ...cell, officers: 0 };
    });

    // Merge allocations
    allocations.forEach(a => {
      const key = `${a.zone}-${a.shift_slot}`;
      if (gridMap[key]) {
        gridMap[key].officers = a.officers;
      }
    });

    return { zones: sortedZones, grid: gridMap, maxPriority: maxP || 1 };
  }, [matrix, allocations]);

  if (zones.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-[500px] relative">
      <div className="px-6 py-4 border-b border-gray-100 rounded-t-xl">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">Zone × Shift Allocation Matrix</h3>
          <div className="relative group">
            <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
            <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              A breakdown of officer deployment schedules across all major zones. The darker the cell, the higher the predicted traffic severity for that shift.
              <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-800 transform rotate-45" />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Top 30 zones ranked by cumulative priority</p>
      </div>
      
      <div className="flex-1 overflow-auto px-4 pb-4">
        <table className="w-full text-xs text-left">
          <thead>
            <tr>
              <th className="sticky top-0 bg-white z-40 py-2 px-3 font-bold text-gray-500 border-b border-gray-200 w-1/3">Police Station</th>
              {shiftLabels.map((label, i) => (
                <th key={i} className="sticky top-0 bg-white z-40 py-2 px-3 font-bold text-gray-500 border-b border-gray-200 text-center w-2/9">
                  {label.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zone, rowIdx) => (
              <tr key={zone} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="py-2.5 px-3 font-medium text-gray-700 truncate max-w-[120px]">{zone}</td>
                {shiftLabels.map((_, slotIdx) => {
                  const cell = grid[`${zone}-${slotIdx}`];
                  if (!cell) return <td key={slotIdx} className="py-2.5 px-3"></td>;
                  
                  // Calculate opacity based on priority (0.1 to 1.0)
                  const hasOfficers = cell.officers > 0;
                  
                  // Simulation logic
                  const getDeterrenceFactor = (n: number) => {
                    if (n <= 0) return 0;
                    if (n === 1) return 0.40;
                    if (n === 2) return 0.60;
                    if (n === 3) return 0.75;
                    return 0.85;
                  };
                  
                  const deterrence = hasOfficers ? getDeterrenceFactor(cell.officers) : 0;
                  const residualPriority = cell.total_priority * (1 - deterrence);
                  
                  const activePriority = (showSimulation && hasOfficers) ? residualPriority : cell.total_priority;
                  const intensity = Math.max(0.1, activePriority / maxPriority);
                  
                  const isSimulated = showSimulation && hasOfficers;
                  const bgColor = isSimulated 
                    ? `rgba(34, 197, 94, ${intensity * 0.8})` // Green
                    : `rgba(31, 41, 55, ${intensity * 0.8})`; // Slate
                  
                  return (
                    <td key={slotIdx} className="py-1 px-1">
                      <div className="relative group w-full h-10 rounded flex items-center justify-center border border-gray-100 transition-colors duration-500"
                           style={{ backgroundColor: bgColor }}>
                        
                        {hasOfficers && (
                          <div className="flex flex-col items-center justify-center">
                            <div className={`px-2 rounded-md flex items-center gap-1 shadow-sm font-bold z-10 border text-[11px] ${
                              isSimulated 
                                ? "bg-white/95 text-green-800 border-green-200 py-0" 
                                : "bg-slate-800 text-white border-slate-900 py-0.5 shadow-md"
                            }`}>
                              <User className="w-3 h-3" />
                              {cell.officers}
                            </div>
                            {isSimulated && (
                              <div className="text-[9px] font-black text-green-900 leading-none mt-0.5 bg-white/50 px-1 rounded">
                                ↓{(deterrence * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Tooltip */}
                        <div className={`absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs z-50 w-48 left-1/2 -translate-x-1/2 ${rowIdx < 3 ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                          <div className="font-bold border-b border-gray-700 pb-2 mb-2 text-gray-200">{zone} <span className="text-gray-400 font-normal">({shiftLabels[slotIdx]})</span></div>
                          <div className="flex justify-between mb-1 text-gray-400"><span>Original Priority:</span> <span className="text-white font-medium">{cell.total_priority.toFixed(0)}</span></div>
                          {isSimulated && (
                            <>
                              <div className="flex justify-between mb-1 text-green-400 font-bold"><span>Deterrence:</span> <span>-{(deterrence * 100).toFixed(0)}%</span></div>
                              <div className="flex justify-between mb-1 text-gray-300 font-bold"><span>Projected Priority:</span> <span className="text-white">{residualPriority.toFixed(0)}</span></div>
                            </>
                          )}
                          <div className="flex justify-between text-gray-400"><span>Violations:</span> <span className="text-white font-medium">{cell.violation_count}</span></div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
