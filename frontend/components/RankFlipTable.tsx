"use client";

import { useEffect, useState } from "react";
import { api, type ZoneData } from "@/lib/apiClient";
import { TrendingUp, TrendingDown, Minus, MapPin, AlertTriangle, Info } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <div className="flex items-center gap-0.5 text-emerald-600 font-bold text-[13px]">
        <TrendingUp className="w-3.5 h-3.5" />
        +{delta}
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="flex items-center gap-0.5 text-rose-600 font-bold text-[13px]">
        <TrendingDown className="w-3.5 h-3.5" />
        {delta}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-gray-400 text-[13px] font-bold">
      <Minus className="w-3.5 h-3.5" />
      <span>0</span>
    </div>
  );
}



export default function RankFlipTable() {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const { t } = useLanguage();
  const maxDelta = zones.length ? Math.max(...zones.map((z) => Math.abs(z.rank_change))) : 1;

  useEffect(() => {
    api.getRankFlip(12).then(setZones).catch(console.error);
  }, []);

  if (zones.length === 0) {
    return (
      <div className="h-64 rounded-xl bg-white border border-gray-100 shadow-sm animate-pulse" />
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-gray-50/50 rounded-t-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
              {t.titles.rankFlipTable}
            </h2>
            <div className="relative group">
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
              <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {t.tooltips.rankFlipTable}
                <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-800 transform rotate-45" />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {t.componentSubtitles.rankFlipTable}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold text-gray-500">
          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
            <TrendingUp className="w-3 h-3" />
            Underpatrolled
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
            <TrendingDown className="w-3 h-3" />
            Overpatrolled
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-white">
              {["Zone", "Count Rank", "Priority Rank", "Delta", "Violations", "Avg Priority"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-[11px] uppercase tracking-wider font-bold text-gray-500 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => {
              const isHighlight = z.rank_change >= 7;
              return (
                <tr
                  key={z.police_station}
                  className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                    isHighlight
                      ? "bg-slate-50/30"
                      : i % 2 === 0
                      ? "bg-white"
                      : "bg-gray-50/30"
                  }`}
                >
                  {/* Zone */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isHighlight && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                      <span className={`font-bold ${isHighlight ? "text-gray-900" : "text-gray-700"}`}>
                        {z.police_station}
                      </span>
                    </div>
                  </td>

                  {/* Count Rank */}
                  <td className="px-5 py-3">
                    <span className="font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-xs">#{z.count_rank}</span>
                  </td>

                  {/* Priority Rank */}
                  <td className="px-5 py-3">
                    <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-xs">#{z.priority_rank}</span>
                  </td>

                  {/* Delta badge */}
                  <td className="px-5 py-3">
                    <DeltaBadge delta={z.rank_change} />
                  </td>



                  {/* Violations */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-700 font-semibold">{z.count.toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Avg Priority */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{z.mean_priority.toFixed(2)}</span>
                    </div>
                  </td>


                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
