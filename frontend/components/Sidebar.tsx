"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, Camera, Car, AlertTriangle, ParkingSquare, FileText, BarChart3, ChevronLeft, ChevronRight, CheckCircle, Radar, ShieldAlert } from "lucide-react";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  const pathname = usePathname();

  const navItems = [
    { name: "Priority Intelligence", icon: Car, path: "/dashboard" },
    { name: "Offender Network", icon: FileText, path: "/network" },
    { name: "Data Quality", icon: CheckCircle, path: "/misclassification" },
    { name: "Pipeline Diagnostics", icon: Radar, path: "/audit" },
    { name: "Shift Planner", icon: ShieldAlert, path: "/enforcement" },
  ];

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Logo Area */}
      <Link href="/" className="h-32 flex flex-col items-center justify-center border-b border-gray-100 relative mt-2 hover:bg-gray-50 transition-colors cursor-pointer">
        <div className={`flex items-center justify-center mb-2 relative transition-all ${isOpen ? "w-16 h-16" : "w-10 h-10"}`}>
          <Image 
            src="/icon.png" 
            alt="PRISM Logo" 
            fill 
            className="object-contain"
            priority
          />
        </div>
        {isOpen && (
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap overflow-hidden text-center transition-opacity duration-300">
            PRISM
          </p>
        )}
      </Link>

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
                    ? "bg-slate-100 text-slate-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
            >
              <item.icon
                className={`w-5 h-5 shrink-0 ${isActive ? "text-slate-600" : "text-gray-400"}`}
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
