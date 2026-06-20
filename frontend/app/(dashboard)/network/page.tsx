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
  const [topHub, setTopHub] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(true);

  useEffect(() => {
    api.getHubs()
      .then(res => {
        if (res && res.length > 0) {
          setTopHub(res[0]);
        }
        setLoadingInsight(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingInsight(false);
      });
  }, []);

  const insight = topHub ? t.insights.network(topHub.zone, topHub.unique_offenders, topHub.total_repeat_violations) : "";

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12 w-full px-6 py-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{t.titles.repeatOffenderNetwork}</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {t.subtitles.repeatOffenderNetwork}
        </p>
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
