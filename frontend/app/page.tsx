"use client";

import dynamic from "next/dynamic";
import { Cpu, Layers, Activity, AlertTriangle } from "lucide-react";
import MetricsCards from "@/components/MetricsCards";
import RankFlipTable from "@/components/RankFlipTable";
import InsightCard from "@/components/InsightCard";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

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
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(true);

  useEffect(() => {
    api.getRankFlip(1)
      .then((res) => {
        if (res && res.length > 0) {
          const z = res[0];
          setInsight(`${z.police_station} is ranked #${z.count_rank} by ticket volume but #${z.priority_rank} by operational priority — it is the most under-patrolled zone in the city.`);
        }
        setLoadingInsight(false);
      })
      .catch((err) => {
        console.error("Failed to load insight:", err);
        setLoadingInsight(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Today's Traffic Overview</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          GridLock Severity-Weighted Congestion Index
        </p>
      </div>

      <InsightCard insight={insight} loading={loadingInsight} />

      <MetricsCards />
      
      <DualHeatmap />
      
      <div className="grid grid-cols-1 gap-6">
        <RankFlipTable />
      </div>
    </div>
  );
}
