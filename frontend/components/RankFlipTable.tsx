"use client";

import { useEffect, useState } from "react";
import { api, type ZoneData } from "@/lib/apiClient";
import { TrendingUp, TrendingDown, Minus, MapPin, Zap, AlertTriangle } from "lucide-react";

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm">
          <TrendingUp className="w-3.5 h-3.5" />
          +{delta}
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
          Underpatrolled
        </span>
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 text-rose-400 font-bold text-sm">
          <TrendingDown className="w-3.5 h-3.5" />
          {delta}
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-600 bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.5 rounded">
          Overpatrolled
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-slate-500 text-sm">
      <Minus className="w-3.5 h-3.5" />
      <span>0</span>
    </div>
  );
}

function DeltaBar({ delta, max }: { delta: number; max: number }) {
  const pct = max > 0 ? Math.abs(delta) / max : 0;
  const width = `${(pct * 50).toFixed(1)}%`;
  return (
    <div className="relative h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`absolute h-full rounded-full transition-all ${delta > 0 ? "right-1/2 bg-emerald-500" : delta < 0 ? "left-1/2 bg-rose-500" : "bg-slate-600"}`}
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
      <div className="h-64 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
            Rank Flip Table
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Priority rank vs. naive count rank — reveals misallocated patrol resources
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-semibold text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            Underpatrolled
          </span>
          <span className="flex items-center gap-1.5 text-rose-600">
            <TrendingDown className="w-3 h-3" />
            Overpatrolled
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {["Zone", "Count Rank", "Priority Rank", "Delta", "", "Violations", "Avg Priority", "Junction %"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[10px] uppercase tracking-widest font-semibold text-slate-500"
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
                  className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/40 ${
                    isHighlight
                      ? "bg-emerald-950/10"
                      : i % 2 === 0
                      ? "bg-transparent"
                      : "bg-slate-900/40"
                  }`}
                >
                  {/* Zone */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isHighlight && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className={`font-semibold ${isHighlight ? "text-white" : "text-slate-300"}`}>
                        {z.police_station}
                      </span>
                    </div>
                  </td>

                  {/* Count Rank */}
                  <td className="px-5 py-3">
                    <span className="font-mono text-slate-400">#{z.count_rank}</span>
                  </td>

                  {/* Priority Rank */}
                  <td className="px-5 py-3">
                    <span className="font-mono text-slate-400">#{z.priority_rank}</span>
                  </td>

                  {/* Delta badge */}
                  <td className="px-5 py-3">
                    <DeltaBadge delta={z.rank_change} />
                  </td>

                  {/* Delta bar */}
                  <td className="px-3 py-3">
                    <DeltaBar delta={z.rank_change} max={maxDelta} />
                  </td>

                  {/* Violations */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-300 font-mono">{z.count.toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Avg Priority */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span className="font-mono font-semibold text-amber-400">{z.mean_priority.toFixed(2)}</span>
                    </div>
                  </td>

                  {/* Junction % */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500/70 rounded-full"
                          style={{ width: `${(z.junction_pct * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-400 text-xs">
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
