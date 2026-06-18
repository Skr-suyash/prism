"use client";

import { useEffect, useState } from "react";
import { api, type ZoneData } from "@/lib/apiClient";
import { TrendingUp, TrendingDown, Minus, MapPin, Zap, AlertTriangle } from "lucide-react";

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 text-emerald-600 font-bold text-[13px]">
          <TrendingUp className="w-3.5 h-3.5" />
          +{delta}
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
          Underpatrolled
        </span>
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 text-rose-600 font-bold text-[13px]">
          <TrendingDown className="w-3.5 h-3.5" />
          {delta}
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
          Overpatrolled
        </span>
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

function DeltaBar({ delta, max }: { delta: number; max: number }) {
  const pct = max > 0 ? Math.abs(delta) / max : 0;
  const width = `${(pct * 50).toFixed(1)}%`;
  return (
    <div className="relative h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`absolute h-full rounded-full transition-all ${delta > 0 ? "right-1/2 bg-emerald-400" : delta < 0 ? "left-1/2 bg-rose-400" : "bg-gray-300"}`}
        style={{ width }}
      />
    </div>
  );
}

export default function RankFlipTable() {
  const [zones, setZones] = useState<ZoneData[]>([]);
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
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
            Rank Flip Table
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Priority rank vs. naive count rank — reveals misallocated patrol resources
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
              {["Zone", "Count Rank", "Priority Rank", "Delta", "", "Violations", "Avg Priority", "Junction %"].map((h) => (
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
                      ? "bg-purple-50/30"
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
                    <span className="font-mono text-purple-700 font-semibold bg-purple-100 px-1.5 py-0.5 rounded text-xs">#{z.priority_rank}</span>
                  </td>

                  {/* Delta badge */}
                  <td className="px-5 py-3">
                    <DeltaBadge delta={z.rank_change} />
                  </td>

                  {/* Delta bar */}
                  <td className="px-3 py-3 w-32">
                    <DeltaBar delta={z.rank_change} max={maxDelta} />
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
                      <Zap className="w-3.5 h-3.5 text-orange-400" />
                      <span className="font-semibold text-gray-800">{z.mean_priority.toFixed(2)}</span>
                    </div>
                  </td>

                  {/* Junction % */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${(z.junction_pct * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className="font-mono text-gray-500 text-xs font-semibold">
                        {(z.junction_pct * 100).toFixed(0)}%
                      </span>
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
