"use client";

import { useEffect, useState } from "react";
import { api, type ForecastHeatmapRow } from "@/lib/apiClient";
import { Grid } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ForecastHeatmap() {
  const { t } = useLanguage();
  const [data, setData] = useState<ForecastHeatmapRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getForecastHeatmap()
      .then(d => {
        if (Array.isArray(d)) {
          setData(d);
        } else {
          console.error("Failed to load heatmap data:", d);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[500px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Find max value to normalize colors
  let maxVal = 1;
  data.forEach(row => {
    Object.values(row.hours).forEach(val => {
      if (val > maxVal) maxVal = val;
    });
  });

  const getHeatmapColor = (val: number) => {
    if (val === 0) return "bg-gray-50";
    const intensity = val / maxVal;
    
    if (intensity > 0.8) return "bg-rose-600 text-white";
    if (intensity > 0.6) return "bg-rose-500 text-white";
    if (intensity > 0.4) return "bg-orange-500 text-white";
    if (intensity > 0.2) return "bg-amber-400 text-gray-900";
    if (intensity > 0.1) return "bg-amber-200 text-gray-900";
    return "bg-amber-50 text-gray-800";
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <Grid className="w-4 h-4 text-blue-500" />
            Zone x Hour Forecast Heatmap
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {t.componentSubtitles.forecastHeatmap}
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <span>Low</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 bg-gray-50 rounded-sm"></div>
            <div className="w-4 h-4 bg-amber-200 rounded-sm"></div>
            <div className="w-4 h-4 bg-amber-400 rounded-sm"></div>
            <div className="w-4 h-4 bg-orange-500 rounded-sm"></div>
            <div className="w-4 h-4 bg-rose-500 rounded-sm"></div>
            <div className="w-4 h-4 bg-rose-600 rounded-sm"></div>
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="p-0 flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-white z-20 shadow-sm">
            <tr>
              <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-white sticky left-0 z-30 min-w-[200px]">
                Zone
              </th>
              {Array.from({ length: 24 }).map((_, i) => (
                <th key={i} className="py-3 px-1 text-[10px] font-bold text-gray-400 text-center border-b border-gray-200">
                  {String(i).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-800">
            {data.map((row) => (
              <tr key={row.station} className="hover:bg-gray-50/50 group">
                <td className="py-2 px-4 font-bold text-gray-700 text-xs whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50/50 border-r border-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  {row.station}
                </td>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const val = row.hours[hour] || 0;
                  const colorClass = getHeatmapColor(val);
                  return (
                    <td key={hour} className="p-0.5">
                      <div 
                        className={`w-full h-8 flex items-center justify-center rounded-sm text-[9px] font-bold transition-colors ${colorClass}`}
                        title={`${row.station} at ${String(hour).padStart(2, '0')}:00 - ${val.toFixed(1)} predicted`}
                      >
                        {val > 2 ? Math.round(val) : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
