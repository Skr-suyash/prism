import ForecastSummaryCards from "@/components/f3/ForecastSummaryCards";
import DispatchPriority from "@/components/f3/DispatchPriority";
import HourlyForecastChart from "@/components/f3/HourlyForecastChart";

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-4 max-w-[1600px] mx-auto pb-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Peak Hour Surge Predictor</h1>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          24-Hour Predictive Resource Allocation Model (XGBoost)
        </p>
      </div>

      <ForecastSummaryCards />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-[340px]">
        <div className="xl:col-span-1 h-full">
          <DispatchPriority />
        </div>
        <div className="xl:col-span-2 h-full">
          <HourlyForecastChart />
        </div>
      </div>
    </div>
  );
}
