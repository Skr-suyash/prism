"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/apiClient";
import ShiftHeatmap from "@/components/f6/ShiftHeatmap";
import ShiftMap from "@/components/f6/ShiftMap";
import AllocationControls from "@/components/f6/AllocationControls";
import InsightCard from "@/components/InsightCard";
import { ShieldAlert } from "lucide-react";

export default function EnforcementPage() {
  const [matrixData, setMatrixData] = useState<any>(null);
  const [allocationData, setAllocationData] = useState<any>(null);
  
  const [officers, setOfficers] = useState(20);
  const [maxPerCell, setMaxPerCell] = useState(3);
  
  const [loading, setLoading] = useState(true);
  const [showSimulation, setShowSimulation] = useState(false);
  const [activeShift, setActiveShift] = useState(0); // 0: Night, 1: Day, 2: Evening

  const [projectedData, setProjectedData] = useState<any>(null);

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

  // Compute deterred priority percentage
  const deterredPct = useMemo(() => {
    if (!allocationData || !matrixData) return 0;
    const totalPriority = allocationData.total_citywide_priority;
    if (!totalPriority) return 0;
    let deterredPriority = 0;
    for (const a of allocationData.allocations) {
      deterredPriority += a.total_priority * getDeterrenceFactor(a.officers);
    }
    return (deterredPriority / totalPriority) * 100;
  }, [allocationData, matrixData]);

  // Adaptive increment: no longer changing officers, but maxPerCell
  const nextMax = useMemo(() => (maxPerCell < 5 ? maxPerCell + 1 : maxPerCell - 1), [maxPerCell]);

  // Build multi-line insight — toggles based on showSimulation
  const insightLines = useMemo(() => {
    if (!allocationData) return [];

    if (!showSimulation) {
      // Current State view
      return [
        `${officers} officers cover ${allocationData.coverage_pct}% of citywide priority. Uniform deployment would only achieve ${allocationData.uniform_coverage_pct}% — the greedy algorithm is ${(allocationData.coverage_pct - allocationData.uniform_coverage_pct).toFixed(1)}pp more efficient.`
      ];
    }

    // Projected Impact view (simulation on)
    if (!projectedData) return [];
    
    // Calculate projected deterred and residual
    const totalPriority = projectedData.total_citywide_priority;
    let projDeterred = 0;
    if (totalPriority) {
      for (const a of projectedData.allocations) {
        projDeterred += a.total_priority * getDeterrenceFactor(a.officers);
      }
    }
    const projDeterredPct = totalPriority ? (projDeterred / totalPriority) * 100 : 0;
    const projResidualPct = totalPriority ? ((totalPriority - projDeterred) / totalPriority) * 100 : 100;

    const gain = (projectedData.coverage_pct - allocationData.coverage_pct).toFixed(1);
    const direction = maxPerCell < 5 ? "increases" : "changes";
    
    return [
      `Scaling the maximum limit from ${maxPerCell} to ${nextMax} patrols per zone/shift ${direction} priority coverage to ${projectedData.coverage_pct}% (a ${gain > 0 ? "+" : ""}${gain}pp difference).`,
      `With up to ${nextMax} officers per shift in critical zones, residual risk (the remaining unaddressed congestion) hits ${projResidualPct.toFixed(1)}%. Deterred priority (the portion of congestion actively suppressed by police presence) reaches ${projDeterredPct.toFixed(1)}%.`
    ];
  }, [allocationData, projectedData, officers, maxPerCell, nextMax, showSimulation]);

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

    api.allocateOfficers(officers, nextMax)
      .then(res => setProjectedData(res))
      .catch(console.error);
  }, [officers, maxPerCell, nextMax]);

  if (!matrixData || !matrixData.matrix) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />
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

      <InsightCard 
        insight={insightLines}
        loading={loading}
      />

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
