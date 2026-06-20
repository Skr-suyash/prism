"use client";

import { useEffect, useState } from "react";
import { api, type Metrics } from "@/lib/apiClient";
import { Database, MapPin, AlertTriangle, Info } from "lucide-react";

const CARDS = [
  {
    key: "total_records" as keyof Metrics,
    label: "Total Records",
    sub: "Scored violations",
    icon: Database,
    color: "text-slate-800",
    strokeColor: "#1e293b", // slate-800
    format: (v: number) => v.toLocaleString(),
    pct: 100, // Just visual
    tooltip: "The total number of traffic violations ingested and processed by the PRISM AI engine.",
  },
  {
    key: "zones_tracked" as keyof Metrics,
    label: "Zones Tracked",
    sub: "Police stations",
    icon: MapPin,
    color: "text-slate-800",
    strokeColor: "#1e293b", // slate-800
    format: (v: number) => v.toString(),
    pct: 75,
    tooltip: "The number of distinct traffic police zones or jurisdictions currently being monitored.",
  },
  {
    key: "ignored_high_impact" as keyof Metrics,
    label: "Ignored High-Impact",
    sub: "High severity targets",
    icon: AlertTriangle,
    color: "text-slate-800",
    strokeColor: "#1e293b", // slate-800
    format: (v: number) => v.toLocaleString(),
    pct: 45,
    tooltip: "Critical traffic incidents that were flagged by AI as causing severe congestion, but were under-patrolled by officers.",
  },
];

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
      <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
      <div className="flex flex-col items-end gap-2">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {CARDS.map(({ key, label, sub, icon: Icon, color, strokeColor, format, pct, tooltip }) => {
        const radius = 28;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (pct / 100) * circumference;

        return (
          <div
            key={key}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-between transition-shadow hover:shadow-md"
          >
            {/* Left: Circular Visual */}
            <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 absolute inset-0">
                <circle
                  cx="36" cy="36" r={radius}
                  stroke="#f3f4f6" strokeWidth="6" fill="none"
                />
                <circle
                  cx="36" cy="36" r={radius}
                  stroke={strokeColor}
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="relative z-10 bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm border border-gray-50">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>

            {/* Right: Stats */}
            <div className="text-right ml-4">
              <div className="flex items-center justify-end gap-1.5 mb-1 group relative">
                <Info className="w-3.5 h-3.5 text-gray-400 cursor-help transition-colors group-hover:text-gray-600" />
                <h3 className="text-[13px] font-bold text-gray-700 tracking-wide uppercase">
                  {label}
                </h3>
                <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-left">
                  {tooltip}
                  <div className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-800 transform rotate-45" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {format(m[key] as number)}
              </div>
              <p className="text-xs text-rose-500 font-semibold mt-1">
                {sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
