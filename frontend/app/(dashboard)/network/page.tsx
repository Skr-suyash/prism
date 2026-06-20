"use client";

import ArchetypeScatter from "@/components/f5/ArchetypeScatter";
import OffenderTable from "@/components/f5/OffenderTable";
import HubsList from "@/components/f5/HubsList";
import InsightCard from "@/components/InsightCard";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NetworkPage() {
  const { t } = useLanguage();
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(true);

  useEffect(() => {
    api.getHubs()
      .then(res => {
        if (res && res.length > 0) {
          const top = res[0];
          setInsight(t.insights.network(top.zone, top.unique_offenders, top.total_repeat_violations));
        }
        setLoadingInsight(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingInsight(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12 w-full px-6 py-8">
      {/* Page Title */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-slate-100 text-slate-600 flex items-center justify-center rounded-xl shadow-sm border border-slate-200">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{t.titles.repeatOffenderNetwork}</h1>
          <p className="text-sm font-medium text-gray-500">
            {t.subtitles.repeatOffenderNetwork}
          </p>
        </div>
      </div>

      <InsightCard insight={insight} loading={loadingInsight} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Row: Scatter Chart & Hubs List */}
        <div className="lg:col-span-1">
          <ArchetypeScatter />
        </div>
        <div className="lg:col-span-1">
          <HubsList />
        </div>
        
        {/* Bottom Row: Offender Table */}
        <div className="lg:col-span-2">
          <OffenderTable />
        </div>
      </div>
    </div>
  );
}
