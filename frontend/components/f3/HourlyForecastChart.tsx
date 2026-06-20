"use client";

import { useEffect, useState } from "react";
import { api, type ForecastHourlyTotal } from "@/lib/apiClient";
import { BarChart3, MapPin, ChevronDown, Info } from "lucide-react";

export default function HourlyForecastChart() {
  const [data, setData] = useState<ForecastHourlyTotal[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [globalMax, setGlobalMax] = useState<number>(1);

  // Load station list on mount
  useEffect(() => {
    api.getStationList()
      .then(s => {
        if (Array.isArray(s)) setStations(s);
      })
      .catch(console.error);
  }, []);

  // Load data whenever selectedStation changes
  useEffect(() => {
    setLoading(true);
    const fetcher = selectedStation === "all"
      ? api.getForecastHourlyTotals()
      : api.getStationHourlyTotals(selectedStation);

    fetcher
      .then(d => {
        if (Array.isArray(d)) {
          setData(d);
          // Lock Y-axis scale to city-wide max on first load
          if (selectedStation === "all") {
            const cityMax = Math.max(...d.map(h => h.predicted_total), 1);
            setGlobalMax(cityMax);
          }
        } else {
          console.error("Failed to load hourly forecast data:", d);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, [selectedStation]);

  if (loading && data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scaleMax = globalMax;
  const avgTotal = data.reduce((sum, d) => sum + d.predicted_total, 0) / (data.length || 1);
  const peakHour = data.length > 0 ? data.reduce((max, d) => d.predicted_total > max.predicted_total ? d : max, data[0]) : null;

  // Y-axis tick marks (5 ticks) — always based on city-wide max
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => Math.round(scaleMax * pct));

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full relative">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start gap-4 rounded-t-xl">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              Surge Predictor
            </h2>
            <div className="relative group">
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
              <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Displays the total predicted traffic violations for each hour across the city or selected zone. The highlighted peak window shows when traffic police should be on highest alert.
                <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-800 transform rotate-45" />
              </div>
            </div>
          </div>

          {/* Region Selector */}
          <div className="relative mt-2">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 w-full max-w-[220px]"
            >
              <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="truncate">
                {selectedStation === "all" ? "All Zones (City-Wide)" : selectedStation}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 ml-auto transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full max-w-[220px] bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-[240px] overflow-y-auto">
                <button
                  onClick={() => { setSelectedStation("all"); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${selectedStation === "all"
                      ? "bg-purple-50 text-purple-700"
                      : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  All Zones (City-Wide)
                </button>
                <div className="border-t border-gray-100" />
                {stations.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSelectedStation(s); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedStation === s
                        ? "bg-purple-50 text-purple-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {peakHour && (
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-0.5 flex items-center justify-end gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              Peak Surge Window
            </div>
            <div className="text-sm font-black text-gray-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 shadow-sm">
              {String(peakHour.hour).padStart(2, '0')}:00 - {String(peakHour.hour + 1 === 24 ? 0 : peakHour.hour + 1).padStart(2, '0')}:00
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex-1 flex flex-col relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-b-xl">
            <div className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Y-axis label */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 origin-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
            Predicted Violations
          </span>
        </div>

        <div className="flex flex-1 ml-8">
          {/* Y-axis ticks */}
          <div className="flex flex-col-reverse justify-between mr-2 shrink-0">
            {yTicks.map((tick, i) => (
              <span key={i} className="text-[9px] font-semibold text-gray-400 text-right w-6 leading-none">
                {tick}
              </span>
            ))}
          </div>

          {/* Chart area */}
          <div className="relative w-full flex items-end justify-between gap-1 flex-1">


            {/* Average Line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-gray-300 z-0 pointer-events-none"
              style={{ bottom: `${(avgTotal / scaleMax) * 100}%` }}
            >
              <span className="absolute right-0 -top-5 text-[10px] font-bold text-gray-400 bg-white px-1">
                AVG {avgTotal.toFixed(0)}
              </span>
            </div>

            {data.map((d) => {
              const heightPct = Math.min(100, (d.predicted_total / scaleMax) * 100);
              let barColor: string;
              if (d.predicted_total > avgTotal * 1.5) {
                barColor = "bg-gradient-to-t from-rose-500 to-rose-400 border-t border-rose-300 shadow-sm shadow-rose-200/50 group-hover:from-rose-600 group-hover:to-rose-500";
              } else if (d.predicted_total > avgTotal * 0.8) {
                barColor = "bg-gradient-to-t from-amber-500 to-amber-400 border-t border-amber-300 shadow-sm shadow-amber-200/50 group-hover:from-amber-600 group-hover:to-amber-500";
              } else {
                barColor = "bg-gradient-to-t from-emerald-500 to-emerald-400 border-t border-emerald-300 shadow-sm shadow-emerald-200/50 group-hover:from-emerald-600 group-hover:to-emerald-500";
              }

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
                    className={`w-full rounded-t-md transition-all duration-300 opacity-90 group-hover:opacity-100 ${barColor}`}
                    style={{ height: `${heightPct}%`, minHeight: '4px' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* X-Axis Labels */}
        <div className="w-full flex items-center justify-between gap-1 mt-2 ml-8">
          {data.map((d) => (
            <div key={d.hour} className="flex-1 flex justify-center">
              <span className="text-[10px] font-semibold text-gray-400">
                {d.hour % 3 === 0 ? d.hour : ''}
              </span>
            </div>
          ))}
        </div>

        {/* X-axis label */}
        <div className="text-center mt-1 ml-8">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Hour of Day
          </span>
        </div>
      </div>
    </section>
  );
}
