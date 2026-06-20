"use client";

import { useEffect, useState } from "react";
import { api, type ConfusionCell } from "@/lib/apiClient";
import { ArrowRight, AlertCircle } from "lucide-react";

export default function ConfusionMatrix() {
  const [data, setData] = useState<ConfusionCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConfusionMatrix()
      .then(d => {
        setData(d);
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

  // Ensure data is an array to prevent crashes if the API returns null or an error object
  const safeData = Array.isArray(data) ? data : [];

  // Find top N vehicles involved in swaps
  const vehicleCounts = new Map<string, number>();
  safeData.forEach(d => {
    vehicleCounts.set(d.from_type, (vehicleCounts.get(d.from_type) || 0) + d.count);
    vehicleCounts.set(d.to_type, (vehicleCounts.get(d.to_type) || 0) + d.count);
  });

  const topVehicles = Array.from(vehicleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(entry => entry[0]);

  // Max count for color scaling
  const maxCount = Math.max(...safeData.map(d => d.count), 1);

  const getCellColor = (count: number) => {
    if (count === 0) return "bg-gray-50";
    const intensity = Math.pow(count / maxCount, 0.5); // SQRT scale to highlight smaller values
    
    // Scale from light orange to dark red
    const r = Math.round(255 - (255 - 225) * intensity);
    const g = Math.round(245 - (245 - 29) * intensity);
    const b = Math.round(235 - (235 - 72) * intensity);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getTextColor = (count: number) => {
    const intensity = Math.pow(count / maxCount, 0.5);
    return intensity > 0.6 ? "text-white" : "text-gray-800";
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
            Confusion Matrix: What gets swapped?
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Original classification vs. Corrected classification (Top 6 Vehicle Types)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
          <AlertCircle className="w-3.5 h-3.5" />
          {safeData.length} unique swap pairs
        </div>
      </div>

      <div className="p-6 overflow-x-auto flex-1">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border-b-2 border-r-2 border-gray-100 text-left align-bottom">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Original <ArrowRight className="w-3 h-3" />
                  </div>
                </th>
                {topVehicles.map(v => (
                  <th key={v} className="p-3 border-b-2 border-gray-100 text-center">
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider transform -rotate-45 origin-bottom-left ml-6 w-8">
                      {v}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topVehicles.map(fromV => (
                <tr key={fromV}>
                  <th className="p-3 border-r-2 border-gray-100 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    {fromV}
                  </th>
                  {topVehicles.map(toV => {
                    if (fromV === toV) {
                      return <td key={toV} className="p-2 bg-stripes-gray border border-gray-50"></td>;
                    }
                    const cellData = safeData.find(d => d.from_type === fromV && d.to_type === toV);
                    const count = cellData?.count || 0;
                    
                    return (
                      <td key={toV} className="p-0 border border-gray-50 relative group">
                        <div 
                          className="w-full h-12 flex items-center justify-center font-mono text-sm font-semibold transition-colors"
                          style={{ backgroundColor: count > 0 ? getCellColor(count) : undefined }}
                        >
                          <span className={count > 0 ? getTextColor(count) : "text-gray-300"}>
                            {count > 0 ? count : "-"}
                          </span>
                        </div>
                        {/* Tooltip */}
                        {count > 0 && (
                          <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-10">
                            <div className="font-bold text-gray-300 mb-1">Swapped {count} times</div>
                            <div><span className="text-rose-400 font-bold">{fromV}</span> → <span className="text-emerald-400 font-bold">{toV}</span></div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex items-center gap-2 justify-end text-xs font-bold text-gray-500 uppercase tracking-widest">
            Corrected To <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </section>
  );
}
