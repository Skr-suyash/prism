"use client";

import { useEffect, useState } from "react";
import { api, type MisclassificationSummary as SummaryType } from "@/lib/apiClient";
import { Database, FileEdit, AlertTriangle, Percent } from "lucide-react";

export default function MisclassificationSummary() {
  const [summary, setSummary] = useState<SummaryType | null>(null);

  useEffect(() => {
    api.getMisclassificationSummary().then(setSummary).catch(console.error);
  }, []);

  if (!summary) {
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

  const cards = [
    {
      key: "total_records",
      label: "Total Records",
      value: summary.total_records.toLocaleString(),
      sub: "All violations",
      icon: Database,
      color: "text-purple-600",
      gradientId: "grad-f4-purple",
      stops: [{ offset: "0%", color: "#9333ea" }, { offset: "100%", color: "#db2777" }],
    },
    {
      key: "records_updated",
      label: "Records Updated",
      value: summary.records_updated.toLocaleString(),
      sub: `${((summary.records_updated / summary.total_records) * 100).toFixed(1)}% of total`,
      icon: FileEdit,
      color: "text-blue-500",
      gradientId: "grad-f4-blue",
      stops: [{ offset: "0%", color: "#3b82f6" }, { offset: "100%", color: "#06b6d4" }],
    },
    {
      key: "mismatches",
      label: "Misclassifications",
      value: summary.mismatches.toLocaleString(),
      sub: "Original ≠ Corrected",
      icon: AlertTriangle,
      color: "text-rose-500",
      gradientId: "grad-f4-rose",
      stops: [{ offset: "0%", color: "#f43f5e" }, { offset: "100%", color: "#f97316" }],
    },
    {
      key: "mismatch_rate",
      label: "Mismatch Rate",
      value: `${summary.mismatch_rate}%`,
      sub: "Of updated records",
      icon: Percent,
      color: "text-orange-500",
      gradientId: "grad-f4-orange",
      stops: [{ offset: "0%", color: "#f97316" }, { offset: "100%", color: "#eab308" }],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map(({ key, label, value, sub, icon: Icon, color, gradientId, stops }) => {
        return (
          <div
            key={key}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-between transition-shadow hover:shadow-md"
          >
            <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 absolute inset-0">
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    {stops.map((s, i) => (
                      <stop key={i} offset={s.offset} stopColor={s.color} />
                    ))}
                  </linearGradient>
                </defs>
                <circle cx="36" cy="36" r="28" stroke="#f3f4f6" strokeWidth="6" fill="none" />
                <circle
                  cx="36" cy="36" r="28"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="6" fill="none" strokeLinecap="round"
                  strokeDasharray="175.93" strokeDashoffset="44" // Just visual ring (75%)
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
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                {value}
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
