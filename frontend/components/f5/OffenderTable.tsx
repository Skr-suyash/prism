"use client";

import { useEffect, useState } from "react";
import { api, type OffenderData } from "@/lib/apiClient";
import { ShieldAlert, Car, MapPin, AlertTriangle, Info } from "lucide-react";

export default function OffenderTable() {
  const [data, setData] = useState<OffenderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeArchetype, setActiveArchetype] = useState<string>("");

  useEffect(() => {
    api.getOffenders()
      .then(d => {
        setData(d);
        const keys = Object.keys(d);
        if (keys.length > 0) setActiveArchetype(keys[0]);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const offenders = data[activeArchetype] || [];

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-[500px] relative">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-4 rounded-t-xl">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-600" />
                Most Wanted: Repeat Offenders
              </h2>
              <div className="relative group">
                <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
                  A hitlist of specific vehicles that consistently violate traffic rules and cause severe congestion, broken down by their behavioral archetype.
                  <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-800 transform rotate-45" />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Top 20 high-frequency violators isolated by behavioural archetype
            </p>
          </div>
        </div>
        
        {/* Archetype Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.keys(data).map(arch => (
            <button
              key={arch}
              onClick={() => setActiveArchetype(arch)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                activeArchetype === arch 
                  ? "bg-slate-100 text-slate-700" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {arch}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          {offenders.map((offender, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-slate-200 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200/50 text-gray-500 font-bold text-xs group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                  #{i + 1}
                </div>
                <div>
                  <div className="font-mono text-sm font-bold text-gray-800 tracking-tight">
                    {offender.device_id}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-gray-500">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-400" /> {offender.violation_count} Violations</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-sky-400" /> {offender.most_common_violation}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Priority</div>
                <div className="text-lg font-bold text-orange-500 leading-none">
                  {offender.mean_priority.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
          {offenders.length === 0 && (
            <div className="text-center p-6 text-sm text-gray-400 font-medium">
              No repeat offenders found in this archetype.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
