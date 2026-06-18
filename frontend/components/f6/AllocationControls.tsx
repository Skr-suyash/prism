"use client";

import { Users, TrendingUp, AlertCircle } from "lucide-react";

interface AllocationControlsProps {
  officers: number;
  setOfficers: (n: number) => void;
  maxPerCell: number;
  setMaxPerCell: (n: number) => void;
  coveragePct: number;
  uniformPct: number;
  loading: boolean;
}

export default function AllocationControls({
  officers,
  setOfficers,
  maxPerCell,
  setMaxPerCell,
  coveragePct,
  uniformPct,
  loading
}: AllocationControlsProps) {
  
  const quickPicks = [10, 20, 50, 100];
  const efficiencyGain = coveragePct - uniformPct;

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Officer Input */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>

        <div className="flex gap-2 mb-6">
          {quickPicks.map(n => (
            <button
              key={n}
              onClick={() => setOfficers(n)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                officers === n 
                  ? "bg-purple-600 text-white" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
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
      </div>

      {/* Coverage Stats */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-5 rounded-xl shadow-md text-white flex-1 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
        
        <h3 className="text-sm font-medium text-gray-400 mb-1">Priority Covered</h3>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-black">{loading ? "..." : coveragePct.toFixed(1)}%</span>
        </div>
        
        <div className="mt-auto space-y-2 text-xs">
          <div className="flex justify-between items-center text-gray-300">
            <span>Uniform Deployment</span>
            <span className="font-bold">{loading ? "..." : uniformPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center text-green-400 font-bold bg-green-400/10 p-2 rounded-lg border border-green-400/20">
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Efficiency Gain</span>
            <span>+{loading ? "..." : efficiencyGain.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
