"use client";

import { useEffect, useState } from "react";
import { api, type StationCorrection } from "@/lib/apiClient";
import { MapPin, AlertTriangle } from "lucide-react";

export default function StationBreakdown() {
  const [data, setData] = useState<StationCorrection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStationCorrections()
      .then(d => {
        setData(d.slice(0, 15)); // Show top 15 for brevity
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxRate = Math.max(...data.map(d => d.rate), 1);

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Who is making the mistakes?
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Misclassification rate by Police Station (Top 15 worst offenders)
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col gap-4">
          {data.map((d, i) => {
            const widthPct = (d.rate / maxRate) * 100;
            const isAbnormal = d.rate > 10; // Highlight if > 10%
            
            return (
              <div key={d.station} className="flex items-center gap-4">
                <div className="w-48 shrink-0 flex justify-end">
                  <div className="flex items-center gap-2 text-right">
                    {isAbnormal && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                    <span className={`text-xs font-bold ${isAbnormal ? 'text-gray-900' : 'text-gray-600'}`}>
                      {d.station}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 flex items-center gap-3">
                  <div className="h-6 flex-1 bg-gray-100 rounded overflow-hidden flex items-center">
                    <div 
                      className={`h-full transition-all duration-500 ${isAbnormal ? 'bg-orange-400' : 'bg-emerald-400'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  
                  <div className="w-32 shrink-0 flex flex-col justify-center">
                    <span className="text-sm font-bold text-gray-800 tabular-nums">
                      {d.rate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {d.corrections.toLocaleString()} / {d.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
