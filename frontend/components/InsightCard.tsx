import { Crosshair } from "lucide-react";

interface InsightCardProps {
  insight: string | string[];
  loading?: boolean;
}

export default function InsightCard({ insight, loading = false }: InsightCardProps) {
  const lines = Array.isArray(insight) ? insight : [insight];

  return (
    <div className="bg-white rounded-xl border border-gray-200 border-l-[6px] border-l-slate-800 p-5 shadow-md flex items-start gap-4 mb-4 transition-all hover:shadow-lg">
      <div className="p-2 bg-slate-800 rounded-lg shadow-inner shrink-0 mt-0.5">
        <Crosshair className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">
          Feature Insight
        </p>
        {loading ? (
          <div className="flex flex-col gap-2 mt-2">
            <div className="h-5 bg-gray-100 rounded w-3/4 animate-pulse" />
            <div className="h-5 bg-gray-100 rounded w-1/2 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lines.filter(Boolean).map((line, i) => (
              <p key={i} className="text-[15px] text-slate-900 leading-relaxed font-bold">
                {line}
              </p>
            ))}
            {lines.filter(Boolean).length === 0 && (
              <p className="text-[15px] text-gray-500 leading-relaxed font-medium italic">No insight currently available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
