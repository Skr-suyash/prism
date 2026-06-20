import { Search, Bell, User, ChevronDown } from "lucide-react";

export default function TopNav() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 sticky top-0 z-40">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6 ml-4">
        <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white" />
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <button className="flex items-center gap-3 hover:bg-gray-50 px-2 py-1 rounded-md transition-colors">
          <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden">
            <User className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-gray-700">Account</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </header>
  );
}
