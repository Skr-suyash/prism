"use client";

import { useEffect, useState } from "react";
import { api, type HubData } from "@/lib/apiClient";
import { Map, Layers, Share2 } from "lucide-react";

export default function HubsList() {
  const [data, setData] = useState<HubData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHubs()
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Find max centrality for scaling the progress bar
  const maxCentrality = data.length > 0 ? Math.max(...data.map(d => d.centrality_score)) : 1;

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start">
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-600" />
            Repeat Offender Hubs
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Zones ranked by NetworkX bipartite degree centrality (Vehicle ↔ Zone)
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
          {data.map((hub, i) => {
            const pct = (hub.centrality_score / maxCentrality) * 100;
            return (
              <div key={i} className="flex flex-col gap-2 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                    <span className="text-sm font-bold text-gray-800">{hub.zone}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-purple-600">{hub.centrality_score.toFixed(4)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Visual Bar */}
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">
                    <span className="flex items-center gap-1"><Map className="w-3 h-3" /> {hub.unique_offenders} Unique Repeaters</span>
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {hub.total_repeat_violations} Total</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
