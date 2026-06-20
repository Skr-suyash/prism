"use client";

import { Users, TrendingUp, AlertCircle, Download } from "lucide-react";

interface AllocationControlsProps {
  officers: number;
  setOfficers: (n: number) => void;
  maxPerCell: number;
  setMaxPerCell: (n: number) => void;
  coveragePct: number;
  uniformPct: number;
  loading: boolean;
  showSimulation: boolean;
  setShowSimulation: (val: boolean) => void;
  residualRiskPct: number;
  allocations?: any[];
}

export default function AllocationControls({
  officers,
  setOfficers,
  maxPerCell,
  setMaxPerCell,
  coveragePct,
  uniformPct,
  loading,
  showSimulation,
  setShowSimulation,
  residualRiskPct,
  allocations
}: AllocationControlsProps) {
  
  const quickPicks = [10, 20, 50, 100];
  const efficiencyGain = coveragePct - uniformPct;

  const handleDownloadCSV = () => {
    if (!allocations || allocations.length === 0) return;

    // 1. Filter out empty deployments and sort by priority
    const activeDeployments = allocations
      .filter(a => a.officers > 0)
      .sort((a, b) => b.total_priority - a.total_priority);

    // 2. Generate CSV Header
    let csvContent = "Zone,Shift,Officers,Priority Rank\n";

    // 3. Generate CSV Rows
    activeDeployments.forEach((deployment, index) => {
      const zone = `"${deployment.zone}"`;
      const shift = `"${deployment.slot_label}"`;
      const rank = `#${index + 1}`;
      csvContent += `${zone},${shift},${deployment.officers},${rank}\n`;
    });

    // 4. Trigger browser download via Blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `prism_deployment_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Officer Input */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Resource Allocation</h3>
            <p className="text-xs text-gray-500">Available Officers (8h shifts)</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-end mb-2">
            <span className="text-3xl font-black text-gray-900">{officers}</span>
            <span className="text-sm font-medium text-gray-500 mb-1">officers</span>
          </div>
          <input
            type="range"
            min="5"
            max="150"
            step="5"
            value={officers}
            onChange={(e) => setOfficers(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
          />
        </div>

        <div className="flex gap-2 mb-6">
          {quickPicks.map(n => (
            <button
              key={n}
              onClick={() => setOfficers(n)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                officers === n 
                  ? "bg-slate-800 text-white" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm mb-6">
          <span className="text-gray-600 font-medium">Max per zone-shift</span>
          <select 
            value={maxPerCell}
            onChange={(e) => setMaxPerCell(Number(e.target.value))}
            className="bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none text-gray-700 font-bold"
          >
            <option value={1}>1 officer</option>
            <option value={2}>2 officers</option>
            <option value={3}>3 officers</option>
            <option value={5}>5 officers</option>
          </select>
        </div>

        {/* Download Roster Button */}
        <button
          onClick={handleDownloadCSV}
          disabled={loading || !allocations || allocations.length === 0}
          className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Download CSV Roster
        </button>
      </div>

      {/* Coverage Stats */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col relative overflow-hidden">
        
        {/* Toggle Pill */}
        <div className="flex justify-end mb-4">
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => setShowSimulation(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!showSimulation ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Current State
            </button>
            <button 
              onClick={() => setShowSimulation(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${showSimulation ? "bg-green-100 text-green-700 shadow-sm border border-green-200" : "text-gray-500 hover:text-gray-700"}`}
            >
              <span className={`w-2 h-2 rounded-full ${showSimulation ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}></span>
              Projected Impact
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-1">Priority Covered</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-slate-800">{loading ? "..." : coveragePct.toFixed(1)}%</span>
              </div>
            </div>

            {showSimulation && (
              <div className="text-right bg-amber-50 p-3 rounded-lg border border-amber-100 animate-in fade-in zoom-in duration-300">
                <h3 className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Residual Risk
                </h3>
                <div className="text-2xl font-black text-amber-600">
                  {loading ? "..." : residualRiskPct.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between items-center text-gray-500 font-medium">
              <span>Uniform Deployment</span>
              <span className="font-bold text-gray-700">{loading ? "..." : uniformPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {showSimulation ? "Priority Deterred" : "Efficiency Gain"}</span>
              <span>+{loading ? "..." : (showSimulation ? (100 - residualRiskPct) : efficiencyGain).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
