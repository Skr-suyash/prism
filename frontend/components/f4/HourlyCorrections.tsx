"use client";

import { useEffect, useState } from "react";
import { api, type HourlyCorrection } from "@/lib/apiClient";
import { Clock } from "lucide-react";

export default function HourlyCorrections() {
  const [data, setData] = useState<HourlyCorrection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHourlyCorrections()
      .then(d => {
        setData(d);
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

  const maxRate = Math.max(...data.map(d => d.rate), 1);
  const avgRate = data.reduce((sum, d) => sum + d.rate, 0) / (data.length || 1);

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          When do misclassifications happen?
        </h2>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">
          Hourly correction rate (%) — peaks indicate fatigue or visibility issues
        </p>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-end">
        <div className="relative h-64 w-full flex items-end justify-between gap-1 mt-8">
          {/* Average Line */}
          <div 
            className="absolute left-0 right-0 border-t border-dashed border-gray-300 z-0"
            style={{ bottom: `${(avgRate / maxRate) * 100}%` }}
          >
            <span className="absolute right-0 -top-5 text-[10px] font-bold text-gray-400 bg-white px-1">
              AVG {avgRate.toFixed(1)}%
            </span>
          </div>

          {data.map((d) => {
            const heightPct = (d.rate / maxRate) * 100;
            const isPeak = d.rate > avgRate * 1.5;
            
            return (
              <div key={d.hour} className="relative flex flex-col items-center flex-1 h-full justify-end group z-10">
                {/* Tooltip */}
                <div className="absolute hidden group-hover:flex flex-col items-center bottom-full mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  <div className="font-bold text-gray-300 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {String(d.hour).padStart(2, '0')}:00
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div>Rate: <span className="text-blue-400 font-bold">{d.rate.toFixed(1)}%</span></div>
                    <div>Corrections: <span className="font-semibold">{d.corrections.toLocaleString()}</span></div>
                    <div className="text-gray-400 text-[10px]">Volume: {d.total.toLocaleString()}</div>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                </div>

                {/* Bar */}
                <div 
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isPeak 
                      ? "bg-rose-400 group-hover:bg-rose-500" 
                      : "bg-blue-400 group-hover:bg-blue-500"
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
