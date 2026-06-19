import ArchetypeScatter from "@/components/f5/ArchetypeScatter";
import OffenderTable from "@/components/f5/OffenderTable";
import HubsList from "@/components/f5/HubsList";
import { FileText } from "lucide-react";

export default function NetworkPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12 w-full px-6 py-8">
      {/* Page Title */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 text-purple-600 flex items-center justify-center rounded-xl shadow-sm border border-purple-200">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Repeat Offender Network</h1>
          <p className="text-sm font-medium text-gray-500">
            K-Means behavioral clustering & Bipartite Graph Centrality
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Row: Scatter Chart & Hubs List */}
        <div className="lg:col-span-1">
          <ArchetypeScatter />
        </div>
        <div className="lg:col-span-1">
          <HubsList />
        </div>
        
        {/* Bottom Row: Offender Table */}
        <div className="lg:col-span-2">
          <OffenderTable />
        </div>
      </div>
    </div>
  );
}
