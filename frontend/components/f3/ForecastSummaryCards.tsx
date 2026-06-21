"use client";

import { useEffect, useState } from "react";
import { api, type ForecastSummary } from "@/lib/apiClient";
import { TrendingUp, MapPin, Clock, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ForecastSummaryCards() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<ForecastSummary | null>(null);

  useEffect(() => {
    api.getForecastSummary().then(setSummary).catch(console.error);
  }, []);

  if (!summary || "error" in summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
            <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
            <div className="flex flex-col items-end gap-2">
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Double check the properties exist since the API might have returned a partial object if it failed in another way
  const totalPredicted = summary.total_predicted_24h || 0;
  const topStation = summary.top_station || "Unknown";
  const topStationCount = summary.top_station_count || 0;
  const topStationHour = summary.top_station_hour || 0;
  const mae = summary.mae || 0;
  const peakHourMae = summary.peak_hour_mae || 0;
  const forecastStart = summary.forecast_start ? new Date(summary.forecast_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A";

  const cards = [
    {
      key: "total_predicted",
      label: t.forecastSummary.predictedViolations,
      value: totalPredicted.toLocaleString(),
      sub: t.forecastSummary.next24Hours,
      icon: TrendingUp,
      color: "text-slate-800",
      strokeColor: "#1e293b",
    },
    {
      key: "top_station",
      label: t.forecastSummary.highestRiskZone,
      value: topStation,
      sub: `${topStationCount.toFixed(1)} ${t.forecastSummary.predictedAt} ${String(topStationHour).padStart(2, '0')}:00`,
      icon: MapPin,
      color: "text-slate-800",
      strokeColor: "#1e293b",
    },
    {
      key: "model_mae",
      label: t.forecastSummary.modelAccuracy,
      value: `±${mae.toFixed(2)}/hr`,
      sub: `${t.forecastSummary.peakHourMae} ±${peakHourMae.toFixed(2)}`,
      icon: ShieldAlert,
      color: "text-slate-800",
      strokeColor: "#1e293b",
    },
    {
      key: "time_window",
      label: t.forecastSummary.activeForecast,
      value: "24 Hours",
      sub: `${t.forecastSummary.from} ${forecastStart}`,
      icon: Clock,
      color: "text-slate-800",
      strokeColor: "#1e293b",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map(({ key, label, value, sub, icon: Icon, color, strokeColor }) => {
        return (
          <div
            key={key}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-between transition-shadow hover:shadow-md"
          >
            <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 absolute inset-0">
                <circle cx="36" cy="36" r="28" stroke="#f3f4f6" strokeWidth="6" fill="none" />
                <circle
                  cx="36" cy="36" r="28"
                  stroke={strokeColor}
                  strokeWidth="6" fill="none" strokeLinecap="round"
                  strokeDasharray="175.93" strokeDashoffset="44"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="relative z-10 bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm border border-gray-50">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>

            <div className="text-right ml-4">
              <h3 className="text-[12px] font-bold text-gray-700 tracking-wide uppercase mb-1">
                {label}
              </h3>
              <div className="text-xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {value}
              </div>
              <p className="text-xs text-gray-500 font-semibold mt-1">
                {sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
