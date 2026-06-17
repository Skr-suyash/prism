"use client";

import dynamic from "next/dynamic";
import { Cpu, Layers, Activity, AlertTriangle } from "lucide-react";
import MetricsCards from "@/components/MetricsCards";
import RankFlipTable from "@/components/RankFlipTable";

const DualHeatmap = dynamic(() => import("@/components/DualHeatmap"), {
  ssr: false,
  loading: () => (
    <div className="h-[660px] rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-xs tracking-widest uppercase">Initializing WebGL</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto px-6 sm:px-12 lg:px-24 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">
              GridLock Command Center
            </span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-600 font-mono tracking-wide">
            <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-cyan-600" />XGBoost v2.3 · 24 features</span>
            <span className="flex items-center gap-1.5"><Layers className="w-3 h-3 text-violet-600" />298,450 records</span>
            <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-emerald-600" />Live</span>
          </div>
        </div>
      </header>

      {/* Master container — gap-12 between every row, no child can break out */}
      <main className="min-h-screen bg-slate-950 text-slate-50 py-12 px-6 sm:px-12 lg:px-24 mx-auto max-w-[1800px] flex flex-col gap-12">
        {/* Page heading */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Operational Priority Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Bengaluru Parking Enforcement · Jan – May 2024
            </p>
          </div>
          
        </div>

        <MetricsCards />
        <DualHeatmap />
        <RankFlipTable />

        <footer className="text-center text-[10px] text-slate-800 py-4 font-mono tracking-widest uppercase border-t border-slate-900">
          GridLock v2.0 · FastAPI + Next.js · Deck.gl WebGL
        </footer>
      </main>
    </div>
  );
}
