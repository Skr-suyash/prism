import ForecastSummaryCards from "@/components/f3/ForecastSummaryCards";
import DispatchPriority from "@/components/f3/DispatchPriority";
import HourlyForecastChart from "@/components/f3/HourlyForecastChart";
import ForecastHeatmap from "@/components/f3/ForecastHeatmap";

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Predictive Dispatch</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          24-Hour Predictive Resource Allocation Model (XGBoost)
        </p>
      </div>

      <ForecastSummaryCards />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 min-h-[400px]">
          <DispatchPriority />
        </div>
        <div className="xl:col-span-2 min-h-[400px]">
          <HourlyForecastChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 min-h-[600px]">
        <ForecastHeatmap />
      </div>
    </div>
  );
}
