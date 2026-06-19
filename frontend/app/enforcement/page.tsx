"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/apiClient";
import ShiftHeatmap from "@/components/f6/ShiftHeatmap";
import ShiftMap from "@/components/f6/ShiftMap";
import AllocationControls from "@/components/f6/AllocationControls";
import { ShieldAlert } from "lucide-react";

export default function EnforcementPage() {
  const [matrixData, setMatrixData] = useState<any>(null);
  const [allocationData, setAllocationData] = useState<any>(null);
  
  const [officers, setOfficers] = useState(20);
  const [maxPerCell, setMaxPerCell] = useState(3);
  
  const [loading, setLoading] = useState(true);
  const [showSimulation, setShowSimulation] = useState(false);
  const [activeShift, setActiveShift] = useState(0); // 0: Night, 1: Day, 2: Evening

  // Deterrence factor function
  function getDeterrenceFactor(n: number): number {
    if (n <= 0) return 0;
    if (n === 1) return 0.40;
    if (n === 2) return 0.60;
    if (n === 3) return 0.75;
    return 0.85;
  }

  // Compute residual risk
  const residualRiskPct = useMemo(() => {
    if (!allocationData || !matrixData) return 100;
    const totalPriority = allocationData.total_citywide_priority;
    if (!totalPriority) return 100;
    
    let deterredPriority = 0;
    for (const a of allocationData.allocations) {
      deterredPriority += a.total_priority * getDeterrenceFactor(a.officers);
    }
    return ((totalPriority - deterredPriority) / totalPriority) * 100;
  }, [allocationData, matrixData]);

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
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          
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
          showSimulation={showSimulation}
          setShowSimulation={setShowSimulation}
          residualRiskPct={residualRiskPct}
          allocations={allocationData?.allocations || []}
        />
      </div>

      {/* Middle Row: Live Strategy Map */}
      <div className="w-full">
        <ShiftMap 
          allocations={allocationData?.allocations || []}
          showSimulation={showSimulation}
          shiftLabels={matrixData.shift_labels}
          activeShift={activeShift}
          setActiveShift={setActiveShift}
        />
      </div>

      {/* Bottom Row: Matrix Grid */}
      <div className="w-full">
        <ShiftHeatmap 
          matrix={matrixData.matrix} 
          allocations={allocationData?.allocations || []}
          shiftLabels={matrixData.shift_labels}
          showSimulation={showSimulation}
        />
      </div>
    </div>
  );
}
