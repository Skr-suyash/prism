"use client";

import { useMemo } from "react";
import { User } from "lucide-react";

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
}

export default function ShiftHeatmap({ matrix, allocations, shiftLabels }: ShiftHeatmapProps) {
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800">Zone × Shift Allocation Matrix</h3>
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
                  const intensity = Math.max(0.1, cell.total_priority / maxPriority);
                  const hasOfficers = cell.officers > 0;
                  
                  return (
                    <td key={slotIdx} className="py-1 px-1">
                      <div className="relative group w-full h-10 rounded flex items-center justify-center border border-gray-100"
                           style={{ backgroundColor: `rgba(168, 85, 247, ${intensity * 0.8})` }}>
                        
                        {hasOfficers && (
                          <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm font-bold text-purple-700 z-10 border border-purple-200">
                            <User className="w-3 h-3" />
                            {cell.officers}
                          </div>
                        )}
                        
                        {/* Tooltip */}
                        <div className={`absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-gray-900 text-white p-2 rounded shadow-xl text-[10px] z-50 w-32 left-1/2 -translate-x-1/2 ${rowIdx < 3 ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
                          <div className="font-bold border-b border-gray-700 pb-1 mb-1">{zone} (Slot {slotIdx})</div>
                          <div className="flex justify-between"><span>Priority:</span> <span>{cell.total_priority.toFixed(0)}</span></div>
                          <div className="flex justify-between"><span>Violations:</span> <span>{cell.violation_count}</span></div>
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
