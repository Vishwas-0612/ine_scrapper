import React from 'react';
import { ShoppingCart, RefreshCw, Sun, Moon, Activity, Zap } from 'lucide-react';

export default function Navbar({ isDarkMode, setIsDarkMode, onRefreshAll, isScrapingAll }) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-900/80 dark:bg-slate-900/80 light:bg-white/80 border-b border-slate-800 dark:border-slate-800 light:border-slate-200 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl text-white shadow-lg shadow-cyan-500/20">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                INE Store Tracker
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Playwright Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Automated E-Commerce Price Audit & Resilience Monitor</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Live Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>API Online</span>
          </div>

          {/* Refresh All Cron Button */}
          <button
            onClick={onRefreshAll}
            disabled={isScrapingAll}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs sm:text-sm shadow-md shadow-cyan-500/15 disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isScrapingAll ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isScrapingAll ? 'Scraping Store...' : 'Run Scraper All'}</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </div>
    </header>
  );
}
