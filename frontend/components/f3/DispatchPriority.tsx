"use client";

import { useEffect, useState } from "react";
import { api, type ForecastDispatch } from "@/lib/apiClient";
import { ShieldAlert, AlertTriangle } from "lucide-react";

export default function DispatchPriority() {
  const [data, setData] = useState<ForecastDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getForecastDispatch()
      .then(d => {
        if (Array.isArray(d)) {
          setData(d.slice(0, 8)); // Top 8 is enough for the sidebar UI
        } else {
          console.error("Failed to load forecast data:", d);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Dispatch Priority Queue
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Top predicted high-risk zones (Next 24h)
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {data.map((item, index) => {
            const isTop = index < 3;
            
            return (
              <div 
                key={`${item.station}-${item.hour}`}
                className={`p-3 rounded-lg flex items-center justify-between transition-colors ${
                  isTop ? "bg-rose-50 border border-rose-100/50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isTop ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      {item.station}
                      {isTop && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      At {String(item.hour).padStart(2, '0')}:00
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`font-bold text-lg leading-none ${isTop ? "text-rose-600" : "text-gray-700"}`}>
                    {item.predicted_violation_count.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">
                    Predicted
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
