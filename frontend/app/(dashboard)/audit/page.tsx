"use client";

import { Activity, ShieldAlert, Cpu, Radar } from "lucide-react";
import SystemHealthQuadrant from "@/components/SystemHealthQuadrant";
import InsightCard from "@/components/InsightCard";
import { useState } from "react";

export default function AuditPage() {
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(true);

  const handleDataLoaded = (data: any[]) => {
    const kodigehalli = data.find(d => d.station && d.station.toLowerCase().includes("kodigehalli") && d.is_blindspot);
    const peenya = data.find(d => d.station && d.station.toLowerCase().includes("peenya") && d.is_blindspot);
    
    const lines: string[] = [];
    const shiftName = (bin: number) => bin === 0 ? "Night" : bin === 1 ? "Morning" : bin === 2 ? "Afternoon" : "Evening";

    if (kodigehalli) {
      lines.push(
        `Kodigehalli has a ${(kodigehalli.sync_rate * 100).toFixed(0)}% sync rate and ${(kodigehalli.rejection_rate * 100).toFixed(0)}% rejection rate during ${shiftName(kodigehalli.hour_bin)} shifts — data is failing to reach the system, indicating a connectivity or hardware issue.`
      );
    }

    if (peenya) {
      lines.push(
        `Peenya delivers data successfully (${(peenya.sync_rate * 100).toFixed(0)}% sync rate) but ${(peenya.rejection_rate * 100).toFixed(0)}% of submissions are rejected during ${shiftName(peenya.hour_bin)} shifts — the pipeline is active but the data quality is failing validation checks.`
      );
    }

    setInsight(lines);
    setLoadingInsight(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
          Infrastructure Health & Data Loss Audit
        </h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Unsupervised anomaly detection of SCITA pipeline failures
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
            Isolation Forest Anomaly Detection
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Each bubble represents an operational bucket — a unique combination
            of <span className="text-gray-700 font-semibold">Police Station</span>,{" "}
            <span className="text-gray-700 font-semibold">Hour Bin</span>, and{" "}
            <span className="text-gray-700 font-semibold">Violation Type</span>.
            Buckets with <span className="text-rose-500 font-semibold">abnormal patterns</span>{" "}
            of low sync rates, high rejection, or unusual volumes are flagged as blindspots.
            Only buckets with ≥ 50 records are considered statistically significant.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Real-time scoring</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span>200 estimators</span>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      <SystemHealthQuadrant onDataLoaded={handleDataLoaded} />
    </div>
  );
}
