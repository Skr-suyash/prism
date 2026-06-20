import { Crosshair } from "lucide-react";

interface InsightCardProps {
  insight: string | string[];
  loading?: boolean;
}

export default function InsightCard({ insight, loading = false }: InsightCardProps) {
  const lines = Array.isArray(insight) ? insight : [insight];

  return (
    <div className="bg-gradient-to-r from-purple-50/80 to-blue-50/80 border border-purple-100/60 rounded-xl p-4 shadow-sm flex items-start gap-3 mb-2">
      <div className="p-1.5 bg-white rounded-lg shadow-sm shrink-0 border border-purple-50 mt-0.5">
        <Crosshair className="w-4 h-4 text-purple-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-purple-900 mb-0.5 uppercase tracking-wider">
          Feature Insight
        </p>
        {loading ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="h-4 bg-purple-100/50 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-purple-100/50 rounded w-1/2 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {lines.filter(Boolean).map((line, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed font-medium">
                {line}
              </p>
            ))}
            {lines.filter(Boolean).length === 0 && (
              <p className="text-sm text-gray-700 leading-relaxed font-medium">No insight available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
