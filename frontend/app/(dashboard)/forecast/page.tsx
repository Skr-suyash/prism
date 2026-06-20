"use client";

import { useEffect, useState } from "react";
import { api, type ForecastSummary } from "@/lib/apiClient";
import ForecastSummaryCards from "@/components/f3/ForecastSummaryCards";
import DispatchPriority from "@/components/f3/DispatchPriority";
import HourlyForecastChart from "@/components/f3/HourlyForecastChart";
import InsightCard from "@/components/InsightCard";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ForecastPage() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getForecastSummary()
      .then(res => {
        setSummary(res);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load forecast summary for insight:", err);
        setLoading(false);
      });
  }, []);

  const insightText = summary && !("error" in summary)
    ? t.insights.forecastTotal(summary.total_predicted_24h?.toLocaleString() || 0, summary.top_station || "", summary.top_station_count?.toFixed(1) || "0", String(summary.top_station_hour).padStart(2, '0'))
    : t.insights.forecastLoading;

  return (
    <div className="flex flex-col gap-4 max-w-[1600px] mx-auto pb-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">{t.titles.peakHourSurge}</h1>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          {t.subtitles.peakHourSurge}
        </p>
      </div>

      <InsightCard insight={insightText} loading={loading} />

      <ForecastSummaryCards />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-[340px]">
        <div className="xl:col-span-1 h-full">
          <DispatchPriority />
        </div>
        <div className="xl:col-span-2 h-full">
          <HourlyForecastChart />
        </div>
      </div>
    </div>
  );
}
