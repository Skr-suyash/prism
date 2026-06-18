"use client";

import MisclassificationSummary from "@/components/f4/MisclassificationSummary";
import ConfusionMatrix from "@/components/f4/ConfusionMatrix";
import HourlyCorrections from "@/components/f4/HourlyCorrections";
import StationBreakdown from "@/components/f4/StationBreakdown";

export default function MisclassificationPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Data Quality Audit</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Vehicle Type Misclassification Pattern Analysis
        </p>
      </div>

      <MisclassificationSummary />
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ConfusionMatrix />
        <HourlyCorrections />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <StationBreakdown />
      </div>
    </div>
  );
}
