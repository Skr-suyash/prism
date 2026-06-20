"use client";

import { useEffect, useState } from "react";
import { api, type Metrics } from "@/lib/apiClient";
import { Database, MapPin, AlertTriangle } from "lucide-react";

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
      {CARDS.map(({ key, label, sub, icon: Icon, color, strokeColor, format, pct }) => {
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
              <h3 className="text-[13px] font-bold text-gray-700 tracking-wide uppercase mb-1">
                {label}
              </h3>
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
