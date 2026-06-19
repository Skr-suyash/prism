"use client";

import { useEffect, useState } from "react";
import { api, type ForecastHourlyTotal } from "@/lib/apiClient";
import { BarChart3 } from "lucide-react";

export default function HourlyForecastChart() {
  const [data, setData] = useState<ForecastHourlyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getForecastHourlyTotals()
      .then(d => {
        if (Array.isArray(d)) {
          setData(d);
        } else {
          console.error("Failed to load hourly forecast data:", d);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.predicted_total), 1);
  const avgTotal = data.reduce((sum, d) => sum + d.predicted_total, 0) / (data.length || 1);

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-500" />
          System-Wide Load Forecast
        </h2>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">
          Total predicted violations across all 54 zones
        </p>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-end">
        <div className="relative h-48 w-full flex items-end justify-between gap-1 mt-6">
          {/* Average Line */}
          <div 
            className="absolute left-0 right-0 border-t border-dashed border-gray-300 z-0 pointer-events-none"
            style={{ bottom: `${(avgTotal / maxTotal) * 100}%` }}
          >
            <span className="absolute right-0 -top-5 text-[10px] font-bold text-gray-400 bg-white px-1">
              AVG {avgTotal.toFixed(0)}
            </span>
          </div>

          {data.map((d) => {
            const heightPct = Math.min(100, (d.predicted_total / maxTotal) * 100);
            const isPeak = d.predicted_total > avgTotal * 1.5;
            
            return (
              <div key={d.hour} className="relative flex flex-col items-center flex-1 h-full justify-end group z-10">
                {/* Tooltip */}
                <div className="absolute hidden group-hover:flex flex-col items-center bottom-full mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-20">
                  <div className="font-bold text-gray-300 mb-1">
                    {String(d.hour).padStart(2, '0')}:00
                  </div>
                  <div>Predicted: <span className="text-purple-400 font-bold">{d.predicted_total.toFixed(0)}</span></div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                </div>

                {/* Bar */}
                <div 
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isPeak 
                      ? "bg-rose-400 group-hover:bg-rose-500" 
                      : "bg-purple-400 group-hover:bg-purple-500"
                  }`}
                  style={{ height: `${heightPct}%`, minHeight: '4px' }}
                />
                
                {/* X-Axis Label */}
                <span className="text-[10px] font-semibold text-gray-400 mt-2">
                  {d.hour % 3 === 0 ? d.hour : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
