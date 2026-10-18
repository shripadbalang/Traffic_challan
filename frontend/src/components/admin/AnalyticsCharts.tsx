import React from 'react';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  PieChart,
  ShieldAlert,
  ArrowUpRight,
  DollarSign,
  AlertOctagon,
} from 'lucide-react';
import { AnalyticsData } from '../../types';

export const AnalyticsCharts: React.FC<{ data: AnalyticsData }> = ({ data }) => {
  // Max count for scaling chart
  const maxWeeklyCount = Math.max(...data.weeklyTrend.map((w) => w.count), 1);
  const totalViolationsCount = data.byViolationType.reduce((acc, curr) => acc + curr.count, 0) || 1;

  const typeColors: Record<string, string> = {
    'No Helmet': 'bg-rose-500',
    'Mobile Phone Usage': 'bg-amber-500',
    'Wrong Side Driving': 'bg-purple-500',
    'Triple Riding': 'bg-blue-500',
  };

  return (
    <div className="space-y-6">
      {/* 2-Column Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Weekly Issuance & Trend Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Weekly Violation Ingestion Trend
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% vs last month
            </span>
          </div>

          {/* SVG/CSS Bar Chart */}
          <div className="pt-4">
            <div className="flex items-end justify-between h-48 gap-4 px-2">
              {data.weeklyTrend.map((item) => {
                const heightPercent = Math.round((item.count / maxWeeklyCount) * 100);
                return (
                  <div key={item.week} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition">
                      {item.count.toLocaleString()}
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[48px] bg-gradient-to-t from-blue-700 to-cyan-400 rounded-t-lg transition-all group-hover:brightness-110 shadow-lg shadow-blue-500/10 relative"
                    >
                      <div className="absolute top-1 inset-x-0 h-1 bg-white/30 rounded-full mx-1" />
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.week}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Automated citations processed across all municipal traffic junctions.
          </div>
        </div>

        {/* Right: Breakdown by Violation Type */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              Violations Breakdown by Category
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Section Distribution</span>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4 pt-2">
            {data.byViolationType.map((v) => {
              const percent = Math.round((v.count / totalViolationsCount) * 100);
              const colorClass = typeColors[v.type] || 'bg-blue-500';

              return (
                <div key={v.type} className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{v.type}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {v.count.toLocaleString()} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full ${colorClass} rounded-full transition-all`}
                    />
                  </div>
                  <div className="text-right text-[11px] text-amber-600 dark:text-amber-300 font-mono font-semibold">
                    Total Fines: ₹{v.fineTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* High Incident Junction Hotspots */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            Top Violation Density Hotspots (High Enforcement Zones)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Automated Camera Ingestion Heatmap</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.hotspots.map((spot, i) => (
            <div
              key={spot.location}
              className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center">
                  #{i + 1}
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{spot.location}</h4>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    GPS: {spot.latitude.toFixed(2)}°N, {spot.longitude.toFixed(2)}°E
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {spot.count.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">incidents</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
