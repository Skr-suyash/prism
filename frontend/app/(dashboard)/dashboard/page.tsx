"use client";

import dynamic from "next/dynamic";
import { Cpu, Layers, Activity, AlertTriangle } from "lucide-react";
import MetricsCards from "@/components/MetricsCards";
import RankFlipTable from "@/components/RankFlipTable";
import InsightCard from "@/components/InsightCard";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
  const { t } = useLanguage();
  const [rankData, setRankData] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(true);

  useEffect(() => {
    api.getRankFlip(1)
      .then((res) => {
        if (res && res.length > 0) {
          setRankData(res[0]);
        }
        setLoadingInsight(false);
      })
      .catch((err) => {
        console.error("Failed to load insight:", err);
        setLoadingInsight(false);
      });
  }, []);

  const insight = rankData ? t.insights.dashboard(rankData.police_station, rankData.count_rank, rankData.priority_rank) : "";

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{t.titles.strategicPriority}</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {t.subtitles.strategicPriority}
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
