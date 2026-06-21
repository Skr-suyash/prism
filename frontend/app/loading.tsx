import { Hexagon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-5">
      <div className="relative flex items-center justify-center w-20 h-20">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 w-full h-full border-[3px] border-slate-200 rounded-full animate-pulse"></div>
        {/* Inner fast spinning ring */}
        <div className="absolute inset-0 w-full h-full border-[3px] border-slate-800 border-t-transparent border-l-transparent rounded-full animate-spin"></div>
        {/* Center Icon */}
        <Hexagon className="w-8 h-8 text-slate-800 relative z-10" />
      </div>
      
      <div className="text-center flex flex-col gap-1.5">
        <p className="text-sm font-black text-gray-800 tracking-[0.2em] uppercase">
          PRISM Intelligence
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">
          Aggregating Data
        </p>
      </div>
    </div>
  );
}
