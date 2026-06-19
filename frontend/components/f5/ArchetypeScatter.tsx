"use client";

import { useEffect, useState } from "react";
import { api, type ClusterData } from "@/lib/apiClient";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import { Network } from "lucide-react";

const COLORS = ["#8b5cf6", "#ec4899", "#f97316", "#0ea5e9", "#10b981"];

export default function ArchetypeScatter() {
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClusters()
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group data by cluster for Recharts (limit points to prevent browser freezing)
  const clusteredData: Record<number, any[]> = {};
  data.scatter_data.forEach(pt => {
    if (!clusteredData[pt.cluster]) clusteredData[pt.cluster] = [];
    // Limit to 200 points per cluster (max 800-1000 points total) to keep rendering smooth
    if (clusteredData[pt.cluster].length < 200) {
      clusteredData[pt.cluster].push(pt);
    }
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs min-w-[200px]">
          <div className="font-bold text-gray-300 border-b border-gray-700 pb-2 mb-2">{d.archetype}</div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Device ID</span>
            <span className="font-mono">{d.device_id}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Violations</span>
            <span className="font-bold text-rose-400">{d.violation_count}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Priority Score</span>
            <span className="font-bold text-orange-400">{d.mean_priority.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Common Offence</span>
            <span className="text-right max-w-[120px] truncate" title={d.most_common_violation}>{d.most_common_violation}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <Network className="w-4 h-4 text-purple-600" />
            Repeat Offender Archetypes
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            K-Means clustering identifying behavioral patterns of repeat violators
          </p>
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              type="number" 
              dataKey="violation_count" 
              name="Violations" 
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              label={{ value: 'Total Violations', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis 
              type="number" 
              dataKey="mean_priority" 
              name="Priority" 
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              label={{ value: 'Mean Priority Score', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 12, fontWeight: 600 }}
            />
            <ZAxis type="number" range={[40, 100]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} isAnimationActive={false} />
            
            {Object.keys(clusteredData).map((clusterId, index) => (
              <Scatter 
                key={clusterId} 
                name={data.archetypes[clusterId as any]} 
                data={clusteredData[clusterId as any]} 
                fill={COLORS[index % COLORS.length]} 
                fillOpacity={0.7}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex gap-4 overflow-x-auto">
        {Object.keys(data.archetypes).map((clusterId, index) => (
          <div key={clusterId} className="flex items-center gap-2 text-[11px] font-bold text-gray-600 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full inline-block shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            {data.archetypes[clusterId as any]}
          </div>
        ))}
      </div>
    </section>
  );
}
