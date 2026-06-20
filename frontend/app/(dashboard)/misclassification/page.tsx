"use client";

import MisclassificationSummary from "@/components/f4/MisclassificationSummary";
import ConfusionMatrix from "@/components/f4/ConfusionMatrix";
import HourlyCorrections from "@/components/f4/HourlyCorrections";
import StationBreakdown from "@/components/f4/StationBreakdown";
import InsightCard from "@/components/InsightCard";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function MisclassificationPage() {
  const { t } = useLanguage();
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(true);

  useEffect(() => {
    api.getMisclassificationSummary()
      .then(res => {
        if (res && res.top_swaps && res.top_swaps.length > 0) {
          const top = res.top_swaps[0];
          setInsight(t.insights.misclassification(top.swap, top.count));
        }
        setLoadingInsight(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingInsight(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{t.titles.dataQualityAudit}</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {t.subtitles.dataQualityAudit}
        </p>
      </div>

      <InsightCard insight={insight} loading={loadingInsight} />

      <MisclassificationSummary />
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ConfusionMatrix />
        <HourlyCorrections />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <StationBreakdown />
      </div>
    </div>
  );
}
