"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import ShiftHeatmap from "@/components/f6/ShiftHeatmap";
import AllocationControls from "@/components/f6/AllocationControls";
import { ShieldAlert } from "lucide-react";

export default function EnforcementPage() {
  const [matrixData, setMatrixData] = useState<any>(null);
  const [allocationData, setAllocationData] = useState<any>(null);
  
  const [officers, setOfficers] = useState(20);
  const [maxPerCell, setMaxPerCell] = useState(3);
  
  const [loading, setLoading] = useState(true);

  // Load the base matrix once
  useEffect(() => {
    api.getEnforcementMatrix()
      .then(res => setMatrixData(res))
      .catch(err => console.error("Failed to load matrix:", err));
  }, []);

  // Re-run allocation when inputs change
  useEffect(() => {
    setLoading(true);
    api.allocateOfficers(officers, maxPerCell)
      .then(res => {
        setAllocationData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error("Allocation failed:", err);
        setLoading(false);
      });
  }, [officers, maxPerCell]);

  if (!matrixData || !matrixData.matrix) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 h-[calc(100vh-2rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-purple-600 bg-purple-50 w-fit px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            Feature 6
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Enforcement Shift Recommender</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            A greedy allocation algorithm that assigns available officers to the most critical (zone × shift) slots to maximize the impact on citywide traffic congestion.
          </p>
        </div>
      </div>

      {/* Top Row: Controls */}
      <div className="w-full">
        <AllocationControls 
          officers={officers} 
          setOfficers={setOfficers}
          maxPerCell={maxPerCell}
          setMaxPerCell={setMaxPerCell}
          coveragePct={allocationData?.coverage_pct || 0}
          uniformPct={allocationData?.uniform_coverage_pct || 0}
          loading={loading}
        />
      </div>

      {/* Bottom Row: Heatmap Grid */}
      <div className="flex-1 min-h-[500px]">
        <ShiftHeatmap 
          matrix={matrixData.matrix} 
          allocations={allocationData?.allocations || []}
          shiftLabels={matrixData.shift_labels}
        />
      </div>
    </div>
  );
}
