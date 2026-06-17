"use client";

import { useEffect, useState } from "react";
import { api, type Metrics } from "@/lib/apiClient";
import { Database, MapPin, AlertTriangle } from "lucide-react";

const CARDS = [
  {
    key: "total_records" as keyof Metrics,
    label: "Total Records",
    sub: "Scored violations in dataset",
    icon: Database,
    accent: "text-cyan-400/50",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "zones_tracked" as keyof Metrics,
    label: "Zones Tracked",
    sub: "Active police stations",
    icon: MapPin,
    accent: "text-violet-400/50",
    format: (v: number) => v.toString(),
  },
  {
    key: "ignored_high_impact" as keyof Metrics,
    label: "Ignored High-Impact",
    sub: "High severity · Low escalation propensity",
    icon: AlertTriangle,
    accent: "text-rose-400/50",
    format: (v: number) => v.toLocaleString(),
  },
];

function CardSkeleton() {
  return (
    <div className="flex flex-col justify-center items-start p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl w-full min-h-[160px]">
      <div className="h-3 w-24 rounded bg-slate-800/60 animate-pulse mb-4" />
      <div className="h-10 w-36 rounded-lg bg-slate-800/60 animate-pulse mb-3 mt-4" />
      <div className="h-2.5 w-40 rounded bg-slate-800/40 animate-pulse" />
    </div>
  );
}

export default function MetricsCards() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    api.getMetrics().then(setM).catch(console.error);
  }, []);

  if (!m) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {CARDS.map(({ key, label, sub, icon: Icon, accent, format }) => (
        <div
          key={key}
          className="flex flex-col justify-center items-start p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl w-full min-h-[160px]"
        >
          <div className="flex w-full items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              {label}
            </p>
            <Icon className={`w-4 h-4 shrink-0 ${accent}`} />
          </div>
          <h3 className="text-4xl font-light tracking-tight text-white leading-none break-words w-full mt-4">
            {format(m[key] as number)}
          </h3>
          <p className="text-xs text-slate-400 mt-2 font-mono leading-relaxed">
            {sub}
          </p>
        </div>
      ))}
    </div>
  );
}
