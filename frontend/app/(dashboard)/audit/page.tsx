"use client";

import { Activity, ShieldAlert, Cpu, Radar } from "lucide-react";
import SystemHealthQuadrant from "@/components/SystemHealthQuadrant";
import InsightCard from "@/components/InsightCard";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AuditPage() {
  const { t } = useLanguage();
  const [kodigehalliData, setKodigehalliData] = useState<any>(null);
  const [peenyaData, setPeenyaData] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(true);

  const handleDataLoaded = (data: any[]) => {
    const kodigehalli = data.find(d => d.station && d.station.toLowerCase().includes("kodigehalli") && d.is_blindspot);
    const peenya = data.find(d => d.station && d.station.toLowerCase().includes("peenya") && d.is_blindspot);
    
    if (kodigehalli) setKodigehalliData(kodigehalli);
    if (peenya) setPeenyaData(peenya);
    
    setLoadingInsight(false);
  };

  const shiftName = (bin: number) => bin === 0 ? "Night" : bin === 1 ? "Morning" : bin === 2 ? "Afternoon" : "Evening";
  
  const insight = [
    kodigehalliData && t.insights.auditConnectivity("Kodigehalli", (kodigehalliData.sync_rate * 100).toFixed(0), (kodigehalliData.rejection_rate * 100).toFixed(0), shiftName(kodigehalliData.hour_bin)),
    peenyaData && t.insights.auditDataQuality("Peenya", (peenyaData.sync_rate * 100).toFixed(0), (peenyaData.rejection_rate * 100).toFixed(0), shiftName(peenyaData.hour_bin))
  ].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
          {t.titles.infrastructureHealth}
        </h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {t.subtitles.infrastructureHealth}
        </p>
      </div>

      <InsightCard insight={insight} loading={loadingInsight} />

      {/* Info Banner */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-start gap-4">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0 mt-0.5">
          <Radar className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 mb-1">
            {t.auditBanner.title}
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t.auditBanner.p1_start}<span className="text-gray-700 font-semibold">{t.auditBanner.policeStation}</span>{t.auditBanner.comma}
            <span className="text-gray-700 font-semibold">{t.auditBanner.hourBin}</span>{t.auditBanner.and}
            <span className="text-gray-700 font-semibold">{t.auditBanner.violationType}</span>{t.auditBanner.p1_end}
            <br />
            {t.auditBanner.p2_start}<span className="text-rose-500 font-semibold">{t.auditBanner.abnormalPatterns}</span>{" "}
            {t.auditBanner.p2_end}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t.auditBanner.realtimeScoring}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.auditBanner.estimators}</span>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      <SystemHealthQuadrant onDataLoaded={handleDataLoaded} />
    </div>
  );
}
