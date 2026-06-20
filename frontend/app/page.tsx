"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Shield, Activity, BarChart } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";


export default function LandingPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-slate-100 selection:text-slate-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative">
            <Image src="/icon.png" alt="PRISM Logo" fill className="object-contain" />
          </div>
          <span className="font-bold text-slate-900 tracking-wide">PRISM</span>
        </div>
        <Link 
          href="/dashboard" 
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2 px-4 py-2 rounded-md hover:bg-slate-50"
        >
          {t.nav.accessDashboard}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </nav>


      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 mb-4 tracking-wide uppercase">
            Intelligent Traffic Management
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
            {t.landing.tagline} <br/>
            <span className="text-slate-400">{t.landing.subTagline}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {t.landing.description}
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm w-full sm:w-auto"
            >
              {t.landing.launchPlatform}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="https://github.com/skr-suyash/flipkard-gridlock"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 bg-white text-slate-700 px-8 py-4 rounded-lg font-medium border border-slate-200 hover:bg-slate-50 transition-colors w-full sm:w-auto"
            >
              {t.landing.viewDocs}
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 text-left px-4 md:px-0">
          <FeatureCard 
            icon={<Activity className="w-5 h-5" />}
            title={t.landing.feature1Title}
            description={t.landing.feature1Desc}
          />
          <FeatureCard 
            icon={<Shield className="w-5 h-5" />}
            title={t.landing.feature2Title}
            description={t.landing.feature2Desc}
          />
          <FeatureCard 
            icon={<BarChart className="w-5 h-5" />}
            title={t.landing.feature3Title}
            description={t.landing.feature3Desc}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-400 text-sm border-t border-slate-100 mt-12">
        <p>&copy; {new Date().getFullYear()} PRISM Enterprise Solutions. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 mb-4 border border-slate-100">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2 tracking-tight">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
