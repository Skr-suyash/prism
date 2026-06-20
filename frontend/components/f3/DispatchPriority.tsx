"use client";

import { useEffect, useState } from "react";
import { api, type ForecastDispatch } from "@/lib/apiClient";
import { ShieldAlert, AlertTriangle, ChevronLeft, ChevronRight, Clock } from "lucide-react";

const PAGE_SIZE = 8;

function getSeverity(count: number, max: number): { label: string; color: string; bg: string; border: string; rowBg: string; numberBg: string } {
  // Treat anything below 0.5 as effectively zero
  if (count < 0.5) return { label: "Moderate", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", rowBg: "bg-green-50 border border-green-100/50", numberBg: "bg-green-500 text-white" };
  if (max < 0.5) return { label: "Moderate", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", rowBg: "bg-green-50 border border-green-100/50", numberBg: "bg-green-500 text-white" };
  const ratio = count / max;
  if (ratio >= 0.7) return { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", rowBg: "bg-red-50 border border-red-100/50", numberBg: "bg-red-500 text-white" };
  if (ratio >= 0.4) return { label: "Elevated", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", rowBg: "bg-yellow-50 border border-yellow-100/50", numberBg: "bg-yellow-500 text-white" };
  return { label: "Moderate", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", rowBg: "bg-green-50 border border-green-100/50", numberBg: "bg-green-500 text-white" };
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DispatchPriority() {
  const [data, setData] = useState<ForecastDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [startHour, setStartHour] = useState<number>(new Date().getHours());
  const [endHour, setEndHour] = useState<number>(23);

  useEffect(() => {
    api.getAllForecasts()
      .then(d => {
        if (Array.isArray(d)) {
          setData(d);
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

  // Filter by selected hour range
  const filteredData = data.filter(d => {
    if (startHour <= endHour) {
      return d.hour >= startHour && d.hour <= endHour;
    }
    // Wrap around midnight (e.g. 22:00 → 03:00)
    return d.hour >= startHour || d.hour <= endHour;
  });

  const maxCount = filteredData.length > 0 ? Math.max(...filteredData.map(d => d.predicted_violation_count)) : 1;
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pageData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-[13px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Priority High Risk Time Slots
        </h2>
        {/* Time Slot Picker */}
        <div className="flex items-center gap-2 mt-2">
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <select
            value={startHour}
            onChange={e => { setStartHour(Number(e.target.value)); setPage(0); }}
            className="px-2 py-1 rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-700 cursor-pointer hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {HOURS.map(h => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
          <span className="text-[11px] font-bold text-gray-400">to</span>
          <select
            value={endHour}
            onChange={e => { setEndHour(Number(e.target.value)); setPage(0); }}
            className="px-2 py-1 rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-700 cursor-pointer hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {HOURS.map(h => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-400 font-medium ml-1">
            {filteredData.length} slots
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <div className="flex flex-col gap-0.5">
          {pageData.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-6">No data for this time window</div>
          )}
          {pageData.map((item, i) => {
            const globalIndex = page * PAGE_SIZE + i;
            const severity = getSeverity(item.predicted_violation_count, maxCount);
            const isTop = globalIndex < 3 && item.predicted_violation_count >= 0.5;

            return (
              <div
                key={`${item.station}-${item.hour}`}
                className={`p-3 rounded-lg flex items-center justify-between transition-colors ${severity.rowBg}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${severity.numberBg}`}>
                    {globalIndex + 1}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      {item.station}
                      {isTop && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      At {String(item.hour).padStart(2, '0')}:00 · <span className="font-bold">{Math.round(item.predicted_violation_count)}</span> predicted
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${severity.bg} ${severity.color} border ${severity.border}`}>
                    {severity.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <span className="text-xs font-bold text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
