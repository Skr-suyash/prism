"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Camera, Car, AlertTriangle, ParkingSquare, FileText, BarChart3, ChevronLeft, ChevronRight, CheckCircle, Radar } from "lucide-react";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  const pathname = usePathname();

  const navItems = [
    { name: "Traffic", icon: Car, path: "/" },
    { name: "Offender Network", icon: FileText, path: "/network" },
    { name: "Data Quality", icon: CheckCircle, path: "/misclassification" },
    { name: "Pipeline Diagnostics", icon: Radar, path: "/audit" },
  ];

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Logo Area */}
      <div className="h-32 flex flex-col items-center justify-center border-b border-gray-100 relative">
        <div className={`rounded-full border-4 border-purple-500 flex items-center justify-center mb-2 relative transition-all ${isOpen ? "w-16 h-16" : "w-10 h-10 border-2"}`}>
          <div className="absolute inset-[-4px] rounded-full border-[3px] border-transparent border-l-purple-300 border-r-pink-400 opacity-60" />
          <span className={`font-bold text-gray-800 tracking-tight transition-all ${isOpen ? "text-xl" : "text-sm"}`}>PTU</span>
          <div className="absolute right-0 top-1 w-1.5 h-1.5 rounded-full bg-red-500" />
          <div className="absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full bg-green-500" />
        </div>
        {isOpen && (
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap overflow-hidden text-center transition-opacity duration-300">
            Traffic Updates
          </p>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path) && item.path !== "#";
          return (
            <Link
              key={item.name}
              href={item.path}
              title={!isOpen ? item.name : undefined}
              className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left
                ${isOpen ? "justify-start gap-4" : "justify-center"}
                ${
                  isActive
                    ? "bg-purple-100 text-purple-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
            >
              <item.icon
                className={`w-5 h-5 shrink-0 ${isActive ? "text-purple-600" : "text-gray-400"}`}
              />
              {isOpen && <span className="whitespace-nowrap">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle Button */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-full py-2.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
